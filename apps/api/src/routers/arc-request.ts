import { TRPCError } from '@trpc/server';
import {
  eq, and, desc, inArray, sql, getTableColumns,
} from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import {
  arcRequests, arcTransitions, arcVotes, arcModificationTypes,
  properties, members, users, committeeMemberships, committees,
} from '@repo/db';
import type { DbClient } from '@repo/db';
import {
  createArcRequestSchema, arcRequestListSchema, transitionArcRequestSchema,
  arcVoteSchema, addArcConditionSchema, acceptArcConditionsSchema,
  idParamSchema, ARC_STATUS, VALID_ARC_TRANSITIONS, TERMINAL_ARC_STATES,
  CLERK_ROLES,
} from '@repo/shared';
import type { ArcStatus } from '@repo/shared';
import { router } from '../trpc/router';
import { tenantProcedure, requirePermission } from '../trpc/procedures';
import {
  calculateDeadlines, checkDeemedApproved, isProtectedModification,
} from '../lib/arc-compliance';

// ── Helpers ────────────────────────────────────────────────────────────

const BOARD_ROLES: ReadonlySet<string> = new Set([
  CLERK_ROLES.SUPER_ADMIN,
  CLERK_ROLES.BOARD_OFFICER,
  CLERK_ROLES.BOARD_MEMBER,
  CLERK_ROLES.PROPERTY_MANAGER,
  CLERK_ROLES.COMMITTEE_MEMBER,
]);

async function resolveInternalUserId(
  db: DbClient,
  clerkUserId: string | null,
): Promise<string | null> {
  if (!clerkUserId) return null;
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);
  return rows[0]?.id ?? null;
}

async function resolveMemberIdByUserId(
  db: DbClient,
  clerkUserId: string | null,
): Promise<string | null> {
  if (!clerkUserId) return null;
  const rows = await db
    .select({ memberId: members.id })
    .from(members)
    .innerJoin(users, eq(members.userId, users.id))
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);
  return rows[0]?.memberId ?? null;
}

async function fetchRequestOrThrow(
  db: DbClient,
  requestId: string,
): Promise<typeof arcRequests.$inferSelect> {
  const rows = await db
    .select()
    .from(arcRequests)
    .where(eq(arcRequests.id, requestId))
    .limit(1);

  if (!rows[0]) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `ARC request ${requestId} not found` });
  }
  return rows[0];
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0]!;
}

function computeDaysRemaining(deadline: string | null): number | null {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000);
}

// ── Router ─────────────────────────────────────────────────────────────

const requestCols = getTableColumns(arcRequests);

export const arcRequestRouter = router({

  create: tenantProcedure
    .input(createArcRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const propRows = await ctx.db
        .select({
          id: properties.id,
          communityId: properties.communityId,
          stateCode: properties.stateCode,
        })
        .from(properties)
        .where(eq(properties.id, input.propertyId))
        .limit(1);

      const property = propRows[0];
      if (!property) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Property not found' });
      }

      const modTypeRows = await ctx.db
        .select()
        .from(arcModificationTypes)
        .where(eq(arcModificationTypes.id, input.modificationTypeId))
        .limit(1);

      const modType = modTypeRows[0];
      if (!modType) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Modification type not found' });
      }

      const applicantId = await resolveMemberIdByUserId(ctx.db, ctx.auth.userId);
      if (!applicantId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Your user account is not linked to a member record. Contact your HOA administrator.',
        });
      }

      const submissionDate = todayIso();
      const deadlines = calculateDeadlines(
        submissionDate,
        { defaultReviewDays: modType.defaultReviewDays, name: modType.name },
        property.stateCode,
      );

      const protectedCheck = isProtectedModification(modType.name, property.stateCode);

      const [request] = await ctx.db.insert(arcRequests).values({
        tenantId: ctx.tenantId,
        communityId: property.communityId,
        propertyId: input.propertyId,
        applicantId,
        modificationTypeId: input.modificationTypeId,
        status: ARC_STATUS.SUBMITTED,
        complexityTier: modType.complexityTier,
        title: input.title,
        description: input.description,
        estimatedCost: input.estimatedCost != null ? String(input.estimatedCost) : null,
        estimatedStartDate: input.estimatedStartDate
          ? input.estimatedStartDate.toISOString().split('T')[0]!
          : null,
        estimatedCompletionDate: input.estimatedCompletionDate
          ? input.estimatedCompletionDate.toISOString().split('T')[0]!
          : null,
        submissionDate,
        reviewDeadline: deadlines.reviewDeadline,
        deemedApprovedDeadline: deadlines.deemedApprovedDeadline,
        precedentTags: [modType.name.toLowerCase().replace(/\s+/g, '_')],
      }).returning();

      const userId = await resolveInternalUserId(ctx.db, ctx.auth.userId);

      await ctx.db.insert(arcTransitions).values({
        tenantId: ctx.tenantId,
        requestId: request!.id,
        fromState: '_initial',
        toState: ARC_STATUS.SUBMITTED,
        triggeredBy: userId,
        reason: 'ARC request submitted',
        metadata: {
          modificationTypeName: modType.name,
          complexityTier: modType.complexityTier,
          ...(protectedCheck.isProtected
            ? { protectedModification: true, protectedLaw: protectedCheck.law }
            : {}),
        },
      });

      return {
        ...request!,
        protectedModification: protectedCheck.isProtected ? protectedCheck : null,
      };
    }),

  list: tenantProcedure
    .input(arcRequestListSchema)
    .query(async ({ ctx, input }) => {
      const isBoard = BOARD_ROLES.has(ctx.auth.orgRole);
      const conditions: SQL[] = [];

      if (input.cursor) {
        conditions.push(
          sql`(${arcRequests.createdAt}, ${arcRequests.id}) < (SELECT created_at, id FROM arc_requests WHERE id = ${input.cursor})`,
        );
      }
      if (input.status?.length) {
        conditions.push(inArray(arcRequests.status, input.status));
      }
      if (input.propertyId) {
        conditions.push(eq(arcRequests.propertyId, input.propertyId));
      }

      if (input.applicantId) {
        conditions.push(eq(arcRequests.applicantId, input.applicantId));
      } else if (!isBoard) {
        const memberId = await resolveMemberIdByUserId(ctx.db, ctx.auth.userId);
        if (memberId) {
          conditions.push(eq(arcRequests.applicantId, memberId));
        }
      }

      const rows = await ctx.db
        .select({
          ...requestCols,
          propertyAddress: properties.addressLine1,
          propertyLot: properties.lotNumber,
          applicantFirstName: members.firstName,
          applicantLastName: members.lastName,
          modificationTypeName: arcModificationTypes.name,
        })
        .from(arcRequests)
        .leftJoin(properties, eq(arcRequests.propertyId, properties.id))
        .leftJoin(members, eq(arcRequests.applicantId, members.id))
        .leftJoin(arcModificationTypes, eq(arcRequests.modificationTypeId, arcModificationTypes.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(arcRequests.createdAt), desc(arcRequests.id))
        .limit(input.limit + 1);

      const hasMore = rows.length > input.limit;
      const items = hasMore ? rows.slice(0, input.limit) : rows;

      return {
        items: items.map((row) => ({
          ...row,
          daysRemainingReview: computeDaysRemaining(row.reviewDeadline),
          daysRemainingDeemedApproved: computeDaysRemaining(row.deemedApprovedDeadline),
        })),
        nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
      };
    }),

  getById: tenantProcedure
    .input(idParamSchema)
    .query(async ({ ctx, input }) => {
      const rRows = await ctx.db
        .select({
          ...requestCols,
          propertyAddress: properties.addressLine1,
          propertyLot: properties.lotNumber,
          propertyCity: properties.city,
          propertyState: properties.stateCode,
          applicantFirstName: members.firstName,
          applicantLastName: members.lastName,
          modificationTypeName: arcModificationTypes.name,
          modificationTypeComplexity: arcModificationTypes.complexityTier,
          requiredDocuments: arcModificationTypes.requiredDocuments,
        })
        .from(arcRequests)
        .leftJoin(properties, eq(arcRequests.propertyId, properties.id))
        .leftJoin(members, eq(arcRequests.applicantId, members.id))
        .leftJoin(arcModificationTypes, eq(arcRequests.modificationTypeId, arcModificationTypes.id))
        .where(eq(arcRequests.id, input.id))
        .limit(1);

      const request = rRows[0];
      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `ARC request ${input.id} not found` });
      }

      const [transitionRows, voteRows] = await Promise.all([
        ctx.db
          .select()
          .from(arcTransitions)
          .where(eq(arcTransitions.requestId, input.id))
          .orderBy(arcTransitions.createdAt),
        ctx.db
          .select({
            id: arcVotes.id,
            voteValue: arcVotes.voteValue,
            rationale: arcVotes.rationale,
            conditionsProposed: arcVotes.conditionsProposed,
            conflictOfInterest: arcVotes.conflictOfInterest,
            createdAt: arcVotes.createdAt,
            memberFirstName: members.firstName,
            memberLastName: members.lastName,
          })
          .from(arcVotes)
          .leftJoin(members, eq(arcVotes.committeeMemberId, members.id))
          .where(eq(arcVotes.requestId, input.id))
          .orderBy(arcVotes.createdAt),
      ]);

      const validNext = VALID_ARC_TRANSITIONS[request.status as string] ?? [];

      const deemedApprovedCheck = checkDeemedApproved({
        deemedApprovedDeadline: request.deemedApprovedDeadline,
        decisionDate: request.decisionDate,
      });

      const protectedCheck = request.modificationTypeName
        ? isProtectedModification(request.modificationTypeName, request.propertyState ?? 'WA')
        : null;

      return {
        request,
        transitions: transitionRows,
        votes: voteRows,
        validTransitions: validNext as ArcStatus[],
        daysRemainingReview: computeDaysRemaining(request.reviewDeadline),
        daysRemainingDeemedApproved: computeDaysRemaining(request.deemedApprovedDeadline),
        deemedApproved: deemedApprovedCheck,
        protectedModification: protectedCheck?.isProtected ? protectedCheck : null,
      };
    }),

  transition: tenantProcedure
    .input(transitionArcRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const current = await fetchRequestOrThrow(ctx.db, input.requestId);
      const fromState = current.status as ArcStatus;
      const toState = input.toState as ArcStatus;

      if (TERMINAL_ARC_STATES.includes(fromState)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Request is in terminal state '${fromState}' and cannot be transitioned`,
        });
      }

      const validNext = VALID_ARC_TRANSITIONS[fromState];
      if (!validNext?.includes(toState)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Transition from '${fromState}' to '${toState}' is not permitted`,
        });
      }

      const updateFields: Record<string, unknown> = { status: toState };

      if (toState === ARC_STATUS.APPROVED || toState === ARC_STATUS.DENIED || toState === ARC_STATUS.APPROVED_WITH_CONDITIONS) {
        updateFields['decisionDate'] = todayIso();
        updateFields['decisionType'] = toState === ARC_STATUS.APPROVED_WITH_CONDITIONS ? 'approved_with_conditions' : toState;
        updateFields['decisionRationale'] = input.reason;
      }

      if (TERMINAL_ARC_STATES.includes(toState)) {
        updateFields['completionDeadline'] = null;
      }

      const [updated] = await ctx.db
        .update(arcRequests)
        .set(updateFields)
        .where(eq(arcRequests.id, input.requestId))
        .returning();

      const userId = await resolveInternalUserId(ctx.db, ctx.auth.userId);

      await ctx.db.insert(arcTransitions).values({
        tenantId: ctx.tenantId,
        requestId: input.requestId,
        fromState,
        toState,
        triggeredBy: userId,
        reason: input.reason,
        metadata: input.metadata ?? {},
      });

      return updated!;
    }),

  vote: tenantProcedure
    .input(arcVoteSchema)
    .mutation(async ({ ctx, input }) => {
      const request = await fetchRequestOrThrow(ctx.db, input.requestId);

      if (request.status !== ARC_STATUS.COMMITTEE_REVIEW) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Votes can only be cast when the request is in committee review. Current status: '${request.status}'`,
        });
      }

      const memberId = await resolveMemberIdByUserId(ctx.db, ctx.auth.userId);
      if (!memberId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Your user account is not linked to a member record.',
        });
      }

      const arcCommittee = await ctx.db
        .select({ id: committees.id })
        .from(committees)
        .where(
          and(
            eq(committees.name, 'Architectural Review Committee'),
            eq(committees.isActive, true),
          ),
        )
        .limit(1);

      if (arcCommittee[0]) {
        const membership = await ctx.db
          .select({ id: committeeMemberships.id })
          .from(committeeMemberships)
          .where(
            and(
              eq(committeeMemberships.committeeId, arcCommittee[0].id),
              eq(committeeMemberships.memberId, memberId),
            ),
          )
          .limit(1);

        if (!membership[0]) {
          const isBoardMember = BOARD_ROLES.has(ctx.auth.orgRole);
          if (!isBoardMember) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'You are not a member of the Architectural Review Committee.',
            });
          }
        }
      }

      if (input.conflictOfInterest) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You have declared a conflict of interest and cannot vote on this request. Please recuse yourself.',
        });
      }

      const modTypeName = request.modificationTypeId
        ? (await ctx.db
            .select({ name: arcModificationTypes.name })
            .from(arcModificationTypes)
            .where(eq(arcModificationTypes.id, request.modificationTypeId))
            .limit(1)
          )[0]?.name
        : null;

      if (modTypeName && input.voteValue === 'deny') {
        const propRows = await ctx.db
          .select({ stateCode: properties.stateCode })
          .from(properties)
          .where(eq(properties.id, request.propertyId))
          .limit(1);
        const stateCode = propRows[0]?.stateCode ?? 'WA';
        const protectedCheck = isProtectedModification(modTypeName, stateCode);
        if (protectedCheck.isProtected) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `This modification type is protected by law (${protectedCheck.law}). It cannot be denied. ${protectedCheck.restriction}`,
          });
        }
      }

      const [vote] = await ctx.db.insert(arcVotes).values({
        tenantId: ctx.tenantId,
        requestId: input.requestId,
        committeeMemberId: memberId,
        voteValue: input.voteValue,
        rationale: input.rationale,
        conditionsProposed: input.conditionsProposed ?? [],
        guidelineCitations: input.guidelineCitations ?? [],
        conflictOfInterest: input.conflictOfInterest,
      }).returning();

      const allVotes = await ctx.db
        .select({ voteValue: arcVotes.voteValue })
        .from(arcVotes)
        .where(eq(arcVotes.requestId, input.requestId));

      const voteSummary = {
        total: allVotes.length,
        approve: allVotes.filter((v) => v.voteValue === 'approve').length,
        deny: allVotes.filter((v) => v.voteValue === 'deny').length,
        conditional: allVotes.filter((v) => v.voteValue === 'conditional').length,
      };

      return { vote: vote!, voteSummary };
    }),

  addCondition: tenantProcedure
    .use(requirePermission('org:arc:manage'))
    .input(addArcConditionSchema)
    .mutation(async ({ ctx, input }) => {
      const request = await fetchRequestOrThrow(ctx.db, input.requestId);

      if (request.status !== ARC_STATUS.APPROVED_WITH_CONDITIONS) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Conditions can only be added to requests with 'approved_with_conditions' status. Current: '${request.status}'`,
        });
      }

      const existingConditions = (request.conditions ?? []) as Array<Record<string, unknown>>;
      const newCondition = {
        condition: input.condition,
        dueDate: input.dueDate?.toISOString().split('T')[0] ?? null,
        addedAt: new Date().toISOString(),
      };

      const [updated] = await ctx.db
        .update(arcRequests)
        .set({ conditions: [...existingConditions, newCondition] })
        .where(eq(arcRequests.id, input.requestId))
        .returning();

      return updated!;
    }),

  acceptConditions: tenantProcedure
    .input(acceptArcConditionsSchema)
    .mutation(async ({ ctx, input }) => {
      const request = await fetchRequestOrThrow(ctx.db, input.requestId);

      if (request.status !== ARC_STATUS.APPROVED_WITH_CONDITIONS) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Conditions can only be accepted when status is 'approved_with_conditions'. Current: '${request.status}'`,
        });
      }

      const memberId = await resolveMemberIdByUserId(ctx.db, ctx.auth.userId);
      if (!memberId || memberId !== request.applicantId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only the applicant can accept conditions on their request.',
        });
      }

      const [updated] = await ctx.db
        .update(arcRequests)
        .set({ status: ARC_STATUS.CONSTRUCTION_ACTIVE })
        .where(eq(arcRequests.id, input.requestId))
        .returning();

      const userId = await resolveInternalUserId(ctx.db, ctx.auth.userId);

      await ctx.db.insert(arcTransitions).values({
        tenantId: ctx.tenantId,
        requestId: input.requestId,
        fromState: ARC_STATUS.APPROVED_WITH_CONDITIONS,
        toState: ARC_STATUS.CONSTRUCTION_ACTIVE,
        triggeredBy: userId,
        reason: 'Applicant accepted approval conditions',
        metadata: { conditionsAccepted: true },
      });

      return updated!;
    }),
});

import { TRPCError } from '@trpc/server';
import {
  eq, and, desc, inArray, gte, lte, sql, getTableColumns,
} from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import {
  violations, violationTransitions, violationEvidence,
  violationCategories, properties, users,
} from '@repo/db';
import type { DbClient } from '@repo/db';
import {
  createViolationSchema, violationListSchema, transitionViolationSchema,
  addEvidenceSchema, dismissViolationSchema, idParamSchema,
  VIOLATION_STATUS, VALID_TRANSITIONS, TERMINAL_STATES,
} from '@repo/shared';
import type { ViolationStatus } from '@repo/shared';
import { router } from '../trpc/router';
import { tenantProcedure } from '../trpc/procedures';
import { getCureDeadline, validateTransition, checkFineCap } from '../lib/compliance';
import { getPresignedUploadUrl, buildFileUrl } from '../lib/s3';

const EVIDENCE_CONTENT_TYPES: Record<string, string> = {
  photo: 'image/jpeg',
  video: 'video/mp4',
  document: 'application/pdf',
};

// ── Helpers ────────────────────────────────────────────────────────────

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

async function fetchViolationOrThrow(
  db: DbClient,
  violationId: string,
): Promise<typeof violations.$inferSelect> {
  const rows = await db
    .select()
    .from(violations)
    .where(eq(violations.id, violationId))
    .limit(1);

  if (!rows[0]) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `Violation ${violationId} not found` });
  }
  return rows[0];
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0]!;
}

const REPEAT_LOOKBACK_MONTHS = 12;

export async function checkRepeatOffender(
  db: DbClient,
  propertyId: string,
  categoryId: string | undefined | null,
): Promise<{ isRepeat: boolean; previousViolationId?: string }> {
  if (!categoryId) return { isRepeat: false };

  const lookbackDate = new Date();
  lookbackDate.setMonth(lookbackDate.getMonth() - REPEAT_LOOKBACK_MONTHS);
  const lookbackStr = lookbackDate.toISOString().split('T')[0]!;

  const existing = await db
    .select({ id: violations.id })
    .from(violations)
    .where(
      and(
        eq(violations.propertyId, propertyId),
        eq(violations.categoryId, categoryId),
        gte(violations.reportedDate, lookbackStr),
      ),
    )
    .limit(1);

  if (existing[0]) {
    return { isRepeat: true, previousViolationId: existing[0].id };
  }
  return { isRepeat: false };
}

// ── State update helpers ───────────────────────────────────────────────

function buildStateUpdateFields(
  toState: ViolationStatus,
  input: { hearingDate?: Date; fineAmount?: number },
  cureDeadline?: string,
): Record<string, unknown> {
  const updates: Record<string, unknown> = { status: toState };

  if (toState === VIOLATION_STATUS.VERIFIED) {
    updates['verifiedDate'] = todayIso();
  }
  if (cureDeadline) {
    updates['cureDeadline'] = cureDeadline;
  }
  if (toState === VIOLATION_STATUS.HEARING_SCHEDULED && input.hearingDate) {
    updates['hearingDate'] = input.hearingDate;
  }
  if (toState === VIOLATION_STATUS.FINE_ASSESSED && input.fineAmount != null) {
    updates['fineAmount'] = String(input.fineAmount);
  }
  if (TERMINAL_STATES.includes(toState)) {
    updates['resolvedDate'] = todayIso();
  }
  return updates;
}

// ── Router ─────────────────────────────────────────────────────────────

const violationCols = getTableColumns(violations);

export const violationRouter = router({

  create: tenantProcedure
    .input(createViolationSchema)
    .mutation(async ({ ctx, input }) => {
      const propRows = await ctx.db
        .select({ id: properties.id, communityId: properties.communityId, stateCode: properties.stateCode })
        .from(properties)
        .where(eq(properties.id, input.propertyId))
        .limit(1);

      const property = propRows[0];
      if (!property) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Property not found' });
      }

      const repeatCheck = await checkRepeatOffender(
        ctx.db, input.propertyId, input.categoryId,
      );

      const complianceRules: Record<string, unknown> = {};
      if (repeatCheck.isRepeat) {
        complianceRules['isRepeatOffender'] = true;
        complianceRules['previousViolationId'] = repeatCheck.previousViolationId;
      }
      if (input.isAnonymousReport) {
        complianceRules['requiresIndependentVerification'] = true;
      }

      const [violation] = await ctx.db.insert(violations).values({
        tenantId: ctx.tenantId,
        communityId: property.communityId,
        propertyId: input.propertyId,
        categoryId: input.categoryId,
        title: input.title,
        description: input.description,
        severity: input.severity,
        source: input.source,
        latitude: input.latitude != null ? String(input.latitude) : null,
        longitude: input.longitude != null ? String(input.longitude) : null,
        isAnonymousReport: input.isAnonymousReport,
        complianceRules,
        reportedDate: todayIso(),
      }).returning();

      const userId = await resolveInternalUserId(ctx.db, ctx.auth.userId);

      await ctx.db.insert(violationTransitions).values({
        tenantId: ctx.tenantId,
        violationId: violation!.id,
        fromState: '_initial',
        toState: VIOLATION_STATUS.REPORTED,
        triggeredBy: userId,
        reason: 'Violation reported',
        metadata: { source: input.source },
      });

      return violation!;
    }),

  list: tenantProcedure
    .input(violationListSchema)
    .query(async ({ ctx, input }) => {
      const conditions: SQL[] = [];

      if (input.cursor) {
        conditions.push(
          sql`(${violations.createdAt}, ${violations.id}) < (SELECT created_at, id FROM violations WHERE id = ${input.cursor})`,
        );
      }
      if (input.status?.length) {
        conditions.push(inArray(violations.status, input.status));
      }
      if (input.propertyId) {
        conditions.push(eq(violations.propertyId, input.propertyId));
      }
      if (input.categoryId) {
        conditions.push(eq(violations.categoryId, input.categoryId));
      }
      if (input.severity) {
        conditions.push(eq(violations.severity, input.severity));
      }
      if (input.dateFrom) {
        conditions.push(gte(violations.reportedDate, input.dateFrom.toISOString().split('T')[0]!));
      }
      if (input.dateTo) {
        conditions.push(lte(violations.reportedDate, input.dateTo.toISOString().split('T')[0]!));
      }

      const rows = await ctx.db
        .select({
          ...violationCols,
          propertyAddress: properties.addressLine1,
          propertyLot: properties.lotNumber,
          categoryName: violationCategories.name,
        })
        .from(violations)
        .leftJoin(properties, eq(violations.propertyId, properties.id))
        .leftJoin(violationCategories, eq(violations.categoryId, violationCategories.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(violations.createdAt), desc(violations.id))
        .limit(input.limit + 1);

      const hasMore = rows.length > input.limit;
      const items = hasMore ? rows.slice(0, input.limit) : rows;

      return {
        items,
        nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
      };
    }),

  getById: tenantProcedure
    .input(idParamSchema)
    .query(async ({ ctx, input }) => {
      const vRows = await ctx.db
        .select({
          ...violationCols,
          propertyAddress: properties.addressLine1,
          propertyLot: properties.lotNumber,
          propertyCity: properties.city,
          propertyState: properties.stateCode,
          categoryName: violationCategories.name,
        })
        .from(violations)
        .leftJoin(properties, eq(violations.propertyId, properties.id))
        .leftJoin(violationCategories, eq(violations.categoryId, violationCategories.id))
        .where(eq(violations.id, input.id))
        .limit(1);

      const violation = vRows[0];
      if (!violation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Violation ${input.id} not found` });
      }

      const [transitionRows, evidenceRows] = await Promise.all([
        ctx.db
          .select()
          .from(violationTransitions)
          .where(eq(violationTransitions.violationId, input.id))
          .orderBy(violationTransitions.createdAt),
        ctx.db
          .select()
          .from(violationEvidence)
          .where(eq(violationEvidence.violationId, input.id))
          .orderBy(desc(violationEvidence.capturedAt)),
      ]);

      const validNext = VALID_TRANSITIONS[violation.status as string] ?? [];

      return {
        violation,
        transitions: transitionRows,
        evidence: evidenceRows,
        validTransitions: validNext as ViolationStatus[],
      };
    }),

  transition: tenantProcedure
    .input(transitionViolationSchema)
    .mutation(async ({ ctx, input }) => {
      const current = await fetchViolationOrThrow(ctx.db, input.violationId);
      const fromState = current.status as ViolationStatus;
      const toState = input.toState as ViolationStatus;

      if (TERMINAL_STATES.includes(fromState)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Violation is in terminal state '${fromState}' and cannot be transitioned`,
        });
      }

      const propRows = await ctx.db
        .select({ stateCode: properties.stateCode })
        .from(properties)
        .where(eq(properties.id, current.propertyId))
        .limit(1);
      const stateCode = propRows[0]?.stateCode ?? 'WA';

      const result = await validateTransition(ctx.db, fromState, toState, stateCode);
      if (!result.allowed) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: result.reason });
      }

      if (toState === VIOLATION_STATUS.HEARING_SCHEDULED && !input.hearingDate) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Hearing date is required when scheduling a hearing',
        });
      }

      if (toState === VIOLATION_STATUS.FINE_ASSESSED) {
        if (input.fineAmount == null) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Fine amount is required when assessing a fine',
          });
        }
        const capResult = await checkFineCap(ctx.db, input.fineAmount, stateCode);
        if (!capResult.valid) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: capResult.message! });
        }
      }

      let cureDeadline: string | undefined;
      if (
        toState === VIOLATION_STATUS.COURTESY_NOTICE_SENT ||
        toState === VIOLATION_STATUS.FORMAL_NOTICE_SENT
      ) {
        cureDeadline = await getCureDeadline(ctx.db, todayIso(), stateCode);
      }

      const updateFields = buildStateUpdateFields(toState, input, cureDeadline);

      const [updated] = await ctx.db
        .update(violations)
        .set(updateFields)
        .where(eq(violations.id, input.violationId))
        .returning();

      const userId = await resolveInternalUserId(ctx.db, ctx.auth.userId);

      await ctx.db.insert(violationTransitions).values({
        tenantId: ctx.tenantId,
        violationId: input.violationId,
        fromState,
        toState,
        triggeredBy: userId,
        reason: input.reason,
        metadata: {
          ...input.metadata,
          ...(input.hearingDate ? { hearingDate: input.hearingDate.toISOString() } : {}),
          ...(input.fineAmount != null ? { fineAmount: input.fineAmount } : {}),
        },
      });

      return updated!;
    }),

  addEvidence: tenantProcedure
    .input(addEvidenceSchema)
    .mutation(async ({ ctx, input }) => {
      await fetchViolationOrThrow(ctx.db, input.violationId);

      const userId = await resolveInternalUserId(ctx.db, ctx.auth.userId);
      const evidenceId = crypto.randomUUID();
      const fileKey = `violations/${ctx.tenantId}/${input.violationId}/${evidenceId}`;
      const contentType = EVIDENCE_CONTENT_TYPES[input.evidenceType] ?? 'application/octet-stream';

      const { uploadUrl } = await getPresignedUploadUrl(fileKey, contentType);

      const [evidence] = await ctx.db.insert(violationEvidence).values({
        id: evidenceId,
        tenantId: ctx.tenantId,
        violationId: input.violationId,
        evidenceType: input.evidenceType,
        fileKey,
        fileUrl: buildFileUrl(fileKey),
        description: input.description,
        capturedBy: userId,
        latitude: input.latitude != null ? String(input.latitude) : null,
        longitude: input.longitude != null ? String(input.longitude) : null,
        fileHash: input.fileHash,
      }).returning();

      return { evidenceId: evidence!.id, uploadUrl, fileKey };
    }),

  dismiss: tenantProcedure
    .input(dismissViolationSchema)
    .mutation(async ({ ctx, input }) => {
      const current = await fetchViolationOrThrow(ctx.db, input.violationId);
      const fromState = current.status as ViolationStatus;

      const validNext = VALID_TRANSITIONS[fromState] ?? [];
      if (!validNext.includes(VIOLATION_STATUS.DISMISSED)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot dismiss a violation in '${fromState}' state`,
        });
      }

      const [updated] = await ctx.db
        .update(violations)
        .set({ status: VIOLATION_STATUS.DISMISSED, resolvedDate: todayIso() })
        .where(eq(violations.id, input.violationId))
        .returning();

      const userId = await resolveInternalUserId(ctx.db, ctx.auth.userId);

      await ctx.db.insert(violationTransitions).values({
        tenantId: ctx.tenantId,
        violationId: input.violationId,
        fromState,
        toState: VIOLATION_STATUS.DISMISSED,
        triggeredBy: userId,
        reason: input.reason,
        metadata: { dismissedVia: 'shortcut' },
      });

      return updated!;
    }),
});

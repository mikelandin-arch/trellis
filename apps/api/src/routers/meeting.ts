import { TRPCError } from '@trpc/server';
import { eq, and, desc, gte, lte, inArray, sql, count } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import {
  meetings, meetingAgendaItems, meetingAttendees,
  communications, communities, users,
} from '@repo/db';
import type { DbClient } from '@repo/db';
import {
  createMeetingSchema, updateMeetingSchema, meetingListSchema,
  recordAttendanceSchema, sendMeetingNoticeSchema, idParamSchema,
} from '@repo/shared';
import { router } from '../trpc/router';
import { tenantProcedure, requirePermission } from '../trpc/procedures';
import { calculateNoticeDueDate, getRequiredAgendaItems } from '../lib/meeting-compliance';
import { resolveAudience, resolveChannels, createDeliveries } from '../lib/notification-engine';

async function resolveCommunity(db: DbClient): Promise<{ id: string; stateCode: string; totalVotingWeight: string }> {
  const rows = await db
    .select({
      id: communities.id,
      stateCode: communities.stateCode,
      totalVotingWeight: communities.totalVotingWeight,
    })
    .from(communities)
    .limit(1);
  if (!rows[0]) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'No community found for this tenant' });
  }
  return rows[0];
}

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

export const meetingRouter = router({
  create: tenantProcedure
    .use(requirePermission('org:meetings:manage'))
    .input(createMeetingSchema)
    .mutation(async ({ ctx, input }) => {
      const community = await resolveCommunity(ctx.db);
      const quorumRequired = Math.ceil(Number(community.totalVotingWeight) * 0.5) || 1;

      const [meeting] = await ctx.db.insert(meetings).values({
        tenantId: ctx.tenantId,
        communityId: community.id,
        meetingType: input.meetingType,
        title: input.title,
        scheduledAt: input.scheduledAt,
        location: input.location,
        virtualMeetingUrl: input.virtualMeetingUrl,
        isVirtual: input.isVirtual,
        isHybrid: input.isHybrid,
        status: 'scheduled',
        quorumRequired,
        quorumPresent: 0,
        quorumMet: false,
      }).returning();

      const requiredItems = getRequiredAgendaItems(
        input.meetingType as Parameters<typeof getRequiredAgendaItems>[0],
        community.stateCode,
      );

      if (requiredItems.length > 0) {
        await ctx.db.insert(meetingAgendaItems).values(
          requiredItems.map((item, index) => ({
            tenantId: ctx.tenantId,
            meetingId: meeting!.id,
            itemType: item.itemType,
            title: item.title,
            durationMinutes: item.durationMinutes,
            sortOrder: index,
          })),
        );
      }

      return meeting!;
    }),

  list: tenantProcedure
    .input(meetingListSchema)
    .query(async ({ ctx, input }) => {
      const conditions: SQL[] = [];

      if (input.meetingType) {
        conditions.push(eq(meetings.meetingType, input.meetingType));
      }
      if (input.status?.length) {
        conditions.push(inArray(meetings.status, input.status));
      }
      if (input.dateFrom) {
        conditions.push(gte(meetings.scheduledAt, input.dateFrom));
      }
      if (input.dateTo) {
        conditions.push(lte(meetings.scheduledAt, input.dateTo));
      }
      if (input.cursor) {
        conditions.push(sql`${meetings.id} <= ${input.cursor}`);
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await ctx.db
        .select()
        .from(meetings)
        .where(where)
        .orderBy(desc(meetings.scheduledAt))
        .limit(input.limit + 1);

      const hasMore = rows.length > input.limit;
      const items = hasMore ? rows.slice(0, input.limit) : rows;
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

      return { items, nextCursor };
    }),

  getById: tenantProcedure
    .input(idParamSchema)
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(meetings)
        .where(eq(meetings.id, input.id))
        .limit(1);

      if (!rows[0]) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' });
      }

      const agendaItems = await ctx.db
        .select()
        .from(meetingAgendaItems)
        .where(eq(meetingAgendaItems.meetingId, input.id))
        .orderBy(meetingAgendaItems.sortOrder);

      const attendees = await ctx.db
        .select()
        .from(meetingAttendees)
        .where(eq(meetingAttendees.meetingId, input.id));

      return {
        ...rows[0],
        agendaItems,
        attendees,
      };
    }),

  update: tenantProcedure
    .use(requirePermission('org:meetings:manage'))
    .input(updateMeetingSchema)
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(meetings)
        .where(eq(meetings.id, input.id))
        .limit(1);

      if (!rows[0]) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' });
      }

      if (rows[0].status !== 'draft' && rows[0].status !== 'scheduled') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot update meeting in '${rows[0].status}' status`,
        });
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (input.title !== undefined) updates.title = input.title;
      if (input.scheduledAt !== undefined) updates.scheduledAt = input.scheduledAt;
      if (input.location !== undefined) updates.location = input.location;
      if (input.virtualMeetingUrl !== undefined) updates.virtualMeetingUrl = input.virtualMeetingUrl;
      if (input.isVirtual !== undefined) updates.isVirtual = input.isVirtual;
      if (input.isHybrid !== undefined) updates.isHybrid = input.isHybrid;
      if (input.status !== undefined) updates.status = input.status;
      if (input.minutesText !== undefined) updates.minutesText = input.minutesText;

      const [updated] = await ctx.db
        .update(meetings)
        .set(updates)
        .where(eq(meetings.id, input.id))
        .returning();

      return updated!;
    }),

  sendNotice: tenantProcedure
    .use(requirePermission('org:meetings:manage'))
    .input(sendMeetingNoticeSchema)
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(meetings)
        .where(eq(meetings.id, input.meetingId))
        .limit(1);

      if (!rows[0]) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' });
      }

      const meeting = rows[0];
      const community = await resolveCommunity(ctx.db);
      const noticeDueDate = calculateNoticeDueDate(
        meeting.scheduledAt,
        meeting.meetingType as Parameters<typeof calculateNoticeDueDate>[1],
        community.stateCode,
      );

      const now = new Date();
      if (now > noticeDueDate) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Notice deadline was ${noticeDueDate.toISOString().split('T')[0]}. This meeting may not meet the required notice period.`,
        });
      }

      const userId = await resolveInternalUserId(ctx.db, ctx.auth.userId);

      const [comm] = await ctx.db.insert(communications).values({
        tenantId: ctx.tenantId,
        communityId: community.id,
        communicationType: 'meeting_notice',
        subject: `Meeting Notice: ${meeting.title}`,
        body: `You are invited to attend: ${meeting.title}\n\nDate: ${meeting.scheduledAt.toISOString()}\nLocation: ${meeting.location ?? 'TBD'}\n${meeting.virtualMeetingUrl ? `Virtual Link: ${meeting.virtualMeetingUrl}` : ''}`,
        priority: 'standard',
        status: 'sent',
        audienceType: 'all_members',
        audienceFilter: {},
        channels: ['email'],
        sentAt: now,
        sentBy: userId,
        sourceType: 'meeting',
        sourceId: meeting.id,
      }).returning();

      const audience = await resolveAudience(ctx.db, community.id, 'all_members');
      const memberChannels = audience.map((member) => ({
        memberId: member.id,
        channels: resolveChannels(member, 'standard', 'meeting_notice'),
      }));
      await createDeliveries(ctx.db, comm!.id, ctx.tenantId, memberChannels);

      await ctx.db
        .update(meetings)
        .set({ noticeSentAt: now, noticeMethod: ['email'] })
        .where(eq(meetings.id, input.meetingId));

      return { communicationId: comm!.id, noticeDueDate };
    }),

  recordAttendance: tenantProcedure
    .input(recordAttendanceSchema)
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(meetings)
        .where(eq(meetings.id, input.meetingId))
        .limit(1);

      if (!rows[0]) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' });
      }

      await ctx.db
        .insert(meetingAttendees)
        .values({
          tenantId: ctx.tenantId,
          meetingId: input.meetingId,
          memberId: input.memberId,
          attendanceType: input.attendanceType,
          isBoardMember: input.isBoardMember,
          proxyForMemberId: input.proxyForMemberId,
          checkedInAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [meetingAttendees.tenantId, meetingAttendees.meetingId, meetingAttendees.memberId],
          set: {
            attendanceType: input.attendanceType,
            isBoardMember: input.isBoardMember,
            proxyForMemberId: input.proxyForMemberId,
            checkedInAt: new Date(),
          },
        });

      const presentCount = await ctx.db
        .select({ count: count() })
        .from(meetingAttendees)
        .where(
          and(
            eq(meetingAttendees.meetingId, input.meetingId),
            sql`${meetingAttendees.attendanceType} != 'absent'`,
          ),
        );

      const present = Number(presentCount[0]?.count ?? 0);
      const quorumRequired = rows[0].quorumRequired ?? 1;
      const quorumMet = present >= quorumRequired;

      await ctx.db
        .update(meetings)
        .set({ quorumPresent: present, quorumMet })
        .where(eq(meetings.id, input.meetingId));

      return { quorumRequired, quorumPresent: present, quorumMet };
    }),

  checkQuorum: tenantProcedure
    .input(idParamSchema)
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          quorumRequired: meetings.quorumRequired,
          quorumPresent: meetings.quorumPresent,
          quorumMet: meetings.quorumMet,
        })
        .from(meetings)
        .where(eq(meetings.id, input.id))
        .limit(1);

      if (!rows[0]) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' });
      }

      return rows[0];
    }),

  cancel: tenantProcedure
    .use(requirePermission('org:meetings:manage'))
    .input(idParamSchema)
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(meetings)
        .where(eq(meetings.id, input.id))
        .limit(1);

      if (!rows[0]) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' });
      }

      if (rows[0].status === 'completed' || rows[0].status === 'cancelled') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot cancel meeting in '${rows[0].status}' status`,
        });
      }

      const [updated] = await ctx.db
        .update(meetings)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(meetings.id, input.id))
        .returning();

      return updated!;
    }),
});

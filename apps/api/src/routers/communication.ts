import { TRPCError } from '@trpc/server';
import { eq, and, desc, gte, lte, inArray, count } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import {
  communications, communicationDeliveries, communities, users,
} from '@repo/db';
import type { DbClient } from '@repo/db';
import {
  createCommunicationSchema, sendCommunicationSchema,
  communicationListSchema, idParamSchema,
} from '@repo/shared';
import { router } from '../trpc/router';
import { tenantProcedure, requirePermission } from '../trpc/procedures';
import { resolveAudience, resolveChannels, createDeliveries } from '../lib/notification-engine';

async function resolveCommunityId(db: DbClient): Promise<string> {
  const rows = await db
    .select({ id: communities.id })
    .from(communities)
    .limit(1);
  if (!rows[0]) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'No community found for this tenant' });
  }
  return rows[0].id;
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

export const communicationRouter = router({
  create: tenantProcedure
    .use(requirePermission('org:communications:manage'))
    .input(createCommunicationSchema)
    .mutation(async ({ ctx, input }) => {
      const communityId = await resolveCommunityId(ctx.db);

      const [comm] = await ctx.db.insert(communications).values({
        tenantId: ctx.tenantId,
        communityId,
        communicationType: input.communicationType,
        subject: input.subject,
        body: input.body,
        bodyHtml: input.bodyHtml,
        priority: input.priority,
        status: input.scheduledAt ? 'scheduled' : 'draft',
        audienceType: input.audienceType,
        audienceFilter: input.audienceFilter ?? {},
        channels: input.channels,
        scheduledAt: input.scheduledAt,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      }).returning();

      return comm!;
    }),

  list: tenantProcedure
    .input(communicationListSchema)
    .query(async ({ ctx, input }) => {
      const conditions: SQL[] = [];

      if (input.communicationType?.length) {
        conditions.push(inArray(communications.communicationType, input.communicationType));
      }
      if (input.status?.length) {
        conditions.push(inArray(communications.status, input.status));
      }
      if (input.priority) {
        conditions.push(eq(communications.priority, input.priority));
      }
      if (input.dateFrom) {
        conditions.push(gte(communications.createdAt, input.dateFrom));
      }
      if (input.dateTo) {
        conditions.push(lte(communications.createdAt, input.dateTo));
      }
      if (input.cursor) {
        conditions.push(lte(communications.id, input.cursor));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await ctx.db
        .select({
          id: communications.id,
          communicationType: communications.communicationType,
          subject: communications.subject,
          priority: communications.priority,
          status: communications.status,
          audienceType: communications.audienceType,
          channels: communications.channels,
          scheduledAt: communications.scheduledAt,
          sentAt: communications.sentAt,
          createdAt: communications.createdAt,
          sentByName: users.displayName,
        })
        .from(communications)
        .leftJoin(users, eq(communications.sentBy, users.id))
        .where(where)
        .orderBy(desc(communications.createdAt))
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
        .from(communications)
        .where(eq(communications.id, input.id))
        .limit(1);

      if (!rows[0]) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Communication not found' });
      }

      const deliveryStats = await ctx.db
        .select({
          status: communicationDeliveries.status,
          count: count(),
        })
        .from(communicationDeliveries)
        .where(eq(communicationDeliveries.communicationId, input.id))
        .groupBy(communicationDeliveries.status);

      return {
        ...rows[0],
        deliveryStats: deliveryStats.reduce<Record<string, number>>(
          (acc, row) => { acc[row.status] = Number(row.count); return acc; },
          {},
        ),
      };
    }),

  send: tenantProcedure
    .use(requirePermission('org:communications:manage'))
    .input(sendCommunicationSchema)
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(communications)
        .where(eq(communications.id, input.id))
        .limit(1);

      if (!rows[0]) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Communication not found' });
      }

      const comm = rows[0];
      if (comm.status !== 'draft' && comm.status !== 'scheduled') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot send communication in '${comm.status}' status`,
        });
      }

      const audience = await resolveAudience(
        ctx.db,
        comm.communityId,
        comm.audienceType as Parameters<typeof resolveAudience>[2],
        (comm.audienceFilter ?? {}) as Record<string, unknown>,
      );

      if (audience.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No members match the selected audience',
        });
      }

      const memberChannels = audience.map((member) => ({
        memberId: member.id,
        channels: resolveChannels(member, comm.priority as Parameters<typeof resolveChannels>[1], comm.communicationType),
      }));

      const userId = await resolveInternalUserId(ctx.db, ctx.auth.userId);
      const deliveryCount = await createDeliveries(ctx.db, comm.id, ctx.tenantId, memberChannels);

      const [updated] = await ctx.db
        .update(communications)
        .set({
          status: 'sent',
          sentAt: new Date(),
          sentBy: userId,
        })
        .where(eq(communications.id, input.id))
        .returning();

      return { ...updated!, deliveryCount };
    }),

  getDeliveryStatus: tenantProcedure
    .input(idParamSchema)
    .query(async ({ ctx, input }) => {
      const byChannel = await ctx.db
        .select({
          channel: communicationDeliveries.channel,
          status: communicationDeliveries.status,
          count: count(),
        })
        .from(communicationDeliveries)
        .where(eq(communicationDeliveries.communicationId, input.id))
        .groupBy(communicationDeliveries.channel, communicationDeliveries.status);

      const totalRow = await ctx.db
        .select({ count: count() })
        .from(communicationDeliveries)
        .where(eq(communicationDeliveries.communicationId, input.id));

      return {
        total: Number(totalRow[0]?.count ?? 0),
        byChannel: byChannel.map((r) => ({
          channel: r.channel,
          status: r.status,
          count: Number(r.count),
        })),
      };
    }),
});

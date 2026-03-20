import { TRPCError } from '@trpc/server';
import { eq, asc, sql } from 'drizzle-orm';
import { meetingAgendaItems } from '@repo/db';
import {
  createAgendaItemSchema, updateAgendaItemSchema,
  reorderAgendaItemsSchema, recordAgendaVoteSchema, idParamSchema,
} from '@repo/shared';
import { router } from '../trpc/router';
import { tenantProcedure, requirePermission } from '../trpc/procedures';

export const agendaItemRouter = router({
  list: tenantProcedure
    .input(idParamSchema)
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(meetingAgendaItems)
        .where(eq(meetingAgendaItems.meetingId, input.id))
        .orderBy(asc(meetingAgendaItems.sortOrder));

      return rows;
    }),

  create: tenantProcedure
    .use(requirePermission('org:meetings:manage'))
    .input(createAgendaItemSchema)
    .mutation(async ({ ctx, input }) => {
      const maxOrder = await ctx.db
        .select({ max: sql<number>`COALESCE(MAX(${meetingAgendaItems.sortOrder}), -1)` })
        .from(meetingAgendaItems)
        .where(eq(meetingAgendaItems.meetingId, input.meetingId));

      const nextOrder = (maxOrder[0]?.max ?? -1) + 1;

      const [item] = await ctx.db.insert(meetingAgendaItems).values({
        tenantId: ctx.tenantId,
        meetingId: input.meetingId,
        itemType: input.itemType,
        title: input.title,
        description: input.description,
        durationMinutes: input.durationMinutes,
        presenterId: input.presenterId,
        sortOrder: nextOrder,
      }).returning();

      return item!;
    }),

  update: tenantProcedure
    .use(requirePermission('org:meetings:manage'))
    .input(updateAgendaItemSchema)
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(meetingAgendaItems)
        .where(eq(meetingAgendaItems.id, input.id))
        .limit(1);

      if (!rows[0]) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Agenda item not found' });
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (input.title !== undefined) updates.title = input.title;
      if (input.description !== undefined) updates.description = input.description;
      if (input.durationMinutes !== undefined) updates.durationMinutes = input.durationMinutes;
      if (input.presenterId !== undefined) updates.presenterId = input.presenterId;
      if (input.resolution !== undefined) updates.resolution = input.resolution;
      if (input.itemType !== undefined) updates.itemType = input.itemType;

      const [updated] = await ctx.db
        .update(meetingAgendaItems)
        .set(updates)
        .where(eq(meetingAgendaItems.id, input.id))
        .returning();

      return updated!;
    }),

  recordVote: tenantProcedure
    .use(requirePermission('org:meetings:manage'))
    .input(recordAgendaVoteSchema)
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(meetingAgendaItems)
        .where(eq(meetingAgendaItems.id, input.id))
        .limit(1);

      if (!rows[0]) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Agenda item not found' });
      }

      const [updated] = await ctx.db
        .update(meetingAgendaItems)
        .set({ voteResult: input.voteResult, updatedAt: new Date() })
        .where(eq(meetingAgendaItems.id, input.id))
        .returning();

      return updated!;
    }),

  reorder: tenantProcedure
    .use(requirePermission('org:meetings:manage'))
    .input(reorderAgendaItemsSchema)
    .mutation(async ({ ctx, input }) => {
      for (const item of input.items) {
        await ctx.db
          .update(meetingAgendaItems)
          .set({ sortOrder: item.sortOrder, updatedAt: new Date() })
          .where(eq(meetingAgendaItems.id, item.id));
      }

      const rows = await ctx.db
        .select()
        .from(meetingAgendaItems)
        .where(eq(meetingAgendaItems.meetingId, input.meetingId))
        .orderBy(asc(meetingAgendaItems.sortOrder));

      return rows;
    }),
});

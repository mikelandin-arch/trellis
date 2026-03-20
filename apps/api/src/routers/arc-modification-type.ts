import { TRPCError } from '@trpc/server';
import { eq, asc } from 'drizzle-orm';
import { arcModificationTypes } from '@repo/db';
import {
  arcModificationTypeCreateSchema,
  arcModificationTypeUpdateSchema,
} from '@repo/shared';
import { router } from '../trpc/router';
import { tenantProcedure, requirePermission } from '../trpc/procedures';

export const arcModificationTypeRouter = router({

  list: tenantProcedure
    .query(async ({ ctx }) => {
      return ctx.db
        .select()
        .from(arcModificationTypes)
        .where(eq(arcModificationTypes.isActive, true))
        .orderBy(
          asc(arcModificationTypes.complexityTier),
          asc(arcModificationTypes.sortOrder),
          asc(arcModificationTypes.name),
        );
    }),

  create: tenantProcedure
    .use(requirePermission('org:arc:manage'))
    .input(arcModificationTypeCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const [modType] = await ctx.db.insert(arcModificationTypes).values({
        tenantId: ctx.tenantId,
        name: input.name,
        complexityTier: input.complexityTier,
        requiresSiteVisit: input.requiresSiteVisit,
        defaultReviewDays: input.defaultReviewDays,
        requiredDocuments: input.requiredDocuments,
        feeAmount: input.feeAmount != null ? String(input.feeAmount) : null,
        sortOrder: input.sortOrder,
      }).returning();

      return modType!;
    }),

  update: tenantProcedure
    .use(requirePermission('org:arc:manage'))
    .input(arcModificationTypeUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select()
        .from(arcModificationTypes)
        .where(eq(arcModificationTypes.id, input.id))
        .limit(1);

      if (!existing[0]) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Modification type ${input.id} not found` });
      }

      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates['name'] = input.name;
      if (input.complexityTier !== undefined) updates['complexityTier'] = input.complexityTier;
      if (input.requiresSiteVisit !== undefined) updates['requiresSiteVisit'] = input.requiresSiteVisit;
      if (input.defaultReviewDays !== undefined) updates['defaultReviewDays'] = input.defaultReviewDays;
      if (input.requiredDocuments !== undefined) updates['requiredDocuments'] = input.requiredDocuments;
      if (input.feeAmount !== undefined) updates['feeAmount'] = input.feeAmount != null ? String(input.feeAmount) : null;
      if (input.isActive !== undefined) updates['isActive'] = input.isActive;
      if (input.sortOrder !== undefined) updates['sortOrder'] = input.sortOrder;

      if (Object.keys(updates).length === 0) {
        return existing[0];
      }

      const [updated] = await ctx.db
        .update(arcModificationTypes)
        .set(updates)
        .where(eq(arcModificationTypes.id, input.id))
        .returning();

      return updated!;
    }),
});

import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { violationCategories } from '@repo/db';
import {
  violationCategoryCreateSchema,
  violationCategoryUpdateSchema,
} from '@repo/shared';
import { router } from '../trpc/router';
import { tenantProcedure, requirePermission } from '../trpc/procedures';

export const violationCategoryRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(violationCategories)
      .orderBy(violationCategories.sortOrder, violationCategories.name);
  }),

  create: tenantProcedure
    .use(requirePermission('org:violations:create'))
    .input(violationCategoryCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .insert(violationCategories)
        .values({
          tenantId: ctx.tenantId,
          parentId: input.parentId,
          name: input.name,
          description: input.description,
          defaultSeverity: input.defaultSeverity,
          defaultCureDays: input.defaultCureDays,
          defaultFineAmount: input.defaultFineAmount != null
            ? String(input.defaultFineAmount)
            : null,
          governingDocSection: input.governingDocSection,
          sortOrder: input.sortOrder,
        })
        .returning();

      return row!;
    }),

  update: tenantProcedure
    .use(requirePermission('org:violations:create'))
    .input(violationCategoryUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;

      const existing = await ctx.db
        .select({ id: violationCategories.id })
        .from(violationCategories)
        .where(eq(violationCategories.id, id))
        .limit(1);

      if (!existing[0]) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Category ${id} not found` });
      }

      const updateValues: Record<string, unknown> = {};
      if (fields.name !== undefined) updateValues['name'] = fields.name;
      if (fields.description !== undefined) updateValues['description'] = fields.description;
      if (fields.defaultSeverity !== undefined) updateValues['defaultSeverity'] = fields.defaultSeverity;
      if (fields.defaultCureDays !== undefined) updateValues['defaultCureDays'] = fields.defaultCureDays;
      if (fields.defaultFineAmount !== undefined) {
        updateValues['defaultFineAmount'] = fields.defaultFineAmount != null
          ? String(fields.defaultFineAmount)
          : null;
      }
      if (fields.governingDocSection !== undefined) updateValues['governingDocSection'] = fields.governingDocSection;
      if (fields.isActive !== undefined) updateValues['isActive'] = fields.isActive;
      if (fields.sortOrder !== undefined) updateValues['sortOrder'] = fields.sortOrder;

      if (Object.keys(updateValues).length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No fields to update' });
      }

      const [updated] = await ctx.db
        .update(violationCategories)
        .set(updateValues)
        .where(eq(violationCategories.id, id))
        .returning();

      return updated!;
    }),
});

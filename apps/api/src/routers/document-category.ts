import { TRPCError } from '@trpc/server';
import { eq, asc } from 'drizzle-orm';
import { documentCategories } from '@repo/db';
import {
  documentCategoryCreateSchema, documentCategoryUpdateSchema,
} from '@repo/shared';
import { router } from '../trpc/router';
import { tenantProcedure, requirePermission } from '../trpc/procedures';

export const documentCategoryRouter = router({
  list: tenantProcedure
    .query(async ({ ctx }) => {
      const rows = await ctx.db
        .select()
        .from(documentCategories)
        .orderBy(asc(documentCategories.sortOrder), asc(documentCategories.name));

      return rows;
    }),

  create: tenantProcedure
    .use(requirePermission('org:documents:manage'))
    .input(documentCategoryCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const [category] = await ctx.db.insert(documentCategories).values({
        tenantId: ctx.tenantId,
        name: input.name,
        parentId: input.parentId,
        sortOrder: input.sortOrder,
      }).returning();

      return category!;
    }),

  update: tenantProcedure
    .use(requirePermission('org:documents:manage'))
    .input(documentCategoryUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(documentCategories)
        .where(eq(documentCategories.id, input.id))
        .limit(1);

      if (!rows[0]) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Category not found' });
      }

      if (rows[0].isSystem) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'System categories cannot be modified',
        });
      }

      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;

      const [updated] = await ctx.db
        .update(documentCategories)
        .set(updates)
        .where(eq(documentCategories.id, input.id))
        .returning();

      return updated!;
    }),
});

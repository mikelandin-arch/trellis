import { TRPCError } from '@trpc/server';
import { eq, gt } from 'drizzle-orm';
import { properties } from '@repo/db';
import { paginationSchema, idParamSchema } from '@repo/shared';
import { router } from '../trpc/router';
import { tenantProcedure } from '../trpc/procedures';

export const propertyRouter = router({
  list: tenantProcedure
    .input(paginationSchema)
    .query(async ({ ctx, input }) => {
      const conditions = input.cursor
        ? gt(properties.id, input.cursor)
        : undefined;

      const rows = await ctx.db
        .select()
        .from(properties)
        .where(conditions)
        .orderBy(properties.id)
        .limit(input.limit);

      return {
        items: rows,
        nextCursor: rows.length === input.limit ? rows[rows.length - 1]?.id : undefined,
      };
    }),

  getById: tenantProcedure
    .input(idParamSchema)
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(properties)
        .where(eq(properties.id, input.id))
        .limit(1);

      const property = rows[0];
      if (!property) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Property ${input.id} not found`,
        });
      }

      return property;
    }),
});

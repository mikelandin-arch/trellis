import { TRPCError } from '@trpc/server';
import { eq, and, inArray, sql as drizzleSql, lte } from 'drizzle-orm';
import { z } from 'zod';
import { charges } from '@repo/db';
import { chargeListFiltersSchema, waiveChargeSchema } from '@repo/shared';
import { router } from '../trpc/router';
import { tenantProcedure, requirePermission } from '../trpc/procedures';

export const chargeRouter = router({
  listByMember: tenantProcedure
    .input(chargeListFiltersSchema.extend({ memberId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(charges.memberId, input.memberId)];

      if (input.status && input.status.length > 0) {
        conditions.push(inArray(charges.status, input.status));
      }
      if (input.chargeType && input.chargeType.length > 0) {
        conditions.push(inArray(charges.chargeType, input.chargeType));
      }
      if (input.dateFrom) {
        conditions.push(
          drizzleSql`${charges.dueDate} >= ${input.dateFrom.toISOString().slice(0, 10)}`,
        );
      }
      if (input.dateTo) {
        conditions.push(
          drizzleSql`${charges.dueDate} <= ${input.dateTo.toISOString().slice(0, 10)}`,
        );
      }

      return ctx.db
        .select()
        .from(charges)
        .where(and(...conditions))
        .orderBy(charges.dueDate)
        .limit(input.limit);
    }),

  listByProperty: tenantProcedure
    .input(chargeListFiltersSchema.extend({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(charges.propertyId, input.propertyId)];

      if (input.status && input.status.length > 0) {
        conditions.push(inArray(charges.status, input.status));
      }

      return ctx.db
        .select()
        .from(charges)
        .where(and(...conditions))
        .orderBy(charges.dueDate)
        .limit(input.limit);
    }),

  listOverdue: tenantProcedure
    .use(requirePermission('org:finance:manage'))
    .input(z.object({ communityId: z.string().uuid() }))
    .query(async ({ ctx }) => {
      const now = new Date().toISOString().slice(0, 10);

      const rows = await ctx.db
        .select({
          id: charges.id,
          memberId: charges.memberId,
          propertyId: charges.propertyId,
          chargeType: charges.chargeType,
          description: charges.description,
          amount: charges.amount,
          balanceRemaining: charges.balanceRemaining,
          dueDate: charges.dueDate,
          fundTag: charges.fundTag,
          status: charges.status,
          agingBucket: drizzleSql<string>`
            CASE
              WHEN ${charges.dueDate} <= (CURRENT_DATE - INTERVAL '90 days') THEN '90+'
              WHEN ${charges.dueDate} <= (CURRENT_DATE - INTERVAL '60 days') THEN '60'
              WHEN ${charges.dueDate} <= (CURRENT_DATE - INTERVAL '30 days') THEN '30'
              ELSE 'current'
            END
          `.as('aging_bucket'),
        })
        .from(charges)
        .where(
          and(
            inArray(charges.status, ['overdue', 'partial', 'due']),
            lte(charges.dueDate, now),
          ),
        )
        .orderBy(charges.dueDate);

      return rows;
    }),

  waive: tenantProcedure
    .use(requirePermission('org:finance:manage'))
    .input(waiveChargeSchema)
    .mutation(async ({ ctx, input }) => {
      const [charge] = await ctx.db
        .select()
        .from(charges)
        .where(eq(charges.id, input.chargeId))
        .limit(1);

      if (!charge) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Charge not found' });
      }

      if (charge.status === 'paid' || charge.status === 'waived' || charge.status === 'void') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot waive a charge with status '${charge.status}'`,
        });
      }

      const [updated] = await ctx.db
        .update(charges)
        .set({
          status: 'waived',
          balanceRemaining: '0.00',
          updatedAt: new Date(),
        })
        .where(eq(charges.id, input.chargeId))
        .returning();

      ctx.req.log.info(
        { chargeId: input.chargeId, reason: input.reason, tenantId: ctx.tenantId },
        'Charge waived',
      );

      return updated;
    }),
});

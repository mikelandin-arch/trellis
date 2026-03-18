import { TRPCError } from '@trpc/server';
import { eq, and, inArray, sql as drizzleSql, desc } from 'drizzle-orm';
import { z } from 'zod';
import {
  adminDb,
  tenants,
  charges,
  payments,
  paymentApplications,
  autopayEnrollments,
  communities,
  properties,
  propertyOwnerships,
} from '@repo/db';
import {
  createPaymentIntentSchema,
  setupAutopaySchema,
  paymentListFiltersSchema,
} from '@repo/shared';
import { router } from '../trpc/router';
import { tenantProcedure, requirePermission } from '../trpc/procedures';
import { stripe, calculateApplicationFee } from '../lib/stripe';
import { getPaymentApplicationOrder } from '../lib/collections';

export const paymentRouter = router({
  createPaymentIntent: tenantProcedure
    .input(createPaymentIntentSchema)
    .mutation(async ({ ctx, input }) => {
      const [tenant] = await adminDb
        .select({
          stripeConnectAccountId: tenants.stripeConnectAccountId,
          stripeConnectOnboarded: tenants.stripeConnectOnboarded,
        })
        .from(tenants)
        .where(eq(tenants.id, ctx.tenantId))
        .limit(1);

      if (!tenant?.stripeConnectAccountId || !tenant.stripeConnectOnboarded) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'HOA has not completed Stripe onboarding',
        });
      }

      const amountCents = Math.round(input.amount * 100);
      const appFee = calculateApplicationFee(amountCents, input.paymentMethod);

      const paymentMethodTypes: ('us_bank_account' | 'card')[] =
        input.paymentMethod === 'ach' ? ['us_bank_account'] : ['card'];

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: 'usd',
        payment_method_types: paymentMethodTypes,
        application_fee_amount: appFee > 0 ? appFee : undefined,
        transfer_data: {
          destination: tenant.stripeConnectAccountId,
        },
        metadata: {
          tenantId: String(ctx.tenantId),
          memberId: input.memberId,
          chargeIds: input.chargeIds?.join(',') ?? '',
        },
      });

      const dbMethod =
        input.paymentMethod === 'ach' ? 'ach' : 'credit_card';

      const paymentRows = await ctx.db
        .insert(payments)
        .values({
          tenantId: ctx.tenantId,
          memberId: input.memberId,
          amount: String(input.amount),
          paymentMethod: dbMethod,
          stripePaymentIntentId: paymentIntent.id,
          status: 'processing',
          paymentDate: new Date().toISOString().slice(0, 10),
        })
        .returning();

      const payment = paymentRows[0]!;

      return {
        paymentId: payment.id,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    }),

  listByMember: tenantProcedure
    .input(paymentListFiltersSchema.extend({ memberId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(payments.memberId, input.memberId)];

      if (input.status && input.status.length > 0) {
        conditions.push(inArray(payments.status, input.status));
      }
      if (input.dateFrom) {
        conditions.push(
          drizzleSql`${payments.paymentDate} >= ${input.dateFrom.toISOString().slice(0, 10)}`,
        );
      }
      if (input.dateTo) {
        conditions.push(
          drizzleSql`${payments.paymentDate} <= ${input.dateTo.toISOString().slice(0, 10)}`,
        );
      }

      return ctx.db
        .select()
        .from(payments)
        .where(and(...conditions))
        .orderBy(desc(payments.paymentDate))
        .limit(input.limit);
    }),

  applyPayment: tenantProcedure
    .use(requirePermission('org:finance:manage'))
    .input(z.object({ paymentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [payment] = await ctx.db
        .select()
        .from(payments)
        .where(eq(payments.id, input.paymentId))
        .for('update')
        .limit(1);

      if (!payment) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Payment not found' });
      }

      if (payment.status !== 'succeeded') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Payment must be in succeeded status to apply',
        });
      }

      const existingApplications = await ctx.db
        .select({ id: paymentApplications.id })
        .from(paymentApplications)
        .where(eq(paymentApplications.paymentId, input.paymentId))
        .limit(1);

      if (existingApplications.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Payment has already been applied',
        });
      }

      const community = await ctx.db
        .select({ stateCode: communities.stateCode })
        .from(communities)
        .innerJoin(properties, eq(properties.communityId, communities.id))
        .innerJoin(
          propertyOwnerships,
          and(
            eq(propertyOwnerships.propertyId, properties.id),
            eq(propertyOwnerships.memberId, payment.memberId),
          ),
        )
        .limit(1);

      const stateCode = community[0]?.stateCode ?? 'WA';

      const applicationOrder = await getPaymentApplicationOrder(
        ctx.db,
        ctx.tenantId,
        stateCode,
      );

      const outstandingCharges = await ctx.db
        .select()
        .from(charges)
        .where(
          and(
            eq(charges.memberId, payment.memberId),
            inArray(charges.status, ['due', 'overdue', 'partial']),
          ),
        )
        .orderBy(charges.dueDate)
        .for('update');

      const sortedCharges = [...outstandingCharges].sort((a, b) => {
        const aIdx = applicationOrder.indexOf(a.chargeType);
        const bIdx = applicationOrder.indexOf(b.chargeType);
        const aPriority = aIdx === -1 ? applicationOrder.length : aIdx;
        const bPriority = bIdx === -1 ? applicationOrder.length : bIdx;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });

      let remaining = Number(payment.amount);
      const applications: { chargeId: string; applied: number }[] = [];

      for (const charge of sortedCharges) {
        if (remaining <= 0) break;

        const balance = Number(charge.balanceRemaining);
        if (balance <= 0) continue;

        const toApply = Math.min(remaining, balance);
        remaining = Math.round((remaining - toApply) * 100) / 100;

        const newBalance = Math.round((balance - toApply) * 100) / 100;
        const newStatus = newBalance <= 0 ? 'paid' : 'partial';

        await ctx.db
          .update(charges)
          .set({
            balanceRemaining: String(newBalance.toFixed(2)),
            status: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(charges.id, charge.id));

        await ctx.db.insert(paymentApplications).values({
          tenantId: ctx.tenantId,
          paymentId: payment.id,
          chargeId: charge.id,
          amountApplied: String(toApply.toFixed(2)),
        });

        applications.push({ chargeId: charge.id, applied: toApply });
      }

      return { applied: applications, remainingCredit: remaining };
    }),

  setupAutopay: tenantProcedure
    .input(setupAutopaySchema.extend({ memberId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select({ id: autopayEnrollments.id })
        .from(autopayEnrollments)
        .where(
          and(
            eq(autopayEnrollments.memberId, input.memberId),
            eq(autopayEnrollments.isActive, true),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        const [updated] = await ctx.db
          .update(autopayEnrollments)
          .set({
            stripePaymentMethodId: input.stripePaymentMethodId,
            paymentMethodType: input.paymentMethodType,
            scheduleDay: input.scheduleDay,
            updatedAt: new Date(),
          })
          .where(eq(autopayEnrollments.id, existing[0]!.id))
          .returning();
        return updated;
      }

      const [enrollment] = await ctx.db
        .insert(autopayEnrollments)
        .values({
          tenantId: ctx.tenantId,
          memberId: input.memberId,
          stripePaymentMethodId: input.stripePaymentMethodId,
          paymentMethodType: input.paymentMethodType,
          scheduleDay: input.scheduleDay,
          authorizedAt: new Date(),
        })
        .returning();

      return enrollment;
    }),

  cancelAutopay: tenantProcedure
    .input(z.object({ memberId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [enrollment] = await ctx.db
        .select()
        .from(autopayEnrollments)
        .where(
          and(
            eq(autopayEnrollments.memberId, input.memberId),
            eq(autopayEnrollments.isActive, true),
          ),
        )
        .limit(1);

      if (!enrollment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No active autopay enrollment found',
        });
      }

      const [updated] = await ctx.db
        .update(autopayEnrollments)
        .set({
          isActive: false,
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(autopayEnrollments.id, enrollment.id))
        .returning();

      return updated;
    }),
});

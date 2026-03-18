import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { adminDb, tenants } from '@repo/db';
import { router } from '../trpc/router';
import { tenantProcedure, requirePermission } from '../trpc/procedures';
import { stripe } from '../lib/stripe';

export const stripeConnectRouter = router({
  createConnectedAccount: tenantProcedure
    .use(requirePermission('org:finance:manage'))
    .mutation(async ({ ctx }) => {
      const [tenant] = await adminDb
        .select({
          id: tenants.id,
          name: tenants.name,
          stripeConnectAccountId: tenants.stripeConnectAccountId,
        })
        .from(tenants)
        .where(eq(tenants.id, ctx.tenantId))
        .limit(1);

      if (!tenant) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant not found' });
      }

      if (tenant.stripeConnectAccountId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Connected account already exists',
        });
      }

      const account = await stripe.accounts.create({
        type: 'express',
        metadata: { tenantId: String(ctx.tenantId) },
        business_profile: { name: tenant.name },
      });

      await adminDb
        .update(tenants)
        .set({ stripeConnectAccountId: account.id, updatedAt: new Date() })
        .where(eq(tenants.id, ctx.tenantId));

      return { accountId: account.id };
    }),

  getOnboardingLink: tenantProcedure
    .use(requirePermission('org:finance:manage'))
    .input(z.object({ refreshUrl: z.string().url(), returnUrl: z.string().url() }))
    .query(async ({ ctx, input }) => {
      const [tenant] = await adminDb
        .select({ stripeConnectAccountId: tenants.stripeConnectAccountId })
        .from(tenants)
        .where(eq(tenants.id, ctx.tenantId))
        .limit(1);

      if (!tenant?.stripeConnectAccountId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No connected account. Create one first.',
        });
      }

      const link = await stripe.accountLinks.create({
        account: tenant.stripeConnectAccountId,
        refresh_url: input.refreshUrl,
        return_url: input.returnUrl,
        type: 'account_onboarding',
      });

      return { url: link.url };
    }),

  getAccountStatus: tenantProcedure.query(async ({ ctx }) => {
    const [tenant] = await adminDb
      .select({
        stripeConnectAccountId: tenants.stripeConnectAccountId,
        stripeConnectOnboarded: tenants.stripeConnectOnboarded,
      })
      .from(tenants)
      .where(eq(tenants.id, ctx.tenantId))
      .limit(1);

    if (!tenant?.stripeConnectAccountId) {
      return {
        hasAccount: false as const,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      };
    }

    const account = await stripe.accounts.retrieve(tenant.stripeConnectAccountId);

    return {
      hasAccount: true as const,
      chargesEnabled: account.charges_enabled ?? false,
      payoutsEnabled: account.payouts_enabled ?? false,
      detailsSubmitted: account.details_submitted ?? false,
    };
  }),

  getDashboardLink: tenantProcedure
    .use(requirePermission('org:finance:manage'))
    .query(async ({ ctx }) => {
      const [tenant] = await adminDb
        .select({ stripeConnectAccountId: tenants.stripeConnectAccountId })
        .from(tenants)
        .where(eq(tenants.id, ctx.tenantId))
        .limit(1);

      if (!tenant?.stripeConnectAccountId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No connected account.',
        });
      }

      const link = await stripe.accounts.createLoginLink(
        tenant.stripeConnectAccountId,
      );

      return { url: link.url };
    }),
});

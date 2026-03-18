import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { adminDb, tenants, payments } from '@repo/db';
import { stripe } from '../lib/stripe';

export async function stripeWebhookPlugin(app: FastifyInstance): Promise<void> {
  await app.register(async function stripeWebhookScope(scope) {
    scope.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer' },
      (_req, body, done) => {
        done(null, body);
      },
    );

    scope.post(
      '/webhooks/stripe',
      async (req: FastifyRequest, reply: FastifyReply) => {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        req.log.error('STRIPE_WEBHOOK_SECRET not configured');
        return reply.code(500).send({ error: 'Webhook secret not configured' });
      }

      const signature = req.headers['stripe-signature'];
      if (!signature) {
        return reply.code(400).send({ error: 'Missing stripe-signature header' });
      }

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(
          req.body as Buffer,
          signature as string,
          webhookSecret,
        );
      } catch (err) {
        req.log.warn({ err }, 'Stripe webhook signature verification failed');
        return reply.code(400).send({ error: 'Invalid signature' });
      }

      req.log.info({ eventType: event.type, eventId: event.id }, 'Stripe webhook received');

      try {
        switch (event.type) {
          case 'payment_intent.succeeded':
            await handlePaymentIntentSucceeded(event.data.object, req);
            break;
          case 'payment_intent.payment_failed':
            await handlePaymentIntentFailed(event.data.object, req);
            break;
          case 'charge.refunded':
            await handleChargeRefunded(event.data.object, req);
            break;
          case 'account.updated':
            await handleAccountUpdated(event.data.object, req);
            break;
          default:
            req.log.info({ eventType: event.type }, 'Unhandled Stripe event type');
        }
      } catch (err) {
        req.log.error({ err, eventType: event.type }, 'Error processing Stripe webhook');
      }

      return reply.send({ received: true });
    },
  );
  });
}

async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
  req: FastifyRequest,
): Promise<void> {
  const [payment] = await adminDb
    .update(payments)
    .set({ status: 'succeeded', updatedAt: new Date() })
    .where(eq(payments.stripePaymentIntentId, paymentIntent.id))
    .returning();

  if (payment) {
    req.log.info(
      { paymentId: payment.id, stripePI: paymentIntent.id },
      'Payment marked succeeded',
    );
  } else {
    req.log.warn(
      { stripePI: paymentIntent.id },
      'No matching payment record for succeeded PI',
    );
  }
}

async function handlePaymentIntentFailed(
  paymentIntent: Stripe.PaymentIntent,
  req: FastifyRequest,
): Promise<void> {
  const failureMessage =
    paymentIntent.last_payment_error?.message ?? 'Unknown failure';

  const [payment] = await adminDb
    .update(payments)
    .set({
      status: 'failed',
      notes: failureMessage,
      updatedAt: new Date(),
    })
    .where(eq(payments.stripePaymentIntentId, paymentIntent.id))
    .returning();

  if (payment) {
    req.log.info(
      { paymentId: payment.id, stripePI: paymentIntent.id, failureMessage },
      'Payment marked failed',
    );
  }
}

async function handleChargeRefunded(
  charge: Stripe.Charge,
  req: FastifyRequest,
): Promise<void> {
  if (!charge.payment_intent) return;

  const piId =
    typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent.id;

  const [payment] = await adminDb
    .update(payments)
    .set({ status: 'refunded', updatedAt: new Date() })
    .where(eq(payments.stripePaymentIntentId, piId))
    .returning();

  if (payment) {
    req.log.info(
      { paymentId: payment.id, stripeCharge: charge.id },
      'Payment marked refunded',
    );
  }
}

async function handleAccountUpdated(
  account: Stripe.Account,
  req: FastifyRequest,
): Promise<void> {
  const onboarded =
    (account.charges_enabled ?? false) && (account.details_submitted ?? false);

  await adminDb
    .update(tenants)
    .set({
      stripeConnectOnboarded: onboarded,
      updatedAt: new Date(),
    })
    .where(eq(tenants.stripeConnectAccountId, account.id));

  req.log.info(
    { stripeAccountId: account.id, onboarded },
    'Connected account status updated',
  );
}

import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  throw new Error('STRIPE_SECRET_KEY is required');
}

export const stripe = new Stripe(key, {
  typescript: true,
});

const CARD_RATE = 0.029;
const CARD_FIXED = 30; // cents
const ACH_RATE = 0.008;
const ACH_CAP_CENTS = 500;

export function calculateApplicationFee(
  amountCents: number,
  method: 'ach' | 'card',
): number {
  if (method === 'ach') {
    return 0;
  }
  return Math.round(amountCents * CARD_RATE + CARD_FIXED);
}

export function calculatePlatformAchCost(amountCents: number): number {
  return Math.min(Math.round(amountCents * ACH_RATE), ACH_CAP_CENTS);
}

import { z } from 'zod';
import { paginationSchema } from './common';

// ── Payment Method ─────────────────────────────────────────────────────

export const paymentMethodSchema = z.enum(['ach', 'card']);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const paymentStatusSchema = z.enum([
  'pending',
  'processing',
  'succeeded',
  'failed',
  'refunded',
  'disputed',
]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

// ── Create Payment Intent ──────────────────────────────────────────────

export const createPaymentIntentSchema = z.object({
  memberId: z.string().uuid(),
  amount: z.number().positive().multipleOf(0.01),
  paymentMethod: paymentMethodSchema,
  chargeIds: z.array(z.string().uuid()).min(1).optional(),
});
export type CreatePaymentIntent = z.infer<typeof createPaymentIntentSchema>;

// ── Setup Autopay ──────────────────────────────────────────────────────

export const setupAutopaySchema = z.object({
  stripePaymentMethodId: z.string().min(1),
  paymentMethodType: paymentMethodSchema,
  scheduleDay: z.number().int().min(1).max(28),
});
export type SetupAutopay = z.infer<typeof setupAutopaySchema>;

// ── Payment List Filters ───────────────────────────────────────────────

export const paymentListFiltersSchema = paginationSchema.extend({
  memberId: z.string().uuid().optional(),
  status: z.array(paymentStatusSchema).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type PaymentListFilters = z.infer<typeof paymentListFiltersSchema>;

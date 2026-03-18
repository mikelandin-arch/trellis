import { z } from 'zod';
import { paginationSchema } from './common';

// ── Assessment Types ───────────────────────────────────────────────────

export const assessmentTypeSchema = z.enum([
  'regular',
  'special',
  'late_fee',
  'fine',
  'arc_fee',
  'transfer_fee',
]);
export type AssessmentType = z.infer<typeof assessmentTypeSchema>;

export const frequencySchema = z.enum([
  'monthly',
  'quarterly',
  'semi_annual',
  'annual',
  'one_time',
]);
export type Frequency = z.infer<typeof frequencySchema>;

export const chargeTypeSchema = z.enum([
  'assessment',
  'special_assessment',
  'late_fee',
  'interest',
  'fine',
  'arc_fee',
  'transfer_fee',
  'credit',
]);
export type ChargeType = z.infer<typeof chargeTypeSchema>;

export const chargeStatusSchema = z.enum([
  'pending',
  'due',
  'overdue',
  'partial',
  'paid',
  'waived',
  'void',
]);
export type ChargeStatus = z.infer<typeof chargeStatusSchema>;

export const fundTagSchema = z.enum([
  'operating',
  'reserve',
  'special',
  'custom',
]);
export type FundTag = z.infer<typeof fundTagSchema>;

// ── Create Assessment Schedule ─────────────────────────────────────────

export const createAssessmentScheduleSchema = z.object({
  communityId: z.string().uuid(),
  name: z.string().min(1).max(200),
  assessmentType: assessmentTypeSchema,
  frequency: frequencySchema,
  amount: z.number().positive().multipleOf(0.01),
  assessmentClass: z.string().min(1).max(50).default('standard'),
  fundAllocation: z
    .record(fundTagSchema, z.number().min(0).max(1))
    .default({ operating: 1.0 }),
  effectiveDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
});
export type CreateAssessmentSchedule = z.infer<typeof createAssessmentScheduleSchema>;

// ── Generate Charges ───────────────────────────────────────────────────

export const generateChargesSchema = z.object({
  communityId: z.string().uuid(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
});
export type GenerateCharges = z.infer<typeof generateChargesSchema>;

// ── Charge List Filters ────────────────────────────────────────────────

export const chargeListFiltersSchema = paginationSchema.extend({
  memberId: z.string().uuid().optional(),
  propertyId: z.string().uuid().optional(),
  status: z.array(chargeStatusSchema).optional(),
  chargeType: z.array(chargeTypeSchema).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type ChargeListFilters = z.infer<typeof chargeListFiltersSchema>;

// ── Waive Charge ───────────────────────────────────────────────────────

export const waiveChargeSchema = z.object({
  chargeId: z.string().uuid(),
  reason: z.string().min(1).max(2000),
});
export type WaiveCharge = z.infer<typeof waiveChargeSchema>;

// ── Rate History ───────────────────────────────────────────────────────

export const rateHistorySchema = z.object({
  scheduleId: z.string().uuid(),
});
export type RateHistory = z.infer<typeof rateHistorySchema>;

import { sql } from 'drizzle-orm';
import {
  pgTable, uuid, bigint, text, smallint, numeric,
  boolean, jsonb, timestamp, date, unique,
} from 'drizzle-orm/pg-core';
import { tenants } from './platform';
import { communities, properties, members } from './community';

export const assessmentSchedules = pgTable('assessment_schedules', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }).notNull().references(() => tenants.id),
  communityId: uuid('community_id').notNull().references(() => communities.id),
  name: text('name').notNull(),
  assessmentType: text('assessment_type').notNull(),
  frequency: text('frequency').notNull().default('monthly'),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  assessmentClass: text('assessment_class').notNull().default('standard'),
  fundAllocation: jsonb('fund_allocation').notNull().default({ operating: 1.0 }),
  lateFeeConfig: jsonb('late_fee_config').notNull().default({}),
  isActive: boolean('is_active').notNull().default(true),
  effectiveDate: date('effective_date').notNull(),
  endDate: date('end_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const assessmentRateHistory = pgTable('assessment_rate_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }).notNull().references(() => tenants.id),
  scheduleId: uuid('schedule_id').notNull().references(() => assessmentSchedules.id),
  previousAmount: numeric('previous_amount', { precision: 12, scale: 2 }),
  newAmount: numeric('new_amount', { precision: 12, scale: 2 }).notNull(),
  effectiveDate: date('effective_date').notNull(),
  approvedDate: date('approved_date'),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const charges = pgTable('charges', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }).notNull().references(() => tenants.id),
  memberId: uuid('member_id').notNull().references(() => members.id),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  scheduleId: uuid('schedule_id').references(() => assessmentSchedules.id),
  chargeType: text('charge_type').notNull(),
  description: text('description').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  balanceRemaining: numeric('balance_remaining', { precision: 12, scale: 2 }).notNull(),
  dueDate: date('due_date').notNull(),
  periodStart: date('period_start'),
  periodEnd: date('period_end'),
  fundTag: text('fund_tag').notNull().default('operating'),
  status: text('status').notNull().default('pending'),
  sourceType: text('source_type'),
  sourceId: uuid('source_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }).notNull().references(() => tenants.id),
  memberId: uuid('member_id').notNull().references(() => members.id),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text('payment_method').notNull(),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  stripeChargeId: text('stripe_charge_id'),
  stripeTransferId: text('stripe_transfer_id'),
  status: text('status').notNull().default('pending'),
  paymentDate: date('payment_date').notNull().default(sql`CURRENT_DATE`),
  checkDetails: jsonb('check_details'),
  referenceNumber: text('reference_number'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const paymentApplications = pgTable('payment_applications', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }).notNull().references(() => tenants.id),
  paymentId: uuid('payment_id').notNull().references(() => payments.id),
  chargeId: uuid('charge_id').notNull().references(() => charges.id),
  amountApplied: numeric('amount_applied', { precision: 12, scale: 2 }).notNull(),
  appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
  appliedBy: uuid('applied_by'),
});

export const autopayEnrollments = pgTable('autopay_enrollments', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }).notNull().references(() => tenants.id),
  memberId: uuid('member_id').notNull().references(() => members.id),
  stripePaymentMethodId: text('stripe_payment_method_id').notNull(),
  paymentMethodType: text('payment_method_type').notNull(),
  scheduleDay: smallint('schedule_day').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  authorizedAt: timestamp('authorized_at', { withTimezone: true }).notNull(),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique().on(t.tenantId, t.memberId),
]);

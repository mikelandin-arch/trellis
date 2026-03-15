import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import {
  pgTable, uuid, bigint, text, integer, smallint, numeric,
  boolean, jsonb, timestamp, date, unique,
} from 'drizzle-orm/pg-core';
import { tenants, users } from './platform';
import { communities, properties, members, complianceProfiles } from './community';

// ── Violations ──────────────────────────────────────────────────────────

export const violationCategories = pgTable('violation_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }).notNull().references(() => tenants.id),
  parentId: uuid('parent_id').references((): AnyPgColumn => violationCategories.id),
  name: text('name').notNull(),
  description: text('description'),
  defaultSeverity: text('default_severity').notNull().default('minor'),
  defaultCureDays: integer('default_cure_days').notNull().default(14),
  defaultFineAmount: numeric('default_fine_amount', { precision: 10, scale: 2 }),
  governingDocSection: text('governing_doc_section'),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const violations = pgTable('violations', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }).notNull().references(() => tenants.id),
  communityId: uuid('community_id').notNull().references(() => communities.id),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  categoryId: uuid('category_id').references(() => violationCategories.id),
  reportedBy: uuid('reported_by').references(() => members.id),
  assignedTo: uuid('assigned_to').references(() => members.id),
  status: text('status').notNull().default('reported'),
  severity: text('severity').notNull().default('minor'),
  title: text('title').notNull(),
  description: text('description'),
  governingDocSection: text('governing_doc_section'),
  reportedDate: date('reported_date').notNull().default(sql`CURRENT_DATE`),
  verifiedDate: date('verified_date'),
  cureDeadline: date('cure_deadline'),
  hearingDate: timestamp('hearing_date', { withTimezone: true }),
  resolvedDate: date('resolved_date'),
  fineAmount: numeric('fine_amount', { precision: 10, scale: 2 }),
  totalFinesAccrued: numeric('total_fines_accrued', { precision: 10, scale: 2 }).notNull().default('0'),
  complianceRules: jsonb('compliance_rules').notNull().default({}),
  source: text('source').notNull().default('board_inspection'),
  isAnonymousReport: boolean('is_anonymous_report').notNull().default(false),
  latitude: numeric('latitude', { precision: 10, scale: 7 }),
  longitude: numeric('longitude', { precision: 10, scale: 7 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // search_vector is GENERATED ALWAYS AS ... STORED — managed by PostgreSQL
});

export const violationTransitions = pgTable('violation_transitions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }).notNull().references(() => tenants.id),
  violationId: uuid('violation_id').notNull().references(() => violations.id),
  fromState: text('from_state').notNull(),
  toState: text('to_state').notNull(),
  triggeredBy: uuid('triggered_by').references(() => users.id),
  reason: text('reason'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const violationTransitionRules = pgTable('violation_transition_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }).references(() => tenants.id),
  profileId: uuid('profile_id').notNull().references(() => complianceProfiles.id),
  fromState: text('from_state').notNull(),
  toState: text('to_state').notNull(),
  requiresHearing: boolean('requires_hearing').notNull().default(false),
  minNoticeDays: integer('min_notice_days'),
  requiresCertifiedMail: boolean('requires_certified_mail').notNull().default(false),
  autoTransitionDays: integer('auto_transition_days'),
  conditions: jsonb('conditions').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const violationEvidence = pgTable('violation_evidence', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }).notNull().references(() => tenants.id),
  violationId: uuid('violation_id').notNull().references(() => violations.id),
  evidenceType: text('evidence_type').notNull(),
  fileUrl: text('file_url'),
  fileKey: text('file_key'),
  thumbnailUrl: text('thumbnail_url'),
  description: text('description'),
  capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
  capturedBy: uuid('captured_by').references(() => users.id),
  latitude: numeric('latitude', { precision: 10, scale: 7 }),
  longitude: numeric('longitude', { precision: 10, scale: 7 }),
  fileHash: text('file_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── ARC Requests ────────────────────────────────────────────────────────

export const arcModificationTypes = pgTable('arc_modification_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }).notNull().references(() => tenants.id),
  name: text('name').notNull(),
  complexityTier: smallint('complexity_tier').notNull().default(2),
  requiresSiteVisit: boolean('requires_site_visit').notNull().default(false),
  defaultReviewDays: integer('default_review_days').notNull().default(30),
  requiredDocuments: text('required_documents').array().notNull().default(sql`'{}'`),
  feeAmount: numeric('fee_amount', { precision: 10, scale: 2 }),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const arcRequests = pgTable('arc_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }).notNull().references(() => tenants.id),
  communityId: uuid('community_id').notNull().references(() => communities.id),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  applicantId: uuid('applicant_id').notNull().references(() => members.id),
  modificationTypeId: uuid('modification_type_id').references(() => arcModificationTypes.id),
  status: text('status').notNull().default('draft'),
  complexityTier: smallint('complexity_tier').notNull().default(2),
  title: text('title').notNull(),
  description: text('description').notNull(),
  estimatedCost: numeric('estimated_cost', { precision: 12, scale: 2 }),
  estimatedStartDate: date('estimated_start_date'),
  estimatedCompletionDate: date('estimated_completion_date'),
  decisionType: text('decision_type'),
  decisionRationale: text('decision_rationale'),
  decisionDate: date('decision_date'),
  conditions: jsonb('conditions').notNull().default([]),
  precedentTags: text('precedent_tags').array().notNull().default(sql`'{}'`),
  submissionDate: date('submission_date'),
  reviewDeadline: date('review_deadline'),
  deemedApprovedDeadline: date('deemed_approved_deadline'),
  completionDeadline: date('completion_deadline'),
  linkedViolationId: uuid('linked_violation_id').references(() => violations.id),
  previousApplicationId: uuid('previous_application_id').references((): AnyPgColumn => arcRequests.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const arcTransitions = pgTable('arc_transitions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }).notNull().references(() => tenants.id),
  requestId: uuid('request_id').notNull().references(() => arcRequests.id),
  fromState: text('from_state').notNull(),
  toState: text('to_state').notNull(),
  triggeredBy: uuid('triggered_by').references(() => users.id),
  reason: text('reason'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const arcVotes = pgTable('arc_votes', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }).notNull().references(() => tenants.id),
  requestId: uuid('request_id').notNull().references(() => arcRequests.id),
  committeeMemberId: uuid('committee_member_id').notNull().references(() => members.id),
  voteValue: text('vote_value').notNull(),
  rationale: text('rationale').notNull(),
  conditionsProposed: jsonb('conditions_proposed').notNull().default([]),
  guidelineCitations: text('guideline_citations').array().notNull().default(sql`'{}'`),
  precedentReferences: uuid('precedent_references').array().notNull().default(sql`'{}'`),
  conflictOfInterest: boolean('conflict_of_interest').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique().on(t.tenantId, t.requestId, t.committeeMemberId),
]);

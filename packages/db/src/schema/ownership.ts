import { sql } from 'drizzle-orm';
import { pgTable, uuid, bigint, text, numeric, boolean, timestamp, date } from 'drizzle-orm/pg-core';
import { daterange } from './helpers';
import { tenants } from './platform';
import { communities, properties, members } from './community';

export const propertyOwnerships = pgTable('property_ownerships', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }).notNull().references(() => tenants.id),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  memberId: uuid('member_id').notNull().references(() => members.id),
  ownershipType: text('ownership_type').notNull().default('primary'),
  ownershipPercentage: numeric('ownership_percentage', { precision: 5, scale: 2 }).notNull().default('100.00'),
  isPrimaryResident: boolean('is_primary_resident').notNull().default(true),
  validDuring: daterange('valid_during').notNull().default(sql`daterange(CURRENT_DATE, NULL, '[)')`),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  recordedBy: uuid('recorded_by'),
  notes: text('notes'),
});

export const boardTerms = pgTable('board_terms', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }).notNull().references(() => tenants.id),
  communityId: uuid('community_id').notNull().references(() => communities.id),
  memberId: uuid('member_id').notNull().references(() => members.id),
  officerRole: text('officer_role').notNull(),
  appointmentType: text('appointment_type').notNull().default('elected'),
  validDuring: daterange('valid_during').notNull(),
  electedDate: date('elected_date'),
  notes: text('notes'),
});

export const committees = pgTable('committees', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }).notNull().references(() => tenants.id),
  communityId: uuid('community_id').notNull().references(() => communities.id),
  name: text('name').notNull(),
  committeeType: text('committee_type').notNull().default('standing'),
  purpose: text('purpose'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const committeeMemberships = pgTable('committee_memberships', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }).notNull().references(() => tenants.id),
  committeeId: uuid('committee_id').notNull().references(() => committees.id),
  memberId: uuid('member_id').notNull().references(() => members.id),
  role: text('role').notNull().default('member'),
  validDuring: daterange('valid_during').notNull().default(sql`daterange(CURRENT_DATE, NULL, '[)')`),
});

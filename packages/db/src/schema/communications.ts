import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import {
  pgTable, uuid, bigint, text, smallint, integer,
  boolean, jsonb, timestamp,
} from 'drizzle-orm/pg-core';
import { tenants, users } from './platform';
import { communities, members } from './community';

export const communications = pgTable('communications', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }).notNull().references(() => tenants.id),
  communityId: uuid('community_id').notNull().references(() => communities.id),
  communicationType: text('communication_type').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  bodyHtml: text('body_html'),
  priority: text('priority').notNull().default('standard'),
  status: text('status').notNull().default('draft'),
  audienceType: text('audience_type').notNull().default('all_members'),
  audienceFilter: jsonb('audience_filter').notNull().default({}),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  sentBy: uuid('sent_by').references(() => users.id),
  sourceType: text('source_type'),
  sourceId: uuid('source_id'),
  channels: text('channels').array().notNull().default(sql`'{email}'`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const communicationDeliveries = pgTable('communication_deliveries', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }).notNull().references(() => tenants.id),
  communicationId: uuid('communication_id').notNull().references(() => communications.id),
  memberId: uuid('member_id').notNull().references(() => members.id),
  channel: text('channel').notNull(),
  status: text('status').notNull().default('pending'),
  providerMessageId: text('provider_message_id'),
  providerStatus: text('provider_status'),
  queuedAt: timestamp('queued_at', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  openedAt: timestamp('opened_at', { withTimezone: true }),
  failedAt: timestamp('failed_at', { withTimezone: true }),
  failureReason: text('failure_reason'),
  retryCount: smallint('retry_count').notNull().default(0),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const documentCategories = pgTable('document_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }).notNull().references(() => tenants.id),
  name: text('name').notNull(),
  parentId: uuid('parent_id').references((): AnyPgColumn => documentCategories.id),
  sortOrder: integer('sort_order').notNull().default(0),
  isSystem: boolean('is_system').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

import { pgTable, bigint, uuid, text, boolean, jsonb, timestamp, unique } from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  clerkOrgId: text('clerk_org_id').unique().notNull(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  status: text('status').notNull().default('active'),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id'),
  stripeConnectAccountId: text('stripe_connect_account_id').unique(),
  stripeConnectOnboarded: boolean('stripe_connect_onboarded').notNull().default(false),
  planTier: text('plan_tier').notNull().default('starter'),
  billingCycle: text('billing_cycle').notNull().default('monthly'),
  featureFlags: jsonb('feature_flags').notNull().default({}),
  settings: jsonb('settings').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  clerkUserId: text('clerk_user_id').unique().notNull(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  phone: text('phone'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const tenantMemberships = pgTable('tenant_memberships', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }).notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  role: text('role').notNull().default('homeowner'),
  isActive: boolean('is_active').notNull().default(true),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique().on(t.tenantId, t.userId),
]);

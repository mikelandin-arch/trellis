import { pgTable, uuid, bigint, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { inet } from './helpers';

export const auditLog = pgTable('audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }),
  tableName: text('table_name').notNull(),
  recordId: uuid('record_id').notNull(),
  operation: text('operation').notNull(),
  oldValues: jsonb('old_values'),
  newValues: jsonb('new_values'),
  changedBy: text('changed_by'),
  changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
  ipAddress: inet('ip_address'),
  userAgent: text('user_agent'),
});

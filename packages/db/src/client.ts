import { drizzle } from 'drizzle-orm/postgres-js';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export { schema };

// app_user pool — RLS enforced, used for all tenant-scoped operations
export const sql = postgres(process.env.TRELLIS_DB_URL!);
export const db = drizzle(sql, { schema });

// app_admin pool — BYPASSRLS, used only by superAdminProcedure
const adminUrl = process.env.TRELLIS_DB_ADMIN_URL ?? process.env.TRELLIS_DB_URL!;
export const adminSql = postgres(adminUrl);
export const adminDb = drizzle(adminSql, { schema });

export type Database = typeof db;

// Base query type compatible with both the db instance and PgTransaction.
// PgTransaction extends PgDatabase but lacks $client, so use this for
// function parameters that accept either.
export type DbClient = PgDatabase<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

# Trellis Platform Architecture

Reference for engineers adding features, routers, or infrastructure to the Trellis HOA platform.

**Last updated:** Week 2, Phase 1 (API foundation complete, mobile shell in progress).

---

## Request Lifecycle

A request from the mobile client to a tenant-scoped endpoint traverses six stages. Each stage either enriches the context or rejects the request.

```
Mobile App
  │  Authorization: Bearer <Clerk 60-second JWT>
  ▼
Fastify v5  (apps/api/src/server.ts)
  │  clerkPlugin validates JWT signature + expiry,
  │  attaches Auth object to req
  ▼
tRPC context factory  (apps/api/src/trpc/context.ts)
  │  getAuth(req) extracts userId, sessionId, orgId,
  │  orgRole, orgPermissions from the Clerk Auth object.
  │  All fields nullable — public routes have no auth.
  ▼
Middleware: isAuthed  (procedures.ts, Layer 1)
  │  Asserts userId is non-null.
  │  Rejects with UNAUTHORIZED if missing.
  ▼
Middleware: hasOrgContext  (procedures.ts, Layer 2)
  │  Asserts orgId is non-null.
  │  Calls resolveTenantId(orgId) to map the Clerk org_id
  │  to the internal BIGINT tenant_id via the tenants table.
  │  Result is cached in-memory (5-min TTL).
  │  Adds tenantId to context.
  ▼
Middleware: withTenantDb  (procedures.ts, Layers 3+4)
  │  Opens a Drizzle transaction via db.transaction():
  │    1. BEGIN
  │    2. SELECT set_config('app.current_tenant', '<tenantId>', true)
  │       (equivalent to SET LOCAL — scoped to this transaction)
  │    3. The resolver runs. Every query goes through RLS.
  │    4. COMMIT on success, ROLLBACK on throw.
  │  Puts the transactional Drizzle instance on ctx.db.
  ▼
Resolver  (e.g. apps/api/src/routers/property.ts)
  │  Uses ctx.db.select().from(properties)...
  │  RLS silently filters rows to current tenant.
  ▼
Response  →  JSON over HTTP  →  Mobile App
```

### Key invariant

The `next()` call that executes the resolver runs **inside** the database transaction. The transaction boundary wraps the entire resolver, so there is no window where queries execute without a tenant context set.

---

## Database Connection Pools

Two pools exist, corresponding to two PostgreSQL roles defined in `schema.sql`.

| Pool | Role | RLS | Connection string | Used by |
|---|---|---|---|---|
| `sql` / `db` | `app_user` | Enforced | `TRELLIS_DB_URL` | `tenantProcedure` (all tenant-scoped routers), `resolveTenantId` cache-miss lookups |
| `adminSql` / `adminDb` | `app_admin` | Bypassed (`BYPASSRLS`) | `TRELLIS_DB_ADMIN_URL` | `superAdminProcedure` (platform admin cross-tenant operations), Clerk webhook handler (platform-level sync) |

Both are initialized in `packages/db/src/client.ts`. The admin pool falls back to `TRELLIS_DB_URL` when `TRELLIS_DB_ADMIN_URL` is not set, which is convenient in development when a single superuser connection is used for everything.

A third role, `migration_admin`, has `BYPASSRLS` and is used only by `drizzle-kit migrate`. It never appears in application code.

### Why two pools

`app_user` has RLS enforced — even if application code has a bug that forgets a WHERE clause, PostgreSQL will deny access to rows outside the current tenant. `app_admin` bypasses RLS because platform-level operations (managing tenants, cross-tenant reporting) must see all rows. The `superAdminProcedure` gates access to this pool behind an `org:super_admin` role check.

### SET LOCAL, not SET

The tenant context is set with `set_config('app.current_tenant', value, true)` where the third argument (`true` = `is_local`) makes it equivalent to `SET LOCAL`. This scopes the setting to the current transaction. When the transaction commits or rolls back, the setting disappears. A bare `SET` would persist on the connection and leak between requests in a pooled environment (PgBouncer, connection reuse).

---

## Procedure Hierarchy

Defined in `apps/api/src/trpc/procedures.ts`. Each procedure builds on the one above it.

```
publicProcedure                          No auth. Used by health check.
  └─ authedProcedure                     Layer 1: userId must exist.
       ├─ orgProcedure                   Layer 2: orgId must exist, tenantId resolved.
       │    └─ tenantProcedure           Layers 3+4: SET LOCAL + transactional ctx.db.
       └─ superAdminProcedure            BYPASSRLS pool via adminDb.
```

When adding a new router, choose the right base:

| You are building... | Use |
|---|---|
| Public/unauthenticated endpoint | `publicProcedure` |
| User-scoped, no tenant data | `authedProcedure` |
| Tenant-scoped read/write | `tenantProcedure` |
| Tenant-scoped with a specific permission | `tenantProcedure.use(requirePermission('org:...'))` |
| Platform admin cross-tenant | `superAdminProcedure` |

### Adding per-route permissions

The `requirePermission` factory creates a middleware you chain after the base procedure:

```typescript
export const violationRouter = router({
  list: tenantProcedure.query(/* ... */),
  create: tenantProcedure
    .use(requirePermission('org:violations:create'))
    .mutation(/* ... */),
  issueFine: tenantProcedure
    .use(requirePermission('org:violations:issue_fine'))
    .mutation(/* ... */),
});
```

Permission strings correspond to Clerk organization permissions (e.g. `org:violations:read`, `org:finance:approve`). The full matrix is documented in `docs/Authentication_and_Authorization_System_for_a_Multi-Tenant_HOA_Platform.md`.

---

## File Ownership

### `apps/api/src/` — Fastify + tRPC server

| File | Responsibility |
|---|---|
| `server.ts` | Fastify bootstrap. Registers `clerkWebhookPlugin`, `clerkPlugin`, `fastifyTRPCPlugin` at `/trpc`, REST webhook stub at `/webhooks/stripe`. |
| `webhooks/clerk.ts` | Clerk webhook handler. Svix signature verification, event routing, idempotent writes to `tenants`, `users`, and `tenant_memberships` via `adminDb`. |
| `trpc/context.ts` | Creates tRPC context per request. Extracts Clerk auth claims. Owns the `resolveTenantId` function and its in-memory cache (Map with 5-min TTL). |
| `trpc/router.ts` | `initTRPC` with error formatting. Exports `router`, `publicProcedure`, `middleware`. |
| `trpc/procedures.ts` | The 4-layer middleware chain. Exports `authedProcedure`, `orgProcedure`, `tenantProcedure`, `superAdminProcedure`, `requirePermission`. |
| `routers/index.ts` | Root `appRouter` merging all domain routers. Exports `AppRouter` type for client-side inference. |
| `routers/health.ts` | `publicProcedure` — returns status, service name, timestamp. |
| `routers/property.ts` | `tenantProcedure` — `list` (cursor-paginated) and `getById`. First tenant-scoped router; use as the template for new routers. |

### `packages/db/` — Drizzle ORM + connection pools

| File | Responsibility |
|---|---|
| `src/client.ts` | Creates both connection pools (`sql`/`db` for `app_user`, `adminSql`/`adminDb` for `app_admin`). Exports the raw `postgres` instances and Drizzle wrappers. |
| `src/schema/` | Drizzle table definitions organized by domain: `platform.ts` (tenants, users, tenant_memberships), `community.ts` (communities, compliance_profiles, properties, members), `ownership.ts`, `financial.ts`, `governance.ts`, `operations.ts`, `communications.ts`, `audit.ts`. |
| `src/schema/helpers.ts` | Custom Drizzle column types (`daterange`, `inet`). |
| `src/index.ts` | Re-exports everything from `schema/` and `client.ts`. |

### `packages/shared/` — Cross-package types and schemas

| File | Responsibility |
|---|---|
| `src/schemas/common.ts` | `paginationSchema`, `idParamSchema`, `tenantIdSchema` — Zod schemas reused across routers. |
| `src/constants/roles.ts` | `CLERK_ROLES` object and `ClerkRole` type. |
| `src/constants/violation-states.ts` | `VIOLATION_STATUS`, `VALID_TRANSITIONS` — state machine constants. |

### `packages/infra/` — AWS CDK

| Stack | Resources |
|---|---|
| `TrellisNetworkStack` | VPC with 2 AZs, public + private subnets. |
| `TrellisDataStack` | RDS PostgreSQL 16 (db.t4g.micro), S3 bucket, Secrets Manager. |
| `TrellisComputeStack` | App Runner service with VPC connector. |

### `schema.sql` — Canonical database schema

The source of truth for the 37-table PostgreSQL schema. Contains table definitions, RLS policies, indexes, triggers, roles, and grants. Drizzle schema files in `packages/db/src/schema/` mirror this file.

---

## Deployed vs. Local

| Component | Local development | Deployed (dev stage) |
|---|---|---|
| **API server** | `tsx watch src/server.ts` on `localhost:3001` | AWS App Runner (via CDK `TrellisComputeStack`) |
| **PostgreSQL** | SSM tunnel to RDS on `localhost:15432` | RDS PostgreSQL 16 in private subnet, `us-west-2` |
| **Clerk auth** | Same Clerk dev instance (test keys in `.env`) | Same Clerk instance (production keys in Secrets Manager) |
| **S3 documents** | Same dev bucket via AWS SDK | `trellis-documents-dev` in `us-west-2` |
| **Mobile app** | Expo dev client on simulator/device | EAS Build (development profile) |

The SSM port-forward tunnel (visible in the terminal) bridges local development to the RDS instance in the private subnet:

```
aws ssm start-session --profile hoa --region us-west-2 \
  --target <bastion-instance-id> \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters "host=<rds-endpoint>,portNumber=5432,localPortNumber=15432"
```

With this tunnel active, `TRELLIS_DB_URL` points to `localhost:15432` and queries reach the RDS instance.

---

## Security Boundaries: Tenant Isolation

Five independent layers prevent tenant A from seeing tenant B's data. A failure in any single layer does not compromise isolation.

### Layer 1: Clerk JWT validation

The `clerkPlugin` rejects requests with invalid, expired, or tampered JWTs. The `orgId` claim in the JWT identifies which organization (HOA) the user is acting within. A user cannot forge an `orgId` for an organization they don't belong to — Clerk signs the JWT server-side.

### Layer 2: Org-to-tenant mapping

The `hasOrgContext` middleware maps the Clerk `orgId` to an internal `tenant_id` by querying the `tenants` table. If the mapping doesn't exist (e.g. a deleted or unknown org), the request is rejected with `NOT_FOUND`. This prevents stale or fabricated org IDs from reaching the database layer.

### Layer 3: SET LOCAL in transaction

The `withTenantDb` middleware sets `app.current_tenant` to the resolved `tenant_id` using `set_config(..., true)` (SET LOCAL). This setting is consumed by the `current_tenant_id()` SQL function that every RLS policy references. The setting is transaction-scoped — it cannot leak to another request.

### Layer 4: PostgreSQL Row-Level Security

Every tenant-scoped table (31 of 37) has an RLS policy:

```sql
CREATE POLICY tenant_isolation ON <table> FOR ALL
  USING (tenant_id = (SELECT current_tenant_id()) AND (SELECT current_tenant_id()) IS NOT NULL)
  WITH CHECK (tenant_id = (SELECT current_tenant_id()));
```

- **USING** clause: filters SELECT, UPDATE, DELETE to current tenant only. The `IS NOT NULL` guard means if `app.current_tenant` is unset, **zero rows are visible** — not all rows.
- **WITH CHECK** clause: prevents INSERT or UPDATE that would set `tenant_id` to a different tenant.
- **FORCE ROW LEVEL SECURITY**: applied to all tables so even table owners cannot bypass policies.
- **Subselect wrapping**: `(SELECT current_tenant_id())` rather than bare `current_tenant_id()` enables the query planner to cache the value per-query instead of evaluating per-row.

The three platform tables (`tenants`, `users`, `tenant_memberships`) have no RLS — they are queried for authentication/authorization lookups and don't contain tenant-scoped data.

Shared reference tables (`compliance_profiles`, `violation_transition_rules`) use a more permissive read policy: rows with `NULL` tenant_id (platform/state-level rules) are readable by any tenant, while rows with a populated `tenant_id` are restricted to that tenant.

### Layer 5: Non-superuser connection role

The application connects as `app_user`, a PostgreSQL role that does **not** have `BYPASSRLS`. Even if application code somehow skipped the middleware chain, the database role itself enforces RLS. Only `app_admin` (used by `superAdminProcedure`) and `migration_admin` (used by Drizzle Kit) bypass RLS.

### What this means in practice

If you add a new router using `tenantProcedure`, you do **not** need to add `WHERE tenant_id = ?` to your queries. RLS handles it. You do not need to worry about cross-tenant data leakage in your resolver code. The isolation is enforced at the database level, below your application code.

However, you **must** use `tenantProcedure` (not `orgProcedure` or `authedProcedure`) for any query that touches tenant-scoped tables. Without the `withTenantDb` middleware, `app.current_tenant` is unset and RLS will return zero rows.

---

## Webhook Handlers

### Clerk Webhooks (`POST /webhooks/clerk`)

Clerk sends webhook events via [Svix](https://www.svix.com/) whenever organizations, memberships, or users change. The handler at `apps/api/src/webhooks/clerk.ts` syncs these events to the platform tables (`tenants`, `users`, `tenant_memberships`).

**Registration**: The handler is an encapsulated Fastify plugin (`clerkWebhookPlugin`) registered **before** `clerkPlugin` in `server.ts`. This gives it its own content-type parser (raw string body for Svix verification) and keeps it outside Clerk's auth preHandler scope — webhook requests carry Svix signatures, not JWTs.

**Signature verification**: Every request is verified using the `svix` package with the `CLERK_WEBHOOK_SECRET` env var (the Svix signing secret from the Clerk dashboard). Requests with missing or invalid signatures are rejected with 400.

**Database access**: All writes use `adminDb` (the `app_admin` BYPASSRLS pool) because webhooks operate at the platform level, not within a tenant context. No RLS tenant context is set.

**Idempotency**: All handlers use Drizzle's `onConflictDoUpdate` or `onConflictDoNothing` on the relevant unique constraints to safely handle Clerk's at-least-once delivery and webhook retries.

### Event-to-table mapping

| Clerk Event | Table | Operation |
|---|---|---|
| `organization.created` | `tenants` | INSERT (clerk_org_id, name, slug, status='active'). Conflict on `clerk_org_id` is a no-op. |
| `organization.updated` | `tenants` | UPDATE name and slug where `clerk_org_id` matches. |
| `organizationMembership.created` | `users`, `tenant_memberships` | Upsert user from `public_user_data`, then INSERT membership. Conflict on `(tenant_id, user_id)` updates role and sets `is_active=true`. |
| `organizationMembership.updated` | `tenant_memberships` | UPDATE role where tenant and user match. |
| `organizationMembership.deleted` | `tenant_memberships` | SET `is_active=false` (soft delete) where tenant and user match. |
| `user.created` / `user.updated` | `users` | UPSERT on `clerk_user_id` — sets email, display_name, phone, avatar_url. |

### Clerk role to database role mapping

Clerk organization roles use the `org:` prefix. The database `tenant_memberships.role` column has a CHECK constraint with a different set of values. The webhook handler maps between them:

| Clerk Role | DB Role |
|---|---|
| `org:super_admin` | `super_admin` |
| `org:board_officer` | `board_president` |
| `org:board_member` | `board_member` |
| `org:property_manager` | `community_manager` |
| `org:committee_member` | `committee_member` |
| `org:homeowner` | `homeowner` |
| `org:vendor` | `vendor` |
| `org:admin` (Clerk default) | `super_admin` |
| `org:member` (Clerk default) | `homeowner` |

Unknown roles fall back to `homeowner` and are logged as warnings.

---

## Adding a New Feature Router

Step-by-step for an engineer adding, for example, a `violationRouter`:

1. **Create the router file** at `apps/api/src/routers/violation.ts`. Import `tenantProcedure` and `requirePermission` from `../trpc/procedures`, `router` from `../trpc/router`.

2. **Define procedures.** Use `tenantProcedure` as the base. Chain `.use(requirePermission('org:violations:create'))` on mutations that require specific permissions. Use `.input(schema)` with a Zod schema from `@repo/shared`.

3. **Query via `ctx.db`.** The `ctx.db` is a Drizzle instance scoped to the current transaction with `app.current_tenant` set. Import table definitions from `@repo/db`. Do not add tenant_id filters — RLS handles it.

4. **Register the router** in `apps/api/src/routers/index.ts` by adding it to the `appRouter`.

5. **Add Zod input schemas** in `packages/shared/src/schemas/` if they don't exist. Export from `packages/shared/src/index.ts`.

6. **Run `turbo run check-types`** to verify the entire monorepo compiles.

Example skeleton:

```typescript
// apps/api/src/routers/violation.ts
import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { violations } from '@repo/db';
import { idParamSchema } from '@repo/shared';
import { router } from '../trpc/router';
import { tenantProcedure, requirePermission } from '../trpc/procedures';

export const violationRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(violations);
  }),

  getById: tenantProcedure
    .input(idParamSchema)
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(violations)
        .where(eq(violations.id, input.id))
        .limit(1);

      if (!rows[0]) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      return rows[0];
    }),

  create: tenantProcedure
    .use(requirePermission('org:violations:create'))
    .input(/* Zod schema */)
    .mutation(async ({ ctx, input }) => {
      // RLS WITH CHECK prevents inserting with wrong tenant_id
      const [row] = await ctx.db.insert(violations).values({
        tenantId: ctx.tenantId,
        ...input,
      }).returning();
      return row;
    }),
});
```

Then in `routers/index.ts`:

```typescript
import { violationRouter } from './violation';

export const appRouter = router({
  health: healthRouter,
  property: propertyRouter,
  violation: violationRouter,
});
```

---

## Development Data

The `scripts/seed-talasera.ts` script populates the dev database with a realistic Talasera HOA dataset:

| Table | Records | Details |
|---|---|---|
| `tenants` | 1 | Talasera HOA (starter plan) |
| `users` | 1 | Michael Zorn |
| `tenant_memberships` | 1 | Board president role |
| `communities` | 1 | Talasera — Bothell, WA 98011 |
| `properties` | 55 | Lots 1–55, 12001–12055 Talasera Ln |
| `compliance_profiles` | 1 | Washington State defaults (30-day cure, 14-day hearing notice) |

### Running the seed

The SSM port-forward tunnel to RDS must be active (see "Deployed vs. Local" above), then:

```bash
npx tsx scripts/seed-talasera.ts
```

The script is idempotent — every INSERT uses `ON CONFLICT DO NOTHING` or a `WHERE NOT EXISTS` guard, so it is safe to re-run.

# Trellis Platform Architecture

Reference for engineers adding features, routers, or infrastructure to the Trellis HOA platform.

**Last updated:** Phase 3 (Financial management system complete).

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
| `server.ts` | Fastify bootstrap. Registers `stripeWebhookPlugin`, `clerkWebhookPlugin`, `clerkPlugin`, `fastifyTRPCPlugin` at `/trpc`. |
| `webhooks/clerk.ts` | Clerk webhook handler. Svix signature verification, event routing, idempotent writes to `tenants`, `users`, and `tenant_memberships` via `adminDb`. |
| `webhooks/stripe.ts` | Stripe webhook handler. Signature verification, handles `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `account.updated`. |
| `trpc/context.ts` | Creates tRPC context per request. Extracts Clerk auth claims. Owns the `resolveTenantId` function and its in-memory cache (Map with 5-min TTL). |
| `trpc/router.ts` | `initTRPC` with error formatting. Exports `router`, `publicProcedure`, `middleware`. |
| `trpc/procedures.ts` | The 4-layer middleware chain. Exports `authedProcedure`, `orgProcedure`, `tenantProcedure`, `superAdminProcedure`, `requirePermission`. |
| `routers/index.ts` | Root `appRouter` merging all domain routers. Exports `AppRouter` type for client-side inference. |
| `routers/health.ts` | `publicProcedure` — returns status, service name, timestamp. |
| `routers/property.ts` | `tenantProcedure` — `list` (cursor-paginated) and `getById`. First tenant-scoped router; use as the template for new routers. |
| `routers/violation.ts` | `tenantProcedure` — Full violation CRUD: `create`, `list`, `getById`, `transition` (state machine), `addEvidence` (S3 presigned URL), `dismiss`. |
| `routers/violation-category.ts` | `tenantProcedure` — Category tree management: `list`, `create`, `update`. Admin-only mutations via `requirePermission`. |
| `routers/stripe-connect.ts` | `tenantProcedure` — Stripe Connect management: `createConnectedAccount`, `getOnboardingLink`, `getAccountStatus`, `getDashboardLink`. Board officer only. |
| `routers/assessment.ts` | `tenantProcedure` — Assessment billing: `listSchedules`, `createSchedule`, `generateCharges`, `getRateHistory`. |
| `routers/charge.ts` | `tenantProcedure` — Charge ledger: `listByMember`, `listByProperty`, `listOverdue` (with aging buckets), `waive`. |
| `routers/payment.ts` | `tenantProcedure` — Payment processing: `createPaymentIntent` (Stripe destination charges), `listByMember`, `applyPayment`, `setupAutopay`, `cancelAutopay`. |
| `lib/stripe.ts` | Stripe SDK initialization, fee calculation helpers (application fee, platform ACH cost). |
| `lib/compliance.ts` | WA state compliance engine: cure deadlines, transition validation, notice methods, fine cap checking. Queries `compliance_profiles` and `violation_transition_rules`. |
| `lib/collections.ts` | Collections workflow: `assessLateFees` (WA-compliant), `getDelinquencyStatus`, `getPaymentApplicationOrder` (state-configurable). |

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
| `src/schemas/violation.ts` | All violation Zod schemas: `createViolationSchema`, `violationListSchema`, `transitionViolationSchema`, `addEvidenceSchema`, `dismissViolationSchema`, `violationCategoryCreateSchema`, `violationCategoryUpdateSchema`. |
| `src/schemas/assessment.ts` | Assessment and charge schemas: `createAssessmentScheduleSchema`, `generateChargesSchema`, `chargeListFiltersSchema`, `waiveChargeSchema`, `rateHistorySchema`. |
| `src/schemas/payment.ts` | Payment schemas: `createPaymentIntentSchema`, `setupAutopaySchema`, `paymentListFiltersSchema`. |
| `src/constants/roles.ts` | `CLERK_ROLES` object and `ClerkRole` type. |
| `src/constants/violation-states.ts` | `VIOLATION_STATUS`, `VALID_TRANSITIONS`, `TERMINAL_STATES`, UI helpers (`VIOLATION_STATUS_LABELS`, `STATUS_BADGE_VARIANT`, `SEVERITY_BADGE_VARIANT`). |

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

`scripts/seed-assessments.ts` extends the dataset with financial data:

| Table | Records | Details |
|---|---|---|
| `members` | 55 | Owner 1–55 (one per property) |
| `property_ownerships` | 55 | Primary ownership linking members to properties |
| `assessment_schedules` | 1 | $100/month operating fund assessment |
| `assessment_rate_history` | 1 | Initial rate record |
| `charges` | 165 | 3 months (Jan–Mar 2026) × 55 properties |
| `payments` | 132 | ~80% on-time rate (44 properties × 3 months) |
| `payment_applications` | 132 | Payment-to-charge linkage |

### Running the seeds

The SSM port-forward tunnel to RDS must be active (see "Deployed vs. Local" above), then:

```bash
npx tsx scripts/seed-talasera.ts
npx tsx scripts/seed-assessments.ts
```

Both scripts are idempotent — every INSERT uses `ON CONFLICT DO NOTHING` or a `WHERE NOT EXISTS` guard, so they are safe to re-run.

---

## Mobile App

The Expo mobile app lives in `apps/mobile/` and uses file-based routing via expo-router v5 (SDK 53).

### Provider Hierarchy

The root layout (`src/app/_layout.tsx`) wraps the entire app in three layers, outermost to innermost:

```
ClerkProvider (src/providers/auth-provider.tsx)
  │  tokenCache from @clerk/clerk-expo/token-cache (SecureStore-backed)
  │  publishableKey from EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
  ▼
TRPCQueryProvider (src/lib/trpc.ts)
  │  QueryClientProvider + TRPCProvider
  │  httpBatchLink → EXPO_PUBLIC_API_URL/trpc
  │  Injects Authorization: Bearer <Clerk JWT> via useAuth().getToken()
  ▼
Auth Gate (useProtectedRoute hook in _layout.tsx)
  │  Redirects based on auth + org state:
  │    not signed in     → /(auth)/sign-in
  │    signed in, no org → /(auth)/org-select
  │    signed in + org   → /(tabs)
  ▼
Screen (Slot)
```

### Auth Flow

1. **Sign-in** (`(auth)/sign-in.tsx`): User enters email → magic link sent via `useSignIn()` with `email_code` strategy → redirects to verify screen. Google OAuth available via `useSSO()` with `strategy: 'oauth_google'`.

2. **Verification** (`(auth)/verify.tsx`): Handles deep link callbacks (`trellis://` scheme) and manual 6-digit OTP entry. On success, `setActive()` creates the session.

3. **Org selection** (`(auth)/org-select.tsx`): Lists the user's Clerk organizations via `useOrganizationList()`. Tapping an org calls `setActive({ organization })`, which updates the JWT claims and triggers the auth gate to redirect to `(tabs)`.

### tRPC Client Configuration

The tRPC client is configured in two layers:

- **`packages/api-client/src/index.ts`**: Creates the typed tRPC context via `createTRPCContext<AppRouter>()` from `@trpc/tanstack-react-query`. Exports `TRPCProvider`, `useTRPC`, and the `AppRouter` type (imported from `@repo/api`).

- **`apps/mobile/src/lib/trpc.ts`**: Creates the actual `TRPCClient` with `httpBatchLink` pointed at the API server. The Clerk session token is injected into the `Authorization` header via a ref-captured `getToken()` callback from `useAuth()`. The `QueryClient` is configured with 30-second stale time and retry logic that skips 401/403 errors.

Components use the tRPC v11 pattern: `useTRPC()` to get the typed proxy, then `useQuery(trpc.property.list.queryOptions({ limit: 50 }))` from `@tanstack/react-query`.

### File Structure

```
src/
├── app/
│   ├── _layout.tsx              # Root: providers + auth gate
│   ├── (auth)/
│   │   ├── _layout.tsx          # Stack navigator
│   │   ├── sign-in.tsx          # Email + magic link + Google OAuth
│   │   ├── verify.tsx           # OTP code entry + deep link handler
│   │   └── org-select.tsx       # Organization picker
│   └── (tabs)/
│       ├── _layout.tsx          # Bottom tabs (role-gated Admin)
│       ├── index.tsx            # Home dashboard
│       ├── payments/            # Financial management (Phase 3)
│       │   ├── _layout.tsx     # Stack navigator
│       │   ├── index.tsx       # Owner payment dashboard
│       │   ├── pay.tsx         # Payment flow (method select, confirm)
│       │   └── history.tsx     # Full payment history
│       ├── community/
│       │   └── index.tsx        # Property directory
│       ├── requests.tsx         # Placeholder
│       └── admin/              # Board-only (role-gated)
│           ├── _layout.tsx     # Stack navigator
│           ├── index.tsx       # Admin dashboard
│           ├── finance/        # Financial dashboard (Phase 3)
│           │   └── index.tsx   # AR aging, collections, generate assessments
│           └── violations/     # Violation management (Phase 2)
│               ├── index.tsx   # Violation list with filters
│               ├── [id].tsx    # Violation detail + timeline
│               ├── report.tsx  # 5-step report wizard
│               └── transition.tsx # State transition modal
├── lib/
│   └── trpc.ts                  # tRPC client + QueryClient + provider
└── providers/
    └── auth-provider.tsx        # ClerkProvider wrapper
```

### Offline Behavior

The app treats offline as a neutral state, not an error. React Query's cache serves stale data when the network is unavailable. No error modals are shown for connectivity issues — the Clerk SDK handles token refresh when connectivity returns, and the sign-in screen shows a friendly message via `isClerkRuntimeError()` network error detection.

### Tab Navigation

Five bottom tabs: Home, Payments, Community, Requests, Admin. The Admin tab is role-gated — it is hidden from users whose Clerk organization role is not in the set `{super_admin, board_officer, board_member, property_manager}`. This is implemented by setting `href: null` on the Admin `Tabs.Screen` for non-admin users.

---

## Violation Management (Phase 2)

The violation management system is Trellis's core differentiator. Board members can document violations in under 60 seconds from a smartphone with full state-machine enforcement and WA state compliance.

### State Machine

The violation lifecycle is a strict state machine with 13 states and controlled transitions. The state machine prevents skipping steps — for example, you cannot go from `courtesy_notice_sent` to `lien_filed` without passing through `formal_notice_sent` and `hearing_scheduled`.

```
REPORTED
  ├→ VERIFIED → COURTESY_NOTICE_SENT
  │               ├→ FORMAL_NOTICE_SENT
  │               │    ├→ ESCALATED → HEARING_SCHEDULED
  │               │    ├→ HEARING_SCHEDULED
  │               │    └→ RESOLVED_CURED
  │               └→ RESOLVED_CURED
  └→ DISMISSED

HEARING_SCHEDULED
  ├→ FINE_ASSESSED
  │    ├→ PAYMENT_PLAN
  │    │    ├→ RESOLVED_PAID
  │    │    └→ LIEN_FILED
  │    ├→ LIEN_FILED
  │    │    ├→ LEGAL_REFERRAL (terminal)
  │    │    └→ RESOLVED_PAID (terminal)
  │    └→ RESOLVED_PAID (terminal)
  ├→ DISMISSED (terminal)
  └→ RESOLVED_CURED (terminal)
```

Terminal states: `RESOLVED_CURED`, `RESOLVED_PAID`, `DISMISSED`, `LEGAL_REFERRAL`.

State definitions live in `packages/shared/src/constants/violation-states.ts`. The `VALID_TRANSITIONS` map is the source of truth for allowed transitions.

### Compliance Engine

The compliance engine (`apps/api/src/lib/compliance.ts`) enforces state-specific rules:

| Function | Purpose |
|---|---|
| `getCureDeadline(db, violationDate, stateCode)` | Calculates cure deadline from `compliance_profiles.cure_period_days`. Defaults to 30 days. |
| `validateTransition(db, from, to, stateCode)` | Checks `VALID_TRANSITIONS` map, then queries `violation_transition_rules` for state-specific requirements (hearing, notice days, certified mail). |
| `getRequiredNoticeMethod(db, stateCode, noticeType)` | Returns required delivery channels per state law. |
| `checkFineCap(db, amount, stateCode)` | Validates fine against the state's `fine_cap_per_violation`. WA has no statutory cap but requires a previously established fine schedule. |

All compliance functions accept the transactional `ctx.db` from `tenantProcedure`, ensuring they run inside the RLS-scoped transaction.

### API Surface

Two tRPC routers handle violation operations:

**`violation` router** (`apps/api/src/routers/violation.ts`):

| Procedure | Input | Description |
|---|---|---|
| `create` | `createViolationSchema` | Report new violation. Validates property, resolves community, checks repeat offenders (12-month lookback). |
| `list` | `violationListSchema` | Cursor-paginated, filterable by status, property, category, severity, date range. Joins property address and category name. |
| `getById` | `idParamSchema` | Full detail: violation + transitions history + evidence list + valid next transitions. |
| `transition` | `transitionViolationSchema` | State machine transition with compliance validation. Sets cure deadlines, validates hearing dates and fine caps. |
| `addEvidence` | `addEvidenceSchema` | Returns a pre-signed S3 PUT URL for direct upload from mobile. |
| `dismiss` | `dismissViolationSchema` | Shortcut for transition to `dismissed` with required reason. |

**`violationCategory` router** (`apps/api/src/routers/violation-category.ts`):

| Procedure | Input | Description |
|---|---|---|
| `list` | — | Full category tree for current tenant. |
| `create` | `violationCategoryCreateSchema` | Admin-only category creation. |
| `update` | `violationCategoryUpdateSchema` | Admin-only category updates. |

### Evidence Upload Flow

Evidence (photos, videos, documents) is uploaded directly to S3 via pre-signed URLs, never through the API server:

```
Mobile App                         API Server                    S3
    │                                  │                          │
    │  addEvidence(violationId, type)  │                          │
    │─────────────────────────────────>│                          │
    │                                  │  PutObjectCommand        │
    │                                  │  getSignedUrl(300s)      │
    │  { evidenceId, uploadUrl }       │                          │
    │<─────────────────────────────────│                          │
    │                                  │                          │
    │  PUT uploadUrl (binary)          │                          │
    │────────────────────────────────────────────────────────────>│
    │                                  │                          │
    │  200 OK                          │                          │
    │<────────────────────────────────────────────────────────────│
```

S3 keys follow the pattern: `violations/{tenantId}/{violationId}/{evidenceId}`.

### Mobile Screens

The admin tab now contains a Stack navigator with nested violation screens:

```
(tabs)/admin/
  _layout.tsx               # Stack navigator
  index.tsx                 # Admin dashboard (violation summary + quick actions)
  violations/
    index.tsx               # FlashList with status/severity/category filter chips
    [id].tsx                # Detail: status timeline, evidence gallery, action buttons
    report.tsx              # 5-step wizard (photo → property → category → details → submit)
    transition.tsx          # Modal: select next state, reason, hearing date / fine amount
```

The report wizard targets a 45-second / 4-tap reporting flow:
1. **Photo**: Camera or library picker with auto GPS capture via `expo-location`
2. **Property**: Searchable list filtered by address or lot number
3. **Category**: Optional — grouped by parent category, auto-fills severity
4. **Details**: Pre-filled title from category, optional description, severity picker
5. **Review & Submit**: Creates violation + uploads evidence in one flow

### Audit Trail

Every state transition is recorded in the `violation_transitions` table with:
- `from_state` / `to_state`
- `triggered_by` (internal user UUID)
- `reason` (required text)
- `metadata` (JSONB — hearing date, fine amount, etc.)
- `created_at` (timestamp)

This provides a complete, immutable audit trail per WA's 7-year enforcement record retention requirement (RCW 64.38.045).

### Seed Data

`scripts/seed-violation-categories.ts` populates 8 parent categories with 26 subcategories for the Talasera HOA:

| Category | Subcategories |
|---|---|
| Landscaping | Overgrown vegetation, Dead plants, Unapproved modifications, Weed control |
| Parking | Street parking, Commercial vehicles, Inoperable vehicles, Garage conversion |
| Exterior Maintenance | Paint/siding, Roof condition, Fencing, Windows/doors |
| Holiday Decorations | Timing violations, Size/placement |
| Noise | Excessive noise, Construction hours |
| Trash/Debris | Visible trash, Bin storage |
| Unauthorized Structures | Sheds, Fences, Additions |
| Pet Violations | Leash, Waste, Aggressive behavior, Unapproved animals |

---

## Financial Management (Phase 3)

The financial management system enables HOAs to bill assessments, collect payments via Stripe, maintain owner ledgers, and enforce collections — all with fund-level accounting and state-configurable compliance.

### Stripe Connect Integration

Trellis uses Stripe Connect with **destination charges**. Each HOA is a Stripe Express Connected Account. The platform collects payments from homeowners and transfers funds to the HOA's connected account, retaining an application fee.

```
Homeowner                  Stripe                    Platform               HOA Account
    │                        │                          │                      │
    │  PaymentIntent         │                          │                      │
    │───────────────────────>│                          │                      │
    │                        │  Deducts Stripe fees     │                      │
    │                        │  (2.9% + $0.30 card,     │                      │
    │                        │   0.8% ACH capped $5)    │                      │
    │                        │                          │                      │
    │                        │  application_fee_amount  │                      │
    │                        │─────────────────────────>│                      │
    │                        │                          │                      │
    │                        │  Remainder               │                      │
    │                        │─────────────────────────────────────────────────>│
    │                        │                          │                      │
    │                        │  payment_intent.succeeded │                      │
    │                        │─────────────────────────>│                      │
    │                        │                     (webhook updates ledger)     │
```

Key decisions:

- **Custom recurring billing with PaymentIntents** — Stripe Billing/Subscriptions not used (avoids 0.5% surcharge per invoice).
- **ACH is fee-free for homeowners** per WA SB 5129 (at least one payment method without convenience fees). The platform absorbs the 0.8% ACH cost, capped at $5 per transaction.
- **Card payments carry a disclosed convenience fee** (2.9% + $0.30) which becomes the `application_fee_amount`.
- **Financial Connections** for ACH bank verification (Plaid-powered instant bank linking).

### Connected Account Lifecycle

1. Board officer calls `stripeConnect.createConnectedAccount` — creates an Express account, stores `stripe_connect_account_id` on the tenant.
2. Officer uses `stripeConnect.getOnboardingLink` to get a Stripe-hosted KYC/bank setup URL.
3. `account.updated` webhook fires when onboarding completes — sets `stripe_connect_onboarded = true` on the tenant.
4. Treasurer can access the Stripe Express Dashboard via `stripeConnect.getDashboardLink`.

### Payment Flow

1. Owner opens the payments tab, sees outstanding charges via `charge.listByMember`.
2. Owner taps "Pay Now", selects ACH (no fee) or Card (fee disclosed).
3. `payment.createPaymentIntent` creates a Stripe PaymentIntent with `transfer_data.destination` and inserts a `payments` row with status `'processing'`.
4. Mobile app confirms the payment via Stripe's client SDK.
5. `payment_intent.succeeded` webhook fires → updates payment status to `'succeeded'`.
6. `payment.applyPayment` distributes the payment to outstanding charges per the state-mandated payment application order.

### Assessment Billing Engine

Assessments follow a **schedule-based model**. Each `assessment_schedule` defines a recurring charge template (amount, frequency, fund allocation). The `assessment.generateCharges` procedure creates individual `charges` records for each property in a billing period.

Idempotency is enforced by checking for existing charges with the same `(schedule_id, property_id, period_start)` tuple before inserting.

### Fund Accounting

Every charge and payment is tagged with a `fund_tag` (`operating`, `reserve`, `special`, `custom`). Assessment schedules define a `fund_allocation` JSON that splits the assessment across funds (e.g., `{"operating": 0.8, "reserve": 0.2}`).

This enables fund-based financial reporting without a full double-entry general ledger. The `charges` table serves as the receivables ledger, and the `payment_applications` junction table tracks how each payment dollar was applied.

### Collections Engine

The collections workflow (`apps/api/src/lib/collections.ts`) handles:

- **Late fee assessment**: Finds overdue charges past the grace period (default 15 days). WA-compliant: during the 15-day protected period, late fees are capped at $50 or 5% of the unpaid assessment, whichever is less. Idempotent per charge per period.

- **Delinquency classification**: Current, 30-day, 60-day, 90-day, or lien-eligible based on the oldest unpaid charge.

- **Payment application order**: State-configurable via `compliance_profiles.payment_application_order`. Queries profiles with priority cascade (community > state > platform). Default order: interest → late fees → fines → assessments (oldest first) → special assessments.

### State Compliance

Payment application order varies by state:

| State | Order | Source |
|---|---|---|
| Florida | Interest → Late fees → Costs → Principal | Fla. Stat. §720.3085(3)(b) |
| Colorado | Assessments FIRST → Then fines/fees | C.R.S. §38-33.3-316.3 |
| Texas | Delinquent → Current → Attorney fees → Fines | Tex. Prop. Code §209.0063 |
| Washington | Per CC&Rs (no statutory mandate) | RCW 64.90 silent |

The `compliance_profiles` table stores these rules with a priority cascade, allowing community-level overrides of state defaults.

### API Surface

| Router | Procedure | Permission | Description |
|---|---|---|---|
| `stripeConnect` | `createConnectedAccount` | `org:finance:manage` | Create Stripe Express account for HOA |
| `stripeConnect` | `getOnboardingLink` | `org:finance:manage` | KYC/bank setup URL |
| `stripeConnect` | `getAccountStatus` | — | Charges/payouts/details status |
| `stripeConnect` | `getDashboardLink` | `org:finance:manage` | Express Dashboard login |
| `assessment` | `listSchedules` | — | Active schedules for community |
| `assessment` | `createSchedule` | `org:finance:manage` | New recurring or one-time assessment |
| `assessment` | `generateCharges` | `org:finance:manage` | Bulk charge generation for billing period |
| `assessment` | `getRateHistory` | — | Audit trail of rate changes |
| `charge` | `listByMember` | — | Owner ledger view |
| `charge` | `listByProperty` | — | Property charge history |
| `charge` | `listOverdue` | `org:finance:manage` | Board AR aging view (30/60/90+ buckets) |
| `charge` | `waive` | `org:finance:manage` | Waive charge with reason (audit logged) |
| `payment` | `createPaymentIntent` | — | Stripe PaymentIntent with destination charge |
| `payment` | `listByMember` | — | Payment history |
| `payment` | `applyPayment` | `org:finance:manage` | Apply payment to charges per compliance order |
| `payment` | `setupAutopay` | — | Enroll in autopay |
| `payment` | `cancelAutopay` | — | Cancel autopay enrollment |

### Mobile Screens

The payments tab is now a Stack navigator with three screens:

- **Dashboard** (`payments/index.tsx`): Current balance, next due date, "Pay Now" button, recent payments, autopay status.
- **Pay** (`payments/pay.tsx`): Itemized charges, payment method selection (ACH "No fee" / Card with disclosed fee), confirmation.
- **History** (`payments/history.tsx`): Full payment history with status badges.

The admin section gains a **Finance** screen (`admin/finance/index.tsx`):

- Total outstanding and delinquency rate
- AR aging breakdown (current/30/60/90+ day buckets)
- Recent overdue charges
- "Generate Assessments" button for billing cycle

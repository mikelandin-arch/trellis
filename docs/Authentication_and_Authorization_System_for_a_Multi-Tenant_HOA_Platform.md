# Authentication and authorization system for a multi-tenant HOA platform

**Clerk, combined with PostgreSQL Row-Level Security and a layered RBAC+ABAC authorization model, provides a production-ready auth architecture for this HOA management SaaS.** This specification defines the complete authentication and authorization system: a 6-role permission matrix mapped to Clerk Organizations, OAuth 2.0 PKCE flows for Expo mobile, a four-layer tRPC middleware chain that flows tenant context into PostgreSQL RLS, lifecycle management for all user types, and a tamper-proof audit trail stored on S3 with Object Lock. The design enforces default-deny permissions, separation of duties for financial operations, time-bounded vendor/auditor access, and step-up MFA for sensitive actions — all within a TypeScript-first architecture that costs **$125/month** at any scale up to 50,000 users.

---

## 1. Role and permission matrix

### Mapping the 6 primary roles to the 9-role compliance model

The compliance blueprint defines 9 roles; the implementation consolidates these into **6 Clerk organization roles** (fitting within Clerk's 10-custom-role limit) while preserving all 9 behavioral distinctions through metadata and ABAC conditions.

| Clerk Role Key | Primary Role | Compliance Roles Covered | Mapping Notes |
|---|---|---|---|
| `org:super_admin` | Super Admin | Platform Super Admin | Platform-level; set via Clerk `publicMetadata.platform_admin: true` for cross-org access |
| `org:board_officer` | Board Officer/President | Board President/Officers | Distinguished from board_member by elevated approve/configure permissions |
| `org:board_member` | Board Member | Board Members | Governance, voting, financial oversight |
| `org:property_manager` | Property Manager | Property Management Co., Community Manager | Multi-HOA operational access; Community Manager is a Property Manager scoped to one org |
| `org:homeowner` | Homeowner | Homeowner/Member, Tenant/Renter | Default role; Tenant/Renter distinguished via `publicMetadata.residency_type: "tenant"` with reduced permissions (no voting, no ARC submission) |
| `org:committee_member` | Committee Member | (Subset of Board/Member functions) | Committee type stored in `publicMetadata.committees: ["arc", "social"]`; permissions scoped by committee |
| `org:vendor` | Vendor | Vendor, Accountant/Auditor | Auditor distinguished via `publicMetadata.vendor_type: "auditor"` with read-only financial access |

This mapping preserves all 9 behavioral profiles while staying within Clerk's role limit. The `publicMetadata` fields enable ABAC-style conditional checks (e.g., a vendor with `vendor_type: "auditor"` gets `org:finance:read` but not `org:maintenance:manage`).

### Three-level permission architecture

Permissions operate at three levels that compose together for every authorization decision:

**Feature-level** controls which modules a role can access at all. **Action-level** controls what operations are permitted within accessible modules. **Data-level** controls which records are visible, enforced primarily through PostgreSQL RLS policies and supplemented by application-layer filtering.

### Complete permission matrix

Permissions follow Clerk's naming convention: `org:<feature>:<action>`. Each role receives the union of permissions listed below.

| Permission | Super Admin | Board Officer | Board Member | Property Manager | Committee Member | Homeowner | Vendor |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Violation Management** | | | | | | | |
| `org:violations:read` | ✓ All | ✓ All | ✓ All | ✓ All | ✗ | Own | ✗ |
| `org:violations:create` | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| `org:violations:manage` | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| `org:violations:issue_fine` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **ARC Requests** | | | | | | | |
| `org:arc:submit` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| `org:arc:review` | ✓ | ✓ | ✓ | ✓ | ARC only | ✗ | ✗ |
| `org:arc:vote` | ✓ | ✓ | ✓ | ✗ | ARC only | ✗ | ✗ |
| `org:arc:manage` | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ |
| **Financial Management** | | | | | | | |
| `org:finance:read` | ✓ All | ✓ All | ✓ All | ✓ All | ✗ | Own account | Auditor only |
| `org:finance:create` | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| `org:finance:approve` | ✓ | ✓ (SoD) | ✓ (SoD) | ✗ | ✗ | ✗ | ✗ |
| `org:finance:manage` | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ |
| `org:finance:export` | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | Auditor only |
| **Document Management** | | | | | | | |
| `org:documents:read` | ✓ All | ✓ All | ✓ All | ✓ All | Public + committee | Public | ✗ |
| `org:documents:upload` | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| `org:documents:manage` | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ |
| **Communication** | | | | | | | |
| `org:comms:read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| `org:comms:send` | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| `org:comms:broadcast` | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ |
| **HOA Configuration** | | | | | | | |
| `org:config:read` | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| `org:config:manage` | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ |
| **User Management** | | | | | | | |
| `org:members:read` | ✓ | ✓ | ✓ | ✓ | ✓ | Directory | ✗ |
| `org:members:invite` | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| `org:members:manage` | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ |

**Permission composition for multi-role users** follows the additive/union model: a homeowner who is also a board member receives the union of both roles' permissions. If UserA holds `org:homeowner` and `org:board_member`, their effective permissions include all board member permissions plus homeowner permissions. Explicit deny rules override grants only for separation-of-duties constraints (e.g., the creator of an expense cannot approve it regardless of role).

### Separation of duties for financial operations

Financial authorization enforces a **maker-checker pattern** where no single individual can both create and approve a transaction:

| Operation | Maker (Creator) | Checker (Approver) | Constraint |
|---|---|---|---|
| Expense payment | Property Manager | Board Officer/President | `creator_id ≠ approver_id` |
| Budget approval | Property Manager | Board (majority vote) | Quorum required |
| Vendor payment > $500 | Property Manager | Board Officer | Dual-person integrity |
| Special assessment | Board Officer | Board majority vote | Quorum + notification period |
| Reserve fund withdrawal | Board Officer | Board Officer + Board Member | Two distinct approvers |

The application layer enforces this by checking `transaction.created_by !== currentUser.id` before allowing approval, independent of role permissions.

---

## 2. Authentication flow architecture

### Email/password and passwordless flows with Clerk

**Registration** proceeds through Clerk's `useSignUp` hook: the user provides email and password, Clerk sends a verification code to the email address, and upon verification the user is created in Clerk's system. A `user.created` webhook fires, triggering the backend to sync the user record to PostgreSQL. If the user was invited to an HOA organization, the invitation ticket parameter auto-joins them to the organization with the assigned role.

**Magic link (passwordless) authentication** uses Clerk's email link strategy: the user enters their email, Clerk sends a one-time magic link, clicking the link completes authentication via `signIn.create({ strategy: 'email_link' })`. This is available on all Clerk plans including the free tier.

**Social login (Google and Apple)** flows through Clerk's `useSSO` hook (formerly `useOAuth`), which internally implements OAuth 2.0 Authorization Code Flow with PKCE. On mobile, `expo-auth-session` and `expo-web-browser` handle the browser-based OAuth redirect. On web, Clerk manages the redirect flow transparently. Both Google and Apple Sign-In are supported with Clerk handling token exchange and user profile merging.

### OAuth 2.0 Authorization Code Flow with PKCE (mobile)

The Expo mobile app uses PKCE exclusively — the Implicit Flow is deprecated for native apps. The flow proceeds as follows:

1. The Clerk Expo SDK generates a cryptographically random `code_verifier` and computes `code_challenge = SHA256(code_verifier)`
2. The SDK opens an in-app browser via `expo-web-browser` with the authorization request including `code_challenge`
3. The user authenticates with the identity provider (Google, Apple, or Clerk's hosted UI)
4. The provider redirects back to the app's deep link with an authorization `code`
5. The SDK exchanges `code` + original `code_verifier` for tokens at Clerk's token endpoint
6. Clerk validates `SHA256(code_verifier) === code_challenge`, preventing authorization code interception
7. A Clerk session is created, and the **60-second short-lived JWT** is stored via `expo-secure-store`

Universal Links (iOS) and App Links (Android) should be configured instead of custom URL schemes for stronger redirect security, since custom URL schemes have no centralized registry and are vulnerable to interception by malicious apps.

### Biometric authentication on mobile

Clerk provides a first-party `useLocalCredentials()` hook (requires `@clerk/clerk-expo >= 2.2.0`) for biometric sign-in:

1. **First sign-in**: User authenticates with email/password. On success, `setCredentials({ email, password })` stores credentials encrypted via `expo-secure-store` (iOS Keychain / Android Keystore)
2. **Subsequent launches**: App checks `hasCredentials`. If true, displays a "Sign in with Face ID" button
3. **Biometric verification**: `authenticate()` triggers the native biometric prompt (Face ID, Touch ID, or fingerprint). On success, stored credentials are decrypted and Clerk authenticates server-side
4. **Fallback**: If biometric fails 3 times, fall back to email/password entry

The biometric check uses `expo-local-authentication` with `getEnrolledLevelAsync()` preferring **Class 3 (Strong)** biometrics. Set `disableDeviceFallback: true` for sensitive operations to prevent PIN fallback.

### JWT token structure and claims

Clerk JWT v2 (released April 2025) carries organization context in a compact format:

```json
{
  "sub": "user_2s2XJgQ2iQDUAsTBpem9QTu8Zf7",
  "sid": "sess_abc123",
  "v": 2,
  "o": {
    "id": "org_hoa_riverstone",
    "rol": "board_officer",
    "slg": "riverstone-hoa",
    "per": "org:finance:read,org:finance:approve,org:violations:manage",
    "fpm": "1"
  },
  "iat": 1744735428,
  "exp": 1744735488
}
```

The `o` object contains the active organization `id`, the user's `rol` (role) in that organization, the org `slg` (slug), and `per` (permissions). Custom session claims can inject additional metadata (committee assignments, residency type) via the Clerk Dashboard session token template. **Keep custom claims under 1.2KB** to stay within the 4KB cookie limit for web sessions.

### MFA enrollment and step-up authentication

MFA enrollment (requires Clerk Pro plan, $25/month) supports **TOTP authenticator apps**, **SMS codes**, **backup codes**, and **passkeys**. MFA can be enforced globally for all users or allowed as opt-in per user.

**Step-up authentication** for sensitive operations uses Clerk's **Reverification** feature (GA March 2025). When a user attempts a high-risk action — payment approval, PII export, bank account changes — the server checks whether credentials were recently verified:

```typescript
// Server-side: require strict reverification for financial approval
const { has } = await auth();
if (!has({ reverification: 'strict_mfa' })) {
  return reverificationErrorResponse('strict_mfa');
}
// Proceed with financial approval only after MFA re-verification
```

Clerk provides four reverification presets: `lax` (first factor, 10min window), `moderate` (first factor with downgrade), `strict` (multi-factor required), and `strict_mfa` (second factor required, no downgrade). The client-side `useReverification()` hook automatically displays the verification modal when the server returns a reverification error.

**Note**: Native Expo support for `useReverification()` is still being developed. As an interim mobile solution, trigger local biometric auth via `expo-local-authentication`, then call `getToken({ skipCache: true })` for a fresh JWT, and validate on the backend that the token's `iat` (issued-at) is within the last 60 seconds.

### Token refresh strategy

Clerk uses a hybrid session model: **session tokens are 60-second JWTs** refreshed automatically by the SDK using a longer-lived **client token**. No manual refresh logic is needed.

**Web**: The client token is stored as an httpOnly cookie on the Clerk FAPI domain. The Clerk SDK silently fetches a new 60-second JWT before the current one expires. On the server side, `@clerk/fastify` handles validation transparently.

**Mobile**: The Clerk Expo SDK manages token lifecycle in memory, persisting to `expo-secure-store` via the `tokenCache` interface. When the app returns from background, the SDK checks token expiry and silently refreshes. If the device is offline, cached user data remains accessible; tokens refresh when connectivity returns. Session lifetime is configurable from 5 minutes to 10 years on the Pro plan (fixed at 7 days on the free Hobby plan).

---

## 3. Authorization architecture

### How Clerk Organizations map to HOAs

Each HOA community maps to exactly **one Clerk Organization**. The organization's `id` (e.g., `org_riverstone_hoa`) serves as the tenant identifier throughout the entire stack. When a user opens the app and selects an HOA via `OrganizationSwitcher` (web) or a custom picker using `useOrganizationList()` + `setActive()` (native mobile), Clerk sets the **Active Organization** on the session. All subsequent API calls carry this organization context in the JWT.

A single user can belong to **multiple organizations with different roles in each** — a property manager might be `org:property_manager` in five HOAs and `org:homeowner` in their own residential HOA. Switching organizations dynamically updates the JWT claims without re-authentication.

### The four-layer middleware chain

Every tRPC procedure passes through a four-layer middleware chain that transforms an HTTP request into a tenant-scoped, permission-checked database operation:

**Layer 1 — JWT Validation** (`clerkPlugin`): Fastify's Clerk plugin validates the JWT signature, checks expiration, and attaches the `Auth` object to the request. This provides `userId`, `orgId`, `orgRole`, and `orgPermissions`.

**Layer 2 — Organization Context Extraction** (`hasOrgContext` middleware): Verifies that an active organization is set. Extracts `orgId`, `orgRole`, and `orgPermissions` into the tRPC context. Rejects requests without an active org (except Super Admin platform-level operations).

**Layer 3 — Permission Check** (`requirePermission` middleware): Checks whether the user's role and permissions authorize the specific operation. Uses Clerk's `has()` method for simple permission checks and **CASL** (`@casl/ability`) for complex conditional authorization (separation of duties, data-level scoping, committee-specific access).

**Layer 4 — RLS Tenant Context** (`withTenantDb` middleware): Acquires a connection from the PostgreSQL pool, opens a transaction, and executes `SET LOCAL app.current_tenant = $1` with the `orgId`. All subsequent queries in that transaction are automatically filtered by RLS policies. On completion, `COMMIT` or `ROLLBACK` releases the connection; `SET LOCAL` variables are automatically cleared.

```typescript
// Simplified middleware chain illustration
const tenantProcedure = t.procedure
  .use(isAuthed)           // Layer 1: userId must exist
  .use(hasOrgContext)      // Layer 2: orgId must exist  
  .use(requirePermission)  // Layer 3: role/permission check
  .use(withTenantDb);      // Layer 4: SET LOCAL + RLS

// Usage in router
export const violationRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => {
    // RLS automatically filters to current org
    return ctx.dbClient.query('SELECT * FROM violations');
  }),
  create: tenantProcedure
    .use(requirePermission('org:violations:create'))
    .mutation(async ({ ctx, input }) => { /* ... */ }),
});
```

### PostgreSQL RLS enforcement

The database layer enforces tenant isolation with deny-by-default RLS policies:

```sql
-- Safe tenant ID extraction (returns NULL if unset → denies all access)
CREATE FUNCTION current_tenant_id() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.current_tenant', true), '')::TEXT;
$$ LANGUAGE sql STABLE;

-- Every tenant-scoped table gets this policy
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON violations FOR ALL
  USING (org_id = current_tenant_id() AND current_tenant_id() IS NOT NULL)
  WITH CHECK (org_id = current_tenant_id());
```

**Critical security rules**: The application connects as a non-superuser role (superusers bypass RLS). `FORCE ROW LEVEL SECURITY` prevents table owners from bypassing policies. `WITH CHECK` prevents cross-tenant inserts. `SET LOCAL` (not `SET`) scopes the tenant variable to the current transaction, preventing context leakage in connection pools. All columns referenced in RLS policies are indexed for performance.

### Cross-tenant access patterns

**Property Managers** access multiple HOAs by switching the Active Organization in Clerk. Each switch updates the JWT's `o.id` claim, and the middleware sets the corresponding tenant context. A Property Manager never sees data from multiple HOAs simultaneously — they operate within one HOA context at a time, consistent with how they'd manage properties in the real world.

**Super Admins** require cross-tenant access for platform administration. This is handled via a separate connection pool connected as a PostgreSQL role with `BYPASSRLS`:

```sql
CREATE ROLE app_admin;
ALTER ROLE app_admin BYPASSRLS;
```

Super Admin status is verified through `publicMetadata.platform_admin: true` (set only via backend API, never client-side). A dedicated `superAdminProcedure` middleware validates this flag and uses the `BYPASSRLS` pool.

### Committee-specific permission scoping

Committee members receive the `org:committee_member` role with committee assignments stored in `publicMetadata.committees: ["arc", "landscape"]`. The CASL ability builder applies conditional permissions:

```typescript
if (user.role === 'org:committee_member') {
  if (user.committees.includes('arc')) {
    can('review', 'ArcRequest');
    can('vote', 'ArcRequest');
  }
  if (user.committees.includes('finance')) {
    can('read', 'Finance');
  }
  // No permissions for committees they're not on
}
```

This ABAC refinement layer on top of RBAC avoids role explosion (no need for separate `arc_committee_member`, `social_committee_member` roles) while maintaining precise access control.

---

## 4. User lifecycle management

### Invitation and onboarding flows

**New homeowner (property purchase)**: The property manager or board officer creates an invitation via Clerk's Backend API with the buyer's email, role `org:homeowner`, and metadata linking to the property unit. The buyer receives an email with a magic link. If they're a new user, they complete registration; if existing, they accept the invitation. Clerk auto-joins them to the HOA organization. A `organizationMembership.created` webhook triggers the backend to create property ownership records.

**Board member onboarding (post-election)**: An existing homeowner's role is upgraded via `membership.update({ role: 'org:board_member' })` or `org:board_officer`. The application records `term_start` and `term_end` in the `role_assignments` table. An `organizationMembership.updated` webhook logs the role change in the audit trail.

### Property sale and transfer workflow

1. **Initiation**: Property manager marks the property as "pending transfer" in the system, entering buyer email and expected closing date
2. **Seller account transition**: On closing date, the seller's org membership role is downgraded to a temporary `org:homeowner` with `publicMetadata.status: "departing"`. They retain read-only access to their historical records (assessments, payments) for **90 days**
3. **Buyer onboarding**: System generates a Clerk invitation for the buyer with `publicMetadata.property_id` and role `org:homeowner`. Buyer accepts, creating their membership
4. **Data handoff**: Property-linked records (address, lot info, CC&Rs acknowledgment status) transfer to the new owner. Personal records (payment history, violation history) remain associated with the original user
5. **Seller cleanup**: After 90 days, a background job removes the seller's org membership. If they have no other org memberships, their account enters the deactivation flow

### Board member term expiration

The application manages term limits since Clerk does not natively support time-bounded roles:

```sql
CREATE TABLE role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  clerk_membership_id TEXT NOT NULL,
  role TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' -- 'active', 'expired', 'revoked'
);
```

A daily cron job (AWS Lambda on EventBridge schedule) queries for expiring assignments: **30 days before expiration**, the system notifies the board member and board president. **On expiration**, the job calls Clerk's Backend API to downgrade the role to `org:homeowner`, updates `role_assignments.status` to `'expired'`, and creates an audit log entry. The former board member retains homeowner access but loses all board-level permissions immediately.

### Vendor and auditor time-bounded access

Vendors and auditors receive invitations with `publicMetadata.expires_at` set to the project or engagement end date. The authorization middleware checks this timestamp on every request:

```typescript
const isTemporaryAccess = t.middleware(async ({ ctx, next }) => {
  const expiresAt = ctx.auth.orgMembership?.publicMetadata?.expires_at;
  if (expiresAt && new Date(expiresAt) < new Date()) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Access expired' });
  }
  return next({ ctx });
});
```

A daily cron job also revokes expired memberships via the Clerk API as a secondary enforcement mechanism. Vendor access is scoped to assigned work orders only via data-level CASL rules (`can('read', 'WorkOrder', { assignedTo: user.id })`).

### Account deactivation vs. deletion (CCPA compliance)

CCPA grants consumers the right to request deletion with a **45-day compliance window**. However, HOA platforms must retain financial records for **5–7 years** per state HOA laws and SOX-like requirements. The resolution uses a three-phase approach:

1. **Immediate soft delete**: Set `deleted_at` timestamp, revoke all Clerk sessions, remove org membership. User can no longer access the system
2. **PII anonymization** (within 45 days): Replace name → `"Deleted User #[hash]"`, email → anonymized, phone → null, address → null. Financial transaction records retain anonymized references (`payer_id → "anon_abc123"`) but keep the transaction facts (amounts, dates, categories)
3. **Scheduled hard delete**: Background job permanently removes all remaining personal data after the legal retention period expires (7 years for financial-linked records)

Deletion request records are retained for **24 months minimum** (CCPA requirement) in the immutable audit log. The system logs exactly what was anonymized, when, and by whom.

### Role change authorization matrix

| Target Role | Who Can Assign | Approval Required |
|---|---|---|
| Super Admin | Existing Super Admin only | Two Super Admin approval |
| Board Officer | Super Admin, Property Manager | Board vote recorded |
| Board Member | Board Officer, Property Manager | Election certification |
| Property Manager | Super Admin | Contract verification |
| Committee Member | Board Officer, Property Manager | Board resolution |
| Homeowner | Property Manager (auto on property purchase) | None (invitation acceptance) |
| Vendor | Board Officer, Property Manager | Contract + insurance verification |

A user **cannot grant a role with more permissions than they hold themselves**. This is enforced at the API layer by comparing the actor's permission set against the target role's permission set.

---

## 5. Session management and token strategy

### Web vs. mobile session architecture

| Aspect | Web (Next.js) | Mobile (Expo) |
|---|---|---|
| **Session token storage** | `__session` httpOnly cookie (SameSite=Lax, Secure) | `expo-secure-store` (iOS Keychain / Android Keystore) |
| **Client token storage** | httpOnly cookie on Clerk FAPI domain | `expo-secure-store` via `tokenCache` |
| **Token transmission** | Automatic (browser sends cookies) | `Authorization: Bearer <token>` header |
| **CSRF protection** | SameSite cookie attribute | N/A (no cookies) |
| **Token lifetime** | 60-second JWT, auto-refreshed | 60-second JWT, auto-refreshed |
| **Refresh mechanism** | Silent fetch before expiry | SDK manages in memory; refreshes on foreground |

### Session timeout policies by role

| Role | Inactivity Timeout | Maximum Session Lifetime | MFA Requirement |
|---|---|---|---|
| Super Admin | 15 minutes | 8 hours | Required (TOTP) |
| Board Officer | 30 minutes | 24 hours | Required (TOTP) |
| Board Member | 1 hour | 7 days | Recommended |
| Property Manager | 30 minutes | 24 hours | Required (TOTP) |
| Homeowner | 4 hours | 30 days | Optional |
| Vendor/Auditor | 1 hour | 8 hours | Required (TOTP) |

These are enforced through a combination of Clerk's configurable session lifetime (Pro plan) and application-layer middleware that checks `session.lastActiveAt` against the role-specific timeout. When the inactivity timeout is exceeded, the middleware returns a 401 and the client redirects to the sign-in screen.

### Concurrent session and device management

Clerk supports **simultaneous sessions across multiple devices** (Pro plan). The platform allows concurrent sessions with the following constraints: Super Admins are limited to **3 concurrent sessions** (enforced via a `session.created` webhook that counts active sessions and revokes the oldest if exceeded). All other roles allow unlimited concurrent sessions. Users can view and revoke active sessions through their profile settings via Clerk's `<UserProfile />` component. Administrators can force-revoke any user's sessions via the Clerk Backend API for security incidents.

---

## 6. Audit logging specification

### What must be logged

Every security-sensitive action generates an immutable audit record. The system logs **authentication events** (successful and failed logins, MFA enrollment/usage, password changes, session creation/revocation), **authorization events** (role assignments and changes, permission denials, access grants), **financial operations** (assessment creation, payment processing, expense approval, bank account changes), **PII access** (data exports, bulk record views, profile updates), and **system configuration changes** (HOA settings changes, integration modifications, webhook configuration).

### Audit log schema

```sql
CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Actor
  actor_id        TEXT,
  actor_type      TEXT NOT NULL,      -- 'user' | 'system' | 'webhook'
  actor_ip        INET,
  actor_user_agent TEXT,
  -- Tenant context
  organization_id TEXT NOT NULL,
  -- Event
  event_name      TEXT NOT NULL,      -- 'finance.expense.approved'
  action_type     TEXT NOT NULL,      -- 'CREATE' | 'READ' | 'UPDATE' | 'DELETE'
  -- Resource
  resource_type   TEXT NOT NULL,      -- 'expense' | 'violation' | 'user'
  resource_id     TEXT,
  -- Result
  result          TEXT NOT NULL,      -- 'success' | 'failure' | 'denied'
  -- Context
  metadata        JSONB,              -- before/after values, request details
  request_id      TEXT,               -- correlation ID for request tracing
  session_id      TEXT
);
```

The table has **no UPDATE or DELETE permissions** granted to the application role — it is append-only at the database level.

### Three-tier storage pipeline

**Tier 1 — Hot (PostgreSQL)**: Audit logs are written directly to PostgreSQL for real-time querying. Retained for **90 days** with indexes on `(organization_id, timestamp)`, `(actor_id, timestamp)`, and `(event_name, timestamp)`.

**Tier 2 — Warm (S3 Standard)**: A daily batch job exports audit logs older than 7 days to S3 as Parquet files, partitioned by `organization_id/year/month/day`. Queryable via Amazon Athena for historical investigations. Retained for **3 years**.

**Tier 3 — Cold/Immutable (S3 Object Lock, Compliance Mode)**: Financial audit logs are replicated to a dedicated S3 bucket with **Object Lock in Compliance Mode** and a **7-year retention period**. In Compliance Mode, no one — including the root AWS account — can delete or modify objects before the retention period expires. This satisfies SEC 17a-4, FINRA, and state HOA financial record retention requirements.

### Real-time alerting

CloudWatch Metric Filters monitor the audit log stream for suspicious patterns. Key alerts include **5+ failed logins in 10 minutes** per user (temporary account lock + admin notification), **impossible travel** detection (logins from locations >500 miles apart within 1 hour), **privilege escalation** (any role change to admin-level), **bulk data export** (>100 records exported in a single request), and **off-hours Super Admin access** (login between midnight and 5am local time). Alerts route through SNS to a Slack channel and email, with critical alerts (account compromise indicators) triggering automatic session revocation via the Clerk Backend API.

---

## 7. Auth provider evaluation and recommendation

### Head-to-head comparison

| Criterion | Clerk | Auth0 | Supabase Auth |
|---|---|---|---|
| **Multi-tenant Organizations** | Built-in, first-class | Built-in (5 free, unlimited on paid) | Not available; custom-build required |
| **Custom RBAC** | 10 custom roles, custom permissions | Full RBAC on paid plans ($150/mo+) | Custom via Auth Hooks + RLS policies |
| **Free tier** | 50,000 MRU | 25,000 MAU (no RBAC, 5 orgs) | 50,000 MAU (bundled with database) |
| **MFA** | Pro plan ($25/mo): TOTP, SMS, passkeys | Not on free; Essential+ | All tiers (TOTP) |
| **TypeScript SDK quality** | Excellent; TypeScript-first, type-safe `has()` | Good; broader language support | Good; focused on Supabase ecosystem |
| **Expo/React Native** | Dedicated `@clerk/clerk-expo` SDK | `react-native-auth0` | `@supabase/supabase-js` |
| **Pre-built UI components** | Excellent on web; custom UI required for native | Universal Login (hosted page) | Minimal |
| **OrganizationSwitcher** | Built-in component (web); hooks for native | No equivalent component | Not available |
| **Webhooks** | Comprehensive (user, org, membership, session events) | Extensive via Actions/Hooks | Database triggers + Edge Functions |
| **SOC 2 Type II** | Business plan ($250/mo) | All paid plans | Enterprise |
| **Session tokens** | 60-second JWTs with org claims | Configurable JWTs | Configurable JWTs |
| **Step-up auth** | Reverification (GA March 2025) | Actions-based custom flows | Custom implementation |

### Cost analysis at target MAU tiers

The HOA platform requires Organizations with custom RBAC and MFA — these are non-negotiable for the 6-role model and financial operation security.

| MAU Tier | Clerk (Pro + Enhanced B2B) | Auth0 (B2B Essentials) | Supabase Auth |
|---|---|---|---|
| **55 MAU** | **$125/mo** ($25 Pro + $100 Enhanced B2B) | **$150/mo** | **$0** (but no orgs/RBAC — custom build) |
| **530 MAU** | **$125/mo** (still under 50K MRU) | **$150/mo** (at 500 MAU cap) | **$0–25/mo** (Pro for SSO) |
| **5,200 MAU** | **$125/mo** (still under 50K MRU) | **$800+/mo** (Professional tier) | **$25/mo** (Pro, all custom-built) |
| **50,000 MAU** | **$125/mo** (at MRU cap) | **$3,000+/mo** (Enterprise) | **$25/mo** |

**Clerk's flat $125/month up to 50,000 users** represents extraordinary value compared to Auth0's escalating pricing. Supabase Auth is cheapest but requires building the entire Organizations, RBAC, invitation, and role management infrastructure from scratch — likely **3–6 months of additional engineering** that far exceeds the cost difference.

### Recommendation: Clerk confirmed

The existing recommendation of Clerk is **strongly confirmed**. Clerk is the optimal choice for this HOA platform for five reasons:

1. **Organizations are a first-class primitive** that maps directly to HOAs, with multi-org membership, role-per-org, and `OrganizationSwitcher` — features that would take months to build on Supabase Auth or cost significantly more on Auth0
2. **Cost predictability** at $125/month flat versus Auth0's $800+/month at 5,200 MAU, with pricing that remains stable up to 50,000 users
3. **TypeScript-first architecture** with type-safe `has()` permission checks, `ClerkAuthorization` interface for compile-time role/permission validation, and dedicated Expo SDK
4. **Comprehensive webhooks** enabling real-time sync of all user lifecycle events to the application database and audit log
5. **Reverification** provides step-up MFA natively, critical for financial operation security in the HOA context

**Risks to monitor**: The 10-custom-role limit requires the consolidation strategy described in Section 1 (6 Clerk roles + metadata for the 9 behavioral profiles). Native mobile support for Reverification is still in development. SOC 2 Type II requires the Business plan at $250/month (versus $125/month for Pro + Enhanced B2B), which may be needed before enterprise sales.

### Migration contingency

If Clerk's pricing changes unfavorably or the 10-role limit becomes constraining, the architecture is designed for portability. The CASL authorization layer, PostgreSQL RLS policies, and audit log infrastructure are all Clerk-independent. Migration to Auth0 or a custom solution would require replacing the JWT validation middleware and invitation flows, but the authorization logic, database layer, and audit system would remain unchanged. Abstracting the auth provider behind a thin interface (`AuthProvider.validateToken()`, `AuthProvider.getUserOrg()`) in the tRPC context creation is recommended from day one.

---

## Conclusion

This specification defines an authentication and authorization system where **every authorization decision passes through four independent enforcement layers** — Clerk JWT validation, tRPC permission middleware, CASL conditional logic, and PostgreSQL RLS — creating defense-in-depth that prevents any single layer's failure from exposing tenant data. The most novel architectural decision is the hybrid RBAC+ABAC approach that compresses 9 compliance roles into 6 Clerk roles using metadata-driven conditional permissions, avoiding role explosion while preserving granular access control for committee scoping, tenant/renter distinctions, and auditor-specific read-only financial access.

Three implementation priorities stand out. First, the `SET LOCAL` pattern for PostgreSQL RLS within explicit transactions is non-negotiable — using `SET` without `LOCAL` in a connection-pooled environment will leak tenant context between requests, a catastrophic security failure. Second, separation of duties for financial operations must be enforced at the application layer (CASL's `createdBy: { $ne: user.id }` conditions), not just through role permissions, since roles alone cannot prevent a single individual from both creating and approving transactions. Third, the daily cron job for time-bounded access expiration is a critical safety net — while the middleware checks `expires_at` on every request, the cron job ensures Clerk memberships are actually revoked, preventing any gap between application-layer and identity-provider-layer enforcement.

The total cost of this architecture is **$125/month** (Clerk Pro + Enhanced B2B) for up to 50,000 users, with the authorization logic (CASL), data isolation (PostgreSQL RLS), and audit trail (S3 Object Lock) all implemented using open-source or AWS-native components with zero additional per-user fees.
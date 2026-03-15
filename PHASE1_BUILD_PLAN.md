# Trellis HOA Platform — Phase 1 Build Plan

**Domain:** trellishoa.com | **AWS:** 572885593026, us-west-2, profile `hoa`
**Local:** C:\Users\mikel\OneDrive\Desktop\HOA | **Target:** Talasera HOA (55 lots, Bothell WA)

> **Prerequisites:** Complete all steps in `SETUP_INSTRUCTIONS.md` before starting.

---

## Phase 1: Foundation (Weeks 1–4)

**Exit criteria:** Users sign in via magic link, switch between HOAs, see a role-adaptive dashboard. Full schema deployed with RLS enforced.

### Week 1: Monorepo Bootstrap + AWS Infrastructure

**Day 1–2: Local Setup**
- [ ] Complete `SETUP_INSTRUCTIONS.md` Steps 1–7 (scaffold, patches, deps, ESLint, Cursor config)
- [ ] Step 8: Generate Drizzle schema from `schema.sql` via Cursor Plan Mode
- [ ] `turbo run check-types` — zero errors across all packages
- [ ] Initialize git, push to GitHub

**Day 2–3: AWS Infrastructure (CDK)**
- [ ] Register `trellishoa.com` in Route 53
- [ ] `SETUP_INSTRUCTIONS.md` Step 9: Create CDK stacks via Cursor Plan Mode
  - `TrellisNetworkStack`: VPC (2 AZs, public + private subnets)
  - `TrellisDataStack`: RDS PG16 (db.t4g.micro), S3, Secrets Manager
  - `TrellisComputeStack`: App Runner with VPC connector
- [ ] `cdk deploy --all --context stage=dev --profile hoa`
- [ ] Apply `schema.sql` to dev RDS instance
- [ ] Verify RLS: connect as `app_user`, confirm empty without `SET LOCAL`

**Day 4: Seed Data**
- [ ] Seed Talasera: 1 tenant, 1 community, 55 properties, 55 members
- [ ] Seed WA state compliance profile
- [ ] Seed violation categories from Talasera CC&Rs

**Day 5: CI/CD**
- [ ] Verify GitHub Actions `ci.yml` on first PR
- [ ] Configure OIDC federation for AWS deploy (no long-lived secrets)

### Week 2: Authentication + API Foundation

**Day 1–2: Clerk Setup**
- [ ] Create Clerk application (magic link, Google OAuth, Apple Sign-In)
- [ ] Configure 7 organization roles per the permission matrix
- [ ] Set up webhook endpoint for user/org lifecycle events
- [ ] Create Talasera org, invite yourself as `org:board_officer`

**Day 2–3: Fastify + tRPC Server** *(Cursor Plan Mode)*
- [ ] Wire Fastify with `@clerk/fastify` plugin
- [ ] Create tRPC context: extract userId, orgId, orgRole from JWT
- [ ] Implement 4-layer middleware chain:
  - `isAuthed` → JWT valid
  - `hasOrgContext` → active org set
  - `requirePermission` → role/permission check
  - `withTenantDb` → BEGIN → SET LOCAL → execute → COMMIT
- [ ] Create `propertyRouter.list` — first RLS-protected endpoint
- [ ] Test: verify list returns only current tenant data

**Day 4–5: Mobile Shell**
- [ ] Configure tRPC client in `@repo/api-client`
- [ ] Set up Expo app with ClerkProvider + expo-secure-store tokenCache
- [ ] Auth screens: `(auth)/welcome.tsx`, `(auth)/verify.tsx`
- [ ] Organization switcher via `useOrganizationList()` + `setActive()`
- [ ] Verify: sign in via magic link → see active org

### Week 3: Core Data + Dashboard

**Day 1–2: API Routers**
- [ ] `communityRouter`: get current community
- [ ] `propertyRouter`: list, get by ID
- [ ] `memberRouter`: list, get by ID, current user member record
- [ ] `violationRouter`: list (filtered), get by ID (placeholder for Phase 2)

**Day 3–4: Mobile Dashboard**
- [ ] Bottom tabs with role-based visibility (Tabs.Protected)
  - Home (all), Payments (homeowner+), Community (all), Requests (homeowner+), Admin (board+)
- [ ] Role-adaptive home screen:
  - Homeowner: balance, recent activity, next due date
  - Board: action items, community health, quick actions
- [ ] Community directory, pull-to-refresh, loading skeletons, empty states

**Day 5: Webhooks**
- [ ] Clerk webhooks: user.created, user.updated, orgMembership.* → sync to DB
- [ ] Idempotent processing with event_id deduplication

### Week 4: Polish + Deploy

**Day 1–2: Offline Foundation**
- [ ] react-native-mmkv for auth tokens and preferences
- [ ] Network status detection (neutral state, not error)
- [ ] Cache dashboard data for offline viewing
- [ ] Sync indicator (not error banner) when offline

**Day 3: Testing**
- [ ] RLS isolation: tenant A can't see tenant B data
- [ ] Middleware chain: unauthenticated → 401, wrong org → 403
- [ ] Zod validation for all router inputs

**Day 4: Deploy**
- [ ] Deploy API to App Runner via CDK
- [ ] Create EAS project, configure profiles
- [ ] Build dev client: `eas build --profile development --platform ios`
- [ ] E2E: mobile → App Runner → RDS with RLS

**Day 5: Wrap**
- [ ] Document env vars and secrets
- [ ] Create Phase 2 GitHub Issues
- [ ] Tag: `v0.1.0-foundation`

---

## Phase 2: Core Violation Management (Weeks 5–8)

**Exit criteria:** Board members document violations in <60 seconds from phone. Full state machine with WA compliance.

- **Week 5:** Violation CRUD + state machine enforcement + category management
- **Week 6:** Mobile violation workflow (45-second capture: tap → camera → GPS → category → submit)
- **Week 7:** S3 evidence upload (pre-signed URLs, compression, photo gallery)
- **Week 8:** Notice generation, WA compliance engine, violation dashboard, `v0.2.0-violations`

## Phase 3: Financial Management (Weeks 9–14)
Stripe Connect, assessment billing, ACH payments, owner ledger, late fees, autopay, reporting

## Phase 4: Communication + Documents (Weeks 15–18)
Announcements, SES email, document management, meeting minutes, board directory

## Phase 5: Advanced Features (Weeks 19–26)
ARC workflow, committees, Twilio SMS, Lob certified mail, Next.js admin panel

## Phase 6: Scale + Polish (Weeks 27–32)
Performance, CloudWatch, App Runner → Fargate, app store submission, onboarding

---

## Quick Reference

| Layer | Technology | Key Decision |
|-------|-----------|-------------|
| Mobile | Expo SDK 53 / RN 0.79 / React 19 | New Architecture default, expo-background-task for sync |
| API | Fastify v5, tRPC v11 | tRPC for internal, REST for webhooks |
| Auth | Clerk ($125/mo flat to 50K MAU) | 6 roles + metadata ABAC, magic link + biometric |
| DB | PostgreSQL 16 / RDS / Drizzle ORM | Shared DB + tenant_id + RLS, SET LOCAL in transactions |
| Payments | Stripe Connect (destination charges) | Build custom billing (skip Stripe Billing 0.5% surcharge) |
| Pooling | PgBouncer transaction mode | NOT RDS Proxy (incompatible with RLS SET LOCAL) |
| Offline | MMKV + WatermelonDB + expo-sqlite | 3-tier: fast KV / relational sync / ad-hoc queries |
| Infra | AWS CDK, App Runner → Fargate | ~$54/mo at launch, $589/mo at 5K units |

**Compliance:** WA (RCW 64.38 + WUCIOA) primary. Monitor SB 5129, ESSB 5796. ~60% universal / ~40% per-state.
**Cost:** Break-even at 50 units ($150 revenue vs $54 costs). 92% margins at 500 units.

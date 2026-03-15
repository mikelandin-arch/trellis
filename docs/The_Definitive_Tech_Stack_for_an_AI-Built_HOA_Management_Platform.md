# The definitive tech stack for an AI-built HOA management platform

**Full-stack TypeScript with tRPC, Expo, Fastify, and Clerk on AWS delivers the optimal balance of Cursor AI productivity, cost efficiency, and scalability for a multi-tenant HOA SaaS.** This stack keeps a solo developer inside a single language ecosystem where types flow automatically from database to mobile screen, enabling Cursor to reason across the entire codebase simultaneously. Starting costs sit at roughly **$54/month** for a single HOA and scale to **$589/month** at 5,000 units across 20+ communities — well within the 64–95% gross margins that HOA management pricing supports. The recommendations below build on your existing AWS-native direction while making targeted departures where the evidence strongly favors alternatives, particularly replacing OpenSearch with PostgreSQL full-text search and adopting Clerk over Auth0 for authentication.

---

## 1. Ten technology decisions with full justification

### Mobile framework: React Native with Expo SDK 53

**React Native (Expo) is the only defensible choice** given the Cursor-first development model. Cursor's AI engine draws from the massive TypeScript/React training corpus — the largest of any frontend ecosystem — producing dramatically better code suggestions than it would for Dart (Flutter) or service worker APIs (PWA). Expo SDK 53, released April 2025 on React Native 0.79 and React 19, enables the New Architecture by default with **74.6% production adoption** and introduces `expo-background-task` for offline sync via Android WorkManager and iOS BGTaskScheduler.

The violation documentation workflow meets the under-60-second requirement comfortably. The sequence — tap "New Violation," open `expo-camera`'s `CameraView`, capture with `takePictureAsync()`, auto-populate property from GPS or selection, choose violation type from a dropdown, save locally via WatermelonDB in under 100ms — completes in roughly **20–30 seconds** in practice. Photos queue locally and sync when connectivity returns through `expo-background-task`.

Flutter was eliminated because Dart's smaller AI training corpus weakens Cursor assistance, and Flutter lacks an equivalent to EAS Update's instant over-the-air JS updates. PWAs were eliminated because **iOS still lacks background sync**, aggressively evicts cached storage, and requires a multi-step home-screen install before push notifications work — disqualifying for field inspection reliability.

**Offline architecture** uses a three-tier approach: **react-native-mmkv v4** (30x faster than AsyncStorage, encrypted, synchronous) for auth tokens, tenant context, and preferences; **WatermelonDB** (reactive, relational, built-in pull/push sync protocol, 99.8% sync success rate in production) for violations, properties, inspection records, and work orders; and **expo-sqlite** for complex ad-hoc reporting queries.

Push notifications route through **expo-notifications with Expo Push Service**, which abstracts FCM and APNs into a single REST endpoint. This is simpler than direct `@react-native-firebase/messaging` integration and avoids notification handler conflicts on Android. Migration to direct FCM remains straightforward if needed.

### Backend framework: Fastify with TypeScript

**Fastify outperforms Express by 2–5.6x** in benchmarks (114,195 vs 20,309 req/sec in independent tests) while providing native TypeScript definitions, built-in Ajv schema validation, structured plugin encapsulation, and integrated Pino logging. For a solo developer, Fastify's guardrails reduce bugs without adding configuration burden.

Supabase as a sole backend was evaluated and rejected for this use case. While Supabase excels as a PostgreSQL hosting and realtime layer, it has critical limitations for complex business logic: **no transaction support in the PostgREST client** (forcing business logic into PL/pgSQL stored procedures), no native organization-based RBAC, and global email uniqueness that conflicts with users belonging to multiple HOAs. Multiple production users report that "once you need to go beyond CRUD, the Supabase client becomes insufficient."

Django was eliminated because it breaks the full-stack TypeScript advantage. Running Python on the backend forces two languages, two dependency ecosystems, and eliminates the tRPC end-to-end type safety that is the single biggest productivity multiplier with Cursor. The cognitive overhead of context-switching between Python and TypeScript doubles the effective complexity for a solo developer.

The backend runs on **AWS App Runner** at small scale (auto-scales to near-zero, ~$7/month idle) and transitions to **ECS Fargate with ARM/Graviton2** at scale for ~30–50% cost savings over x86. AWS Lambda handles async workloads: PDF generation, OCR via Textract, image processing, and scheduled jobs.

### Database: PostgreSQL on RDS with Row-Level Security

**PostgreSQL with RLS is the proven choice** and your existing specs are exactly right. RLS policies using `current_setting('app.current_tenant')` comparisons behave as invisible WHERE clauses with negligible performance overhead when `tenant_id` columns are properly indexed — benchmarks show **100x+ improvement on large tables** with GIN/B-tree indexes on tenant columns. Companies like Dovetail have run RLS-based multi-tenancy for 5+ years successfully.

Critical implementation practices: use a dedicated `app_user` role (superusers bypass RLS by default); set `FORCE ROW LEVEL SECURITY` on table owners; denormalize `tenant_id` onto leaf tables rather than relying on joins; wrap `current_setting()` in SQL SELECT statements to trigger initPlan caching; and use PostgreSQL 15+ with `security_invoker = true` on views. Connection pooling (PgBouncer or RDS Proxy) requires careful session variable management — set tenant context per transaction.

MongoDB was never a serious contender given the deeply relational data model (lots → owners → assessments → violations with complex state machines). MySQL lacks JSONB flexibility and RLS. **RDS db.t4g.micro at $11.68/month** is the starting point, scaling to db.t4g.medium at $47.45/month for 5,000+ units.

### API layer: tRPC for internal APIs, REST for webhooks

**tRPC is the highest-leverage technology choice in this entire stack for Cursor AI development.** It eliminates the schema definition → code generation → type import pipeline entirely. Types flow automatically from Fastify procedure definitions to React Native query hooks via TypeScript inference. When Cursor modifies a backend procedure's return type, every consuming mobile component immediately shows type errors — preventing the cascading hallucinations that plague AI-generated code with loosely-typed APIs.

tRPC v11 is production-stable, used by Cal.com and other major TypeScript applications. It works with React Native through the `import type { AppRouter }` pattern (TypeScript's `import type` imports only types, never runtime code, keeping mobile bundles clean). Input validation uses Zod schemas that double as runtime validators on the backend and form validators on the frontend — defined once in a shared monorepo package.

GraphQL was evaluated and rejected as overkill. For a solo developer controlling both web and mobile clients in a TypeScript monorepo, GraphQL adds schema SDL maintenance, resolver implementation, N+1 prevention with DataLoader, and custom caching — none of which provides value over tRPC's zero-config approach. GraphQL shines with multiple teams or multiple client technologies; neither applies here.

Standard **REST endpoints sit alongside tRPC** for Stripe webhooks, Lob callbacks, and any future third-party integrations. This is a well-documented pattern: tRPC handles all internal client-server communication while Express/Fastify routes handle external callbacks.

### Authentication: Clerk

**Clerk maps directly to the multi-tenant HOA model** and saves weeks of development compared to alternatives. Its native Organizations feature lets users belong to unlimited organizations (HOAs) with different roles per org, an `<OrganizationSwitcher />` component provides production-ready UI for switching between HOAs, and RBAC configuration takes **30 minutes to 2 hours** versus 1–2 days on Auth0 or weeks of custom development on Supabase Auth.

The 9-role RBAC model (super admin through vendor) maps to Clerk's organization roles. The active organization context determines data access, which feeds directly into the RLS `current_tenant` session variable. Clerk's TypeScript-first SDK (`@clerk/clerk-react`, 800K+ weekly npm downloads) provides typed user/org data through the `auth()` helper.

Pricing strongly favors Clerk: **10,000 free MAUs** covers all three growth scales (55, 530, and 5,200 active users all fall under the limit). At 100,000 MAUs, Clerk costs ~$200/month versus Auth0's ~$6,300/month — a **31x cost difference**. Auth0's only advantage is broader compliance certifications (ISO 27001, PCI DSS), but Clerk now holds SOC 2 Type 2, HIPAA, GDPR, and CCPA — sufficient for HOA management.

Supabase Auth was eliminated due to global email uniqueness (breaks multi-HOA membership), no native organization management, and manual RBAC implementation. Firebase Auth was eliminated for weak React Native integration and complex multi-tenant RBAC.

### Cloud hosting: AWS with serverless-first architecture

**AWS at $30–60/month is actually cheaper than Railway or Render** for database-backed applications. Railway's managed PostgreSQL starts at ~$92.50/month for equivalent resources to an RDS db.t4g.micro at $11.68/month — an 8x premium. The perceived complexity of AWS is mitigated by using App Runner (simpler than ECS) and Infrastructure as Code via AWS CDK.

The serverless-first approach minimizes idle costs: Lambda handles async processing within the perpetual free tier (1M requests/month), API Gateway HTTP API costs $1.00/million requests, CloudFront provides a perpetual free tier of 1 TB data transfer, and SES sends email at $0.10/thousand. New AWS accounts created after July 2025 receive **$200 in credits**, further reducing first-year costs.

The growth path is natural: App Runner → ECS Fargate → ECS with auto-scaling. No re-architecture required. GCP offers comparable services but lacks the depth of managed services (no equivalent to Textract for OCR, weaker SES alternative). Vercel cannot host WebSocket connections, eliminating it for real-time features.

### File storage: S3 with KMS encryption

**S3 is the only option that satisfies all legal compliance requirements.** Object Lock in Compliance mode provides WORM (Write Once Read Many) storage for CC&Rs, board meeting minutes, and financial records — legally immutable even by the root account. KMS encryption with customer-managed keys creates an audit trail for compliance. Lambda triggers enable automated document processing pipelines (thumbnail generation, virus scanning, OCR via Textract).

Cloudflare R2 was evaluated and lacks both Object Lock and KMS — disqualifying for legal document retention. R2's zero-egress advantage is irrelevant at this scale: **10 GB of S3 storage costs $0.23/month**, and the first 100 GB of egress is free across all AWS services monthly.

The mobile upload pattern uses pre-signed PUT URLs: the backend generates a time-limited S3 upload URL, the mobile client uploads directly to S3 (bypassing the backend), and an S3 event triggers Lambda for post-processing. This scales efficiently and keeps violation photos off the application server.

### Real-time: Push notifications plus SSE, not WebSockets

**Push notifications via FCM/APNs handle 90% of real-time needs** in an HOA app. Violation status changes, board meeting reminders, assessment due dates, and community announcements all work perfectly as push notifications — they reach users when the app is backgrounded or closed, which WebSockets cannot do.

For in-app live updates (a community manager watching violation status changes in real-time), **Server-Sent Events (SSE)** provide one-way server-to-client streaming over standard HTTP with built-in auto-reconnection. SSE is simpler than WebSockets, works through CDNs and proxies, and avoids the stateful connection management that makes WebSocket scaling complex.

AWS API Gateway WebSocket API costs are minimal (~$1.58/month at 200 users) but adds significant complexity: no built-in broadcasting (you must manage connection IDs in DynamoDB and fan out messages individually), no guaranteed delivery, and no ordering. **Defer WebSocket implementation** until interactive features (live chat, collaborative editing) create a genuine requirement.

### Search: PostgreSQL full-text search, not OpenSearch

**OpenSearch Serverless at $174–350/month is wildly disproportionate** for an HOA SaaS with a few thousand documents. PostgreSQL's built-in full-text search with `tsvector`, `tsquery`, and GIN indexes handles sub-100ms queries on **500 million+ rows** with proper indexing. For searching board minutes, CC&Rs, financial reports, and violation records across 20 HOAs, PostgreSQL FTS is more than sufficient for years.

The `pg_trgm` extension adds typo tolerance (fuzzy matching). Field boosting is achievable with `ts_rank` weights. And critically, **PostgreSQL FTS works automatically with RLS** — search results are tenant-isolated without any additional configuration. A SaaS company (wenabi) actually migrated away from Elasticsearch to PostgreSQL FTS because keeping the search index synchronized was harder than the search problem itself.

Migrate to OpenSearch only when search queries demonstrably exceed PostgreSQL's capacity, you need sophisticated BM25 relevance ranking or learn-to-rank, or you're indexing millions of documents with complex faceted search. This is unlikely within the first 2–3 years.

### CI/CD: GitHub Actions plus Expo EAS Build

**GitHub Actions provides 2,000 free minutes/month** on private repos (3,000 with Pro at $4/month) — more than sufficient for a solo developer. The Expo team maintains an official `expo/expo-github-action@v8` that triggers EAS Build and returns immediately (`--no-wait` flag), avoiding wasting GitHub Actions minutes waiting for native builds.

The pipeline: GitHub Actions runs linting, type-checking, and unit tests on every PR; merges to `main` trigger EAS Build for native app bundles and deploy the backend via AWS CDK; EAS Update pushes JavaScript-only changes over the air without app store review. **EAS Build's free tier provides 30 builds/month** (15 iOS), sufficient for development. The Production plan at $99/month unlocks priority builds and higher update MAU limits.

AWS CodePipeline was eliminated as unnecessarily complex for a solo developer. EAS Workflows (Expo's own CI/CD on M4 Pro machines) is an emerging alternative worth monitoring but currently less mature than GitHub Actions for full-stack deployments.

---

## 2. How all the components connect

The architecture follows a clean separation between mobile clients, API layer, business logic, data persistence, and external services, organized as a Turborepo monorepo.

**Client tier**: The React Native Expo app communicates with the backend exclusively through tRPC queries and mutations over HTTPS. Clerk's `<ClerkProvider>` wraps the app, injecting JWT tokens into every tRPC request. The active organization (HOA) ID from Clerk's `useOrganization()` hook is sent as context with each request. WatermelonDB maintains a local SQLite mirror for offline field work, syncing with the backend via a dedicated tRPC sync procedure.

**API and business logic tier**: A Fastify server hosts the tRPC router, organized by domain (violations, assessments, properties, communications). Clerk middleware validates JWTs and extracts user/organization data. Before each database query, the server sets `SET app.current_tenant = '<org_id>'` on the PostgreSQL session, activating RLS policies. Complex business logic — violation state machines, assessment calculations, late fee processing — runs as pure TypeScript functions within Fastify, with full transaction support via Prisma or Drizzle ORM.

**Data tier**: RDS PostgreSQL stores all relational data with RLS enforcing tenant isolation. S3 stores documents and photos, organized by `tenant_id/document_type/year/` prefixes. Pre-signed URLs enable direct mobile-to-S3 uploads. Lambda functions triggered by S3 events handle post-upload processing (thumbnail generation, OCR via Textract, virus scanning).

**External service tier**: Stripe handles payment processing with webhook events flowing to dedicated REST endpoints on the Fastify server. SES sends transactional emails (assessment notices, violation letters). Twilio sends SMS notifications. Lob handles physical mail. Firebase Cloud Messaging (via Expo Push Service) delivers push notifications. All external service callbacks arrive as REST webhooks alongside the tRPC router.

**Infrastructure tier**: App Runner (small scale) or ECS Fargate (at scale) hosts the Fastify server. API Gateway HTTP API provides the entry point with CloudFront as CDN. Lambda handles async workloads. CloudWatch provides monitoring and alerting. All infrastructure is defined in AWS CDK (TypeScript), stored in the monorepo.

```
┌─────────────────────────────────────────────────────────┐
│                    MONOREPO (Turborepo)                  │
│                                                         │
│  apps/mobile (Expo)  ←──tRPC──→  apps/api (Fastify)    │
│  apps/web (Next.js)  ←──tRPC──→       │                │
│                                        │                │
│  packages/shared    packages/db    packages/api-client  │
└─────────────────────────────────────────────────────────┘
         │                                    │
    ┌────┴────┐                    ┌──────────┴──────────┐
    │  Clerk  │                    │   AWS Infrastructure │
    │  Auth   │                    │                      │
    └─────────┘                    │  RDS PostgreSQL(RLS) │
                                   │  S3 + KMS + Lock     │
    ┌─────────┐                    │  Lambda (async)      │
    │ Expo    │                    │  SES / CloudWatch    │
    │ Push    │──→ FCM/APNs        │  App Runner/Fargate  │
    └─────────┘                    └──────────────────────┘
                                            │
                              ┌──────────────┼───────────┐
                              │              │           │
                           Stripe        Twilio        Lob
```

---

## 3. Cost projections across three growth stages

| Category | 50 units (1 HOA) | 500 units (2–3 HOAs) | 5,000 units (20+ HOAs) |
|----------|------------------:|---------------------:|-----------------------:|
| **AWS Infrastructure** | | | |
| Database (RDS PostgreSQL) | $14 | $29 | $70 |
| Compute (App Runner/Fargate) | $7 | $14 | $58 |
| Storage (S3) | $0.03 | $0.23 | $2.30 |
| Serverless (Lambda + API GW) | $0 | $1 | $11 |
| Email (SES) | $0.01 | $0.10 | $1 |
| CDN + monitoring | $0 | $0 | $10 |
| **Infrastructure subtotal** | **$21** | **$45** | **$152** |
| **Third-party services** | | | |
| Authentication (Clerk) | $0 | $0 | $0–25 |
| SMS (Twilio) | $2 | $8 | $55 |
| Direct mail (Lob) | $0 | $18 | $222 |
| Push notifications (FCM) | $0 | $0 | $0 |
| Mobile builds (EAS) | $0 | $19 | $99 |
| Payments (Stripe) | pass-through | pass-through | pass-through |
| **Third-party subtotal** | **$2** | **$45** | **$401** |
| **Development tools** | | | |
| Cursor Pro | $20 | $20 | $20 |
| GitHub + domain + app stores | $11 | $11 | $15 |
| **Dev tools subtotal** | **$31** | **$31** | **$35** |
| | | | |
| **Monthly total** | **$54** | **$121** | **$589** |
| **Annual total** | **$650** | **$1,448** | **$7,063** |
| Potential revenue (@$3/unit) | $150/mo | $1,500/mo | $12,500–15,000/mo |
| **Gross margin** | **64%** | **92%** | **95%** |

Clerk's **10,000 free MAU tier** covers all three scales. Stripe's 2.9% + $0.30 transaction fees are pass-through costs borne by homeowners paying dues, not platform operating expenses. Lob dominates third-party costs at scale — defer physical mail integration until a paying customer requires it. First-year costs can be **$15–30/month lower** using AWS free tier credits ($200 for new accounts post-July 2025).

---

## 4. Development timeline from MVP through maturity

**Phase 1 — Foundation (Weeks 1–4):** Monorepo setup with Turborepo, Fastify + tRPC server, Clerk integration, RDS PostgreSQL with RLS schema, basic Expo app shell with authentication and organization switching. Deliverable: users can sign in, switch between HOAs, and see a dashboard.

**Phase 2 — Core violation management (Weeks 5–8):** Violation CRUD with state machine (reported → under review → hearing scheduled → resolved/escalated), camera capture workflow, photo upload to S3 via pre-signed URLs, offline support with WatermelonDB, push notifications for status changes. Deliverable: community managers can document violations in under 60 seconds from a smartphone.

**Phase 3 — Financial management (Weeks 9–14):** Assessment creation and tracking, Stripe integration for online dues payments, late fee calculation engine, owner account ledgers, basic financial reporting. Deliverable: HOAs can collect dues and track delinquencies.

**Phase 4 — Communication and documents (Weeks 15–18):** Community announcements, SES email notifications, document management (upload, version, search via PostgreSQL FTS), board meeting minutes with approval workflows. Deliverable: full communication platform replacing email chains.

**Phase 5 — Advanced features (Weeks 19–26):** Architectural review submissions, committee workflows, vendor management, Twilio SMS integration, Lob direct mail for formal notices, enhanced reporting dashboard, admin web panel (Next.js). Deliverable: feature parity with mid-market competitors.

**Phase 6 — Scale and polish (Weeks 27–32):** Performance optimization, enhanced monitoring via CloudWatch, migration from App Runner to ECS Fargate, app store submissions, onboarding flows, documentation. Deliverable: production-ready for multiple paying HOAs.

A solo developer using Cursor AI should expect **30–40% faster cycle times** compared to traditional development based on practitioner reports, making the 32-week timeline aggressive but achievable with focused execution. The MVP (Phases 1–2, violations core) ships in **8 weeks** and provides immediate value for a single HOA pilot.

---

## 5. Maximizing Cursor AI productivity across the stack

### Monorepo structure optimized for AI context

Turborepo with pnpm workspaces is the recommended monorepo tool — **20 lines of configuration** versus ~200 for Nx, with 3x faster build times in benchmarks. The structure enables Cursor to understand cross-package relationships:

```
hoa-platform/
├── apps/
│   ├── mobile/          # Expo React Native
│   ├── web/             # Next.js admin panel
│   └── api/             # Fastify + tRPC server
├── packages/
│   ├── shared/          # Zod schemas, types, constants
│   ├── db/              # Drizzle/Prisma schema + migrations
│   ├── api-client/      # tRPC router type exports
│   └── tsconfig/        # Shared TypeScript configs
├── .cursor/rules/       # Project-specific AI rules
├── turbo.json
└── pnpm-workspace.yaml
```

### Cursor rules configuration

Cursor 2.0 (released October 2025) introduced `.cursor/rules/*.mdc` files replacing the deprecated `.cursorrules` file. Create domain-specific rule files scoped by glob pattern:

- **`typescript.mdc`** (always active): Enforce `strict: true`, ban `any` (use `unknown`), ban enums (use union types), require Zod for all external data validation, use functional/declarative patterns, explicit return types on all functions.
- **`react-native.mdc`** (glob: `apps/mobile/**`): Expo managed workflow, expo-router for navigation, functional components with hooks, MMKV for key-value storage, WatermelonDB for relational data.
- **`api.mdc`** (glob: `apps/api/**`): Fastify patterns, tRPC procedure structure (publicProcedure, protectedProcedure, adminProcedure), Zod input validation, RLS tenant context setting.
- **`behavioral.mdc`** (always active): "Never disable ESLint rules," "never use `@ts-ignore`," "aim for the smallest possible code change," "always check existing code before acting."

### Patterns that amplify AI-assisted development

**Smaller files produce better AI output.** Cursor reasons more accurately about files under 200 lines. Split large modules into focused, single-responsibility files that AI can fully comprehend within its context window.

**tRPC is the single biggest AI productivity multiplier.** Because types propagate automatically, Cursor detects breaking changes across the entire stack instantly. No schema files to maintain, no code generation to run, no type import boilerplate to write. A procedure change on the server immediately surfaces type errors in every consuming mobile component.

**Zod schemas defined once in `packages/shared`** serve triple duty: tRPC input validation, form validation on mobile, and database constraint documentation. Cursor understands Zod deeply and generates correct validation schemas from natural language descriptions.

**Install Radon IDE** (Software Mansion) — a Cursor extension that runs iOS Simulator and Android emulator directly in the editor with click-to-component navigation and network inspection. Described as improving React Native workflow by "10x."

**Use Cursor's `@` context system aggressively.** Reference `@packages/shared/schemas/violation.ts` when asking Cursor to build a violation form. Reference `@apps/api/src/routers/violation.ts` when building the mobile query hook. The explicit context prevents hallucination.

**Commit frequently with atomic changes.** Cursor 2.0's multi-agent mode (up to 8 parallel agents with git worktree isolation) enables parallel development across features, but relies on clean git history for rollback when AI output needs correction.

**Add framework documentation** via Cursor Settings → Features → Docs. Index Expo, tRPC, Fastify, Clerk, Drizzle/Prisma docs selectively — less is more, as over-indexing slows retrieval.

---

## Conclusion: an opinionated stack built for AI-era solo development

The recommended stack — **Expo SDK 53, Fastify, tRPC, PostgreSQL with RLS, Clerk, and AWS** — is not merely a collection of good individual choices. It forms a coherent system where each technology amplifies the others through TypeScript's type system. The critical insight is that **full-stack TypeScript plus tRPC creates a uniquely powerful feedback loop with Cursor AI**: types flow from database schema through backend procedures to mobile components automatically, errors surface immediately in the editor, and the AI understands the entire application context without language-switching overhead.

Three departures from the original architectural direction deserve emphasis. First, **replace OpenSearch with PostgreSQL full-text search** to eliminate $174–350/month in minimum costs and weeks of integration work for a capability that PostgreSQL handles trivially at this document scale. Second, **choose Clerk over Auth0** for 31x lower cost at scale, native organization-based multi-tenancy that maps directly to the HOA model, and pre-built React components that eliminate weeks of auth UI development. Third, **use SSE and push notifications instead of WebSockets** initially — the complexity of managing stateful WebSocket connections with API Gateway and DynamoDB connection tracking is unjustified until interactive features like live chat create a real requirement.

The platform reaches profitability remarkably quickly. At just **50 paying units** ($150/month revenue against $54/month costs), the business breaks even. By 500 units, gross margins hit 92%. The technology choices are deliberately optimized for this economic trajectory: minimal fixed costs, generous free tiers across Clerk/FCM/Lambda/CloudFront, and a smooth scaling path from App Runner to ECS Fargate without re-architecture.
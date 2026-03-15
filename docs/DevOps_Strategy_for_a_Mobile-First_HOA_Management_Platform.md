# DevOps strategy for a mobile-first HOA management platform

**This platform can ship reliably with a $0–170/month monitoring and DevOps tooling budget layered on top of confirmed infrastructure costs.** The strategy centers on GitHub Actions with Turborepo-aware caching, Sentry Free for error tracking, Better Stack Free for uptime/alerting, and PgBouncer (not RDS Proxy) for connection pooling with RLS — the single most critical architectural finding in this report. Every recommendation below maps directly to the confirmed stack and scales from one HOA at $56/month total to 20+ communities without re-platforming.

The core insight across all 10 research areas is that a solo developer managing financial data needs _automation depth_, not _tool breadth_. Self-healing infrastructure, structured logging with tenant context, and pre-written runbooks matter far more than expensive APM suites. The sections below provide implementable specifications for the complete DevOps lifecycle — from code commit through production incident resolution.

---

## 1. Infrastructure architecture from commit to production

The following text-based diagram shows the complete flow from development through production monitoring. Every service listed is from the confirmed tech stack.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DEVELOPER WORKSTATION                        │
│  Cursor AI → Code → Git Push → GitHub (Turborepo Monorepo)         │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     GITHUB ACTIONS CI/CD                            │
│                                                                     │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  Quality  │  │   Build   │  │ Migrate  │  │    Deploy        │  │
│  │  ───────  │  │  ───────  │  │ ───────  │  │    ──────        │  │
│  │  ESLint   │→ │  Docker   │→ │ Drizzle  │→ │  CDK Deploy      │  │
│  │  TypeCheck│  │  Build    │  │ Kit      │  │  (OIDC auth)     │  │
│  │  Vitest   │  │  ECR Push │  │ migrate  │  │                  │  │
│  │  (turbo   │  │           │  │          │  │  EAS Update      │  │
│  │ --affected)│ │           │  │          │  │  (OTA push)      │  │
│  └──────────┘  └───────────┘  └──────────┘  └──────────────────┘  │
│                                                                     │
│  Separate: EAS Build (workflow_dispatch, --no-wait)                 │
│  Separate: Mobile Preview (expo-github-action/preview on PRs)      │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
│   AWS ECR    │ │  EAS Build   │ │  EAS Update      │
│  (Container  │ │  (Native     │ │  (OTA JS Bundle) │
│   Registry)  │ │   Builds)    │ │                  │
└──────┬───────┘ └──────┬───────┘ └────────┬─────────┘
       │                │                   │
       ▼                ▼                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      AWS PRODUCTION ENVIRONMENT                     │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    CloudFront CDN                            │   │
│  │                 (Static assets, API cache)                   │   │
│  └────────────────────────┬────────────────────────────────────┘   │
│                           │                                         │
│  ┌────────────────────────┼────────────────────────────────────┐   │
│  │              API Gateway (HTTP API)                          │   │
│  │              + AWS WAF (OWASP rules)                         │   │
│  └────────────────────────┬────────────────────────────────────┘   │
│                           │                                         │
│  ┌────────────────────────▼────────────────────────────────────┐   │
│  │        App Runner (Tier 1-2) → ECS Fargate (Tier 3)         │   │
│  │        ┌─────────────────────────────┐                      │   │
│  │        │  Fastify + tRPC Container   │                      │   │
│  │        │  (Pino structured logging)  │                      │   │
│  │        │  (Sentry SDK)               │                      │   │
│  │        └──────────────┬──────────────┘                      │   │
│  └───────────────────────┼─────────────────────────────────────┘   │
│                          │                                          │
│         ┌────────────────┼────────────────┐                        │
│         ▼                ▼                ▼                         │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐                │
│  │  PgBouncer  │ │   Lambda     │ │     S3       │                │
│  │  (txn mode) │ │  (async)     │ │  (documents) │                │
│  │      │      │ │  - PDF gen   │ │  Intelligent │                │
│  │      ▼      │ │  - Textract  │ │  -Tiering    │                │
│  │ ┌────────┐  │ │  - Images    │ └──────────────┘                │
│  │ │  RDS   │  │ │  - Cron jobs │                                  │
│  │ │ Postgres│  │ └──────────────┘                                 │
│  │ │ (RLS)  │  │                                                   │
│  │ │ t4g.mic│  │                                                   │
│  │ └────────┘  │                                                   │
│  └─────────────┘                                                   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  SECURITY LAYER                                               │  │
│  │  Shield Standard │ GuardDuty │ CloudTrail │ KMS │ Inspector   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  MONITORING LAYER                                             │  │
│  │  CloudWatch (metrics/logs/alarms)                             │  │
│  │  → Sentry (errors, crashes, session replay)                   │  │
│  │  → Better Stack (uptime, phone alerts, status page)           │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVICES                              │
│  Clerk (Auth/RBAC) │ Stripe Connect │ Twilio │ Lob │ SES          │
│  Expo Push Service (FCM/APNs)                                       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      MOBILE CLIENTS                                 │
│  React Native + Expo SDK 53 (New Architecture)                      │
│  WatermelonDB (offline) + react-native-mmkv (secure storage)        │
│  Sentry SDK (crash reporting + session replay)                      │
│  EAS Update (OTA JS bundles via production channel)                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. CI/CD pipeline specification with complete workflow definitions

The pipeline uses three GitHub Actions workflow files. The primary workflow runs on every push and PR, leveraging **Turborepo's `--affected` flag** to only build, lint, and test changed packages — cutting CI time by up to 90% on isolated changes. The `rharkor/caching-for-turbo@v2` action provides zero-config remote caching backed by GitHub Actions' cache API, avoiding a Vercel dependency.

### Primary CI/CD workflow (`ci.yml`)

```yaml
name: CI/CD
on:
  push:
    branches: ["main"]
  pull_request:
    types: [opened, synchronize]

env:
  NODE_VERSION: "22"

jobs:
  quality:
    name: Lint, Types, Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Required for --affected detection
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "pnpm"
      - name: Turborepo Cache
        uses: rharkor/caching-for-turbo@v2.2.1
      - run: pnpm install --frozen-lockfile
      - run: turbo run lint check-types test --affected
        # Single command — Turborepo parallelizes all 3 tasks internally

  build-and-deploy:
    name: Build, Migrate, Deploy
    needs: quality
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "pnpm"
      - name: Turborepo Cache
        uses: rharkor/caching-for-turbo@v2.2.1
      - run: pnpm install --frozen-lockfile

      # AWS Authentication via OIDC (no long-lived secrets)
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: us-west-2
      - uses: aws-actions/amazon-ecr-login@v2
        id: ecr

      # Docker Build + Push
      - name: Build and push backend image
        run: |
          docker build -f apps/api/Dockerfile \
            -t ${{ steps.ecr.outputs.registry }}/hoa-api:${{ github.sha }} \
            -t ${{ steps.ecr.outputs.registry }}/hoa-api:latest .
          docker push --all-tags ${{ steps.ecr.outputs.registry }}/hoa-api

      # Database Migration (BEFORE code deploy)
      - name: Run database migrations
        run: pnpm --filter @hoa/database migrate:deploy
        env:
          DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}

      # Migration drift check
      - name: Verify no pending schema changes
        run: |
          pnpm --filter @hoa/database drizzle-kit generate
          if [ -n "$(git status --porcelain packages/database/drizzle)" ]; then
            echo "ERROR: Uncommitted schema changes detected"
            exit 1
          fi

      # Infrastructure Deploy via CDK
      - name: CDK Deploy
        run: npx cdk deploy --all --require-approval never -c stage=prod

  eas-update:
    name: OTA Update (Mobile)
    needs: quality
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "pnpm"
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: pnpm install --frozen-lockfile
      - run: cd apps/mobile && eas update --auto --non-interactive
```

### Native build workflow (`eas-build.yml`) — manual trigger only

```yaml
name: EAS Native Build
on:
  workflow_dispatch:
    inputs:
      platform:
        type: choice
        options: [all, ios, android]
      profile:
        type: choice
        options: [production, preview]
        default: production
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: pnpm install --frozen-lockfile
      - run: |
          cd apps/mobile && eas build \
            --platform ${{ inputs.platform }} \
            --profile ${{ inputs.profile }} \
            --non-interactive --no-wait
        # --no-wait: exits immediately, build runs on EAS servers
        # Does NOT consume GitHub Actions minutes during build
```

### Mobile PR preview workflow (`mobile-preview.yml`)

```yaml
name: Mobile Preview
on:
  pull_request:
jobs:
  preview:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: pnpm install --frozen-lockfile
      - uses: expo/expo-github-action/preview@v8
        with:
          command: eas update --auto
        # Posts QR code comment on PR for mobile preview
```

**EAS Build budget management** is critical. The free tier provides 30 builds/month (15 iOS). The strategy: trigger native builds only via `workflow_dispatch` when native dependencies change, Expo SDK upgrades, or store submissions are needed. Use **EAS Update (OTA)** for all JavaScript-only changes on merge to main — OTA updates are unlimited and don't count as builds. This approach uses roughly **4–8 native builds/month**, well within the free tier.

### Docker multi-stage build for Turborepo

```dockerfile
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat && corepack enable

FROM base AS pruner
WORKDIR /app
RUN npm install turbo --global
COPY . .
RUN turbo prune api --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo build --filter=api

FROM node:22-alpine AS runner
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser
WORKDIR /app
COPY --from=installer --chown=appuser:nodejs /app/apps/api/dist ./dist
COPY --from=installer --chown=appuser:nodejs /app/apps/api/package.json .
COPY --from=installer --chown=appuser:nodejs /app/node_modules ./node_modules
USER appuser
EXPOSE 8080
CMD ["node", "dist/server.js"]
```

The key technique is **`turbo prune api --docker`**, which generates separate `out/json/` (package manifests for dependency installation) and `out/full/` (source code) directories. This splits dependencies from source for optimal Docker layer caching — dependency install only reruns when `package.json` files change. Final images target **~100–200 MB** using Alpine.

### Branch-based deployment and environment promotion

Deployments follow a straightforward model: PRs get quality checks + mobile preview, merges to `main` auto-deploy to production. The `turbo.json` configuration enables this:

```json
{
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "lint": { "dependsOn": ["^build"] },
    "check-types": { "dependsOn": ["^build"] },
    "test": { "outputs": ["coverage/**"] },
    "test:watch": { "cache": false, "persistent": true }
  }
}
```

---

## 3. Environment strategy optimized for solo-developer economics

**Start with a single AWS account using naming prefixes** (`dev-`, `staging-`, `prod-`), managed through CDK context. AWS recommends separate accounts for isolation, but the administrative overhead of multi-account management isn't justified until revenue supports it. The CDK pattern:

```typescript
const stage = app.node.tryGetContext('stage') || 'dev';
new HoaStack(app, `${stage}-hoa`, {
  rdsInstanceClass: stage === 'prod' ? 'db.t4g.small' : 'db.t4g.micro',
  containerCount: stage === 'prod' ? 2 : 1,
  multiAz: stage === 'prod',
});
```

**Skip a persistent staging environment initially.** At $54/month total budget, a separate staging RDS instance ($12/mo) and App Runner service ($7–15/mo) consume 35–50% of the budget. Instead, use local Docker Compose for development (same PostgreSQL version, same container image), feature flags for progressive rollout in production, and production RDS snapshots restored to temporary instances for migration testing.

**Feature flags**: Start with environment variables (`FEATURE_MAINTENANCE_REQUESTS=true`), graduate to **PostHog** when you need runtime toggling. PostHog's free tier includes **1M flag requests/month plus analytics and session replay** — triple value from one tool. For an HOA SaaS with under 1,000 users, you'll stay within free limits indefinitely.

**Clerk multi-environment**: Clerk provides free Development instances (100-user cap, shared OAuth) and Production instances (10,000 MAU free). Create a separate Clerk application for each environment with different API keys. Configuration changes must be manually replicated between instances — Clerk does not support cloning for security reasons.

---

## 4. Deployment architecture from App Runner through ECS Fargate

### App Runner configuration for launch

App Runner is the correct starting point — **$7/month idle cost** versus ECS Fargate's always-on pricing. Configure it for Fastify:

```typescript
// Fastify MUST bind to 0.0.0.0 in containers
fastify.listen({ port: parseInt(process.env.PORT || '8080'), host: '0.0.0.0' });
```

Auto-scaling settings: **MaxConcurrency 80** (below the 100 default to scale earlier for RLS-heavy queries), **MinSize 1**, **MaxSize 5**. Health checks should hit a simple `/health` endpoint (not a tRPC procedure) every 10 seconds with a 5-second timeout and 5-failure threshold.

**Graceful shutdown is non-negotiable** for financial data integrity:

```typescript
const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
for (const signal of signals) {
  process.on(signal, async () => {
    fastify.log.info(`Received ${signal}, shutting down gracefully`);
    await fastify.close(); // Drains in-flight requests
    process.exit(0);
  });
}
// Safety net: force exit before Docker's 30s SIGKILL
setTimeout(() => process.exit(1), 25000).unref();
```

Use `CMD ["node", "dist/server.js"]` (exec form) in the Dockerfile — shell form wraps in `/bin/sh` which swallows SIGTERM.

### When to switch to ECS Fargate

Six triggers signal the migration, any one sufficient:

- **ARM/Graviton2 needed** — App Runner does not support ARM. ECS Fargate with Graviton2 delivers **20% lower cost** at equivalent performance.
- **Monthly compute cost exceeds ~$200** — App Runner charges roughly 58% premium over ECS Fargate per vCPU/GB.
- **Blue-green deployments required** — App Runner only supports rolling deployments. ECS gained native blue-green support in July 2025 with bake times and deployment circuit breakers.
- **Custom scaling metrics** — App Runner only scales on request concurrency. ECS supports CPU, memory, custom CloudWatch metrics, and ALB request count scaling.
- **Background workers** — App Runner handles only HTTP request/response. Async processing beyond Lambda requires ECS tasks.
- **Multi-container (sidecars)** — logging agents, service mesh proxies.

The transition is straightforward: the same Docker image from ECR works on both services. The CDK change is approximately 100 lines — add an ALB, target groups, ECS service, and task definition. **Target the switch at approximately 500–1,000 units** or when any trigger applies.

### Zero-downtime deployments with database migrations

Use the **expand-contract pattern** for every schema change. Phase 1 (expand): add new columns/policies alongside existing ones, deploy migration before new code. Phase 2: deploy new code that works with both old and new schema. Phase 3 (contract, 24–72 hours later): drop old columns/policies after confirming stability. Never rename columns directly. Never drop columns in the same deployment as code changes.

---

## 5. Mobile deployment through the EAS ecosystem

### EAS Build profiles (`eas.json`)

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": { "APP_VARIANT": "development" },
      "ios": { "simulator": true },
      "android": { "buildType": "apk" }
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview",
      "env": { "APP_VARIANT": "staging" },
      "android": { "buildType": "apk" }
    },
    "production": {
      "autoIncrement": true,
      "channel": "production",
      "env": { "APP_VARIANT": "production" }
    }
  },
  "submit": {
    "production": {
      "android": { "track": "internal", "releaseStatus": "draft" },
      "ios": { "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID" }
    }
  }
}
```

**EAS Update (OTA) is the workhorse** — it pushes JavaScript bundle changes instantly without app store review. OTA can update all JS/TS code, styling, UI layouts, assets, bug fixes, and configuration. It **cannot** update native modules, new permissions, app config changes, SDK upgrades, icons, or splash screens. The `runtimeVersion` with `"appVersion"` policy ensures OTA updates only reach compatible native builds.

**Built-in crash recovery**: if a newly applied OTA update crashes before rendering, the app automatically rolls back to the previous working update. This is critical safety for pushing hotfixes to HOA board members who may not be tech-savvy.

### App Store review considerations for HOA/financial apps

Submit under a **business entity** (LLC/Inc), not a personal developer account — Apple requires this for apps providing financial services. Always provide **demo account credentials** in App Review Notes; this is the number-one preventable rejection for login-gated apps. Apple reviews **90% of submissions within 24 hours**, but financial-category first submissions may take 3–5 days. Build a 5-day buffer into launch timelines.

For the **Google Play Data Safety** section, declare collection of: personal info (name, email, phone, address), "other financial info" (HOA dues, payment history), photos/files (document uploads), and device identifiers. Since Stripe Elements handles card data in an iframe without your server touching it, you do not need to declare credit card collection. Declare that data is **encrypted in transit**, provide a data deletion mechanism, and link your privacy policy.

---

## 6. Monitoring and alerting across three growth tiers

### The monitoring stack

**CloudWatch** (included) handles infrastructure metrics. **Sentry Free** ($0/month, 5,000 errors, 10,000 performance units) handles application error tracking across React Native, Fastify, and Next.js with source maps, stack traces, and mobile session replay. **Better Stack Free** ($0/month) provides uptime monitoring (10 monitors, 3-minute intervals) with **unlimited phone call and SMS alerts** for one responder — the only free tool offering phone-call escalation for a solo developer. This combination provides production-grade observability for **$0–2/month** at launch.

**Do not add Datadog or New Relic.** Datadog's minimum realistic cost is $50–100/month for a single service — it's designed for DevOps teams at larger organizations. Sentry's startup program offers $50,000 in credits for qualifying early-stage companies, worth applying for.

### Sentry integration specifics

For React Native + Expo SDK 53, use `@sentry/react-native` (the `sentry-expo` package is deprecated). Add the Expo config plugin to `app.json`, and source maps upload automatically during EAS Build when `SENTRY_AUTH_TOKEN` is set as an EAS secret. For Fastify, initialize Sentry before any other imports and call `Sentry.setupFastifyErrorHandler(app)`. The tRPC middleware is built in: `Sentry.trpcMiddleware({ attachRpcInput: true })` creates spans per procedure with full RPC context.

### Custom business metrics via CloudWatch Metric Filters

Avoid `PutMetricData` ($0.30/metric/month). Instead, emit structured JSON logs and extract metrics with CloudWatch Metric Filters — **93% cheaper**. Log Stripe webhook outcomes, violation workflow completions, and sync failures as structured events. CloudWatch Metric Filters convert these into countable metrics automatically. The first 10 custom metrics and 10 alarms are free.

### Monitoring by tier

| Component | Tier 1 (1 HOA, 50 units) | Tier 2 (5 HOAs, 500 units) | Tier 3 (20+ HOAs, 5000+ units) |
|---|---|---|---|
| Error tracking | Sentry Free ($0) | Sentry Team ($29/mo) | Sentry Business ($89/mo) |
| Infrastructure | CloudWatch included ($0) | CloudWatch ($5–10/mo) | CloudWatch + X-Ray ($15–25/mo) |
| Uptime | Better Stack Free ($0) | Better Stack Free ($0) | Better Stack Team ($24/mo) |
| Alerting (phone/SMS) | Better Stack Free ($0) | Better Stack Free ($0) | Better Stack (included) |
| Session replay | Sentry (included) | Sentry (included) | Sentry (included) |
| Status page | Instatus Free ($0) | Instatus Free ($0) | Instatus ($20/mo) or Better Stack |
| Log management | CloudWatch Free tier ($0–2) | CloudWatch ($5–10/mo) | CloudWatch + S3 archival ($15–30/mo) |
| **Monitoring total** | **$0–2/mo** | **$39–49/mo** | **$163–188/mo** |

---

## 7. Structured logging with tenant isolation and SOC 2 compliance

Fastify's built-in Pino logger outputs structured JSON to stdout — CloudWatch ingests it automatically from App Runner/ECS containers with zero additional configuration. The critical pattern is **injecting tenant context via child loggers**:

```typescript
fastify.addHook('onRequest', async (request) => {
  const { tenantId, userId } = await resolveAuth(request);
  request.log = request.log.child({
    tenant_id: tenantId,
    user_id: userId,
    correlation_id: request.id,
  });
});
```

Every subsequent `request.log.info(...)` call automatically includes `tenant_id`, `user_id`, and `correlation_id`. For tRPC, create a logging middleware that wraps every procedure with timing and success/failure logging. Pass the child logger through tRPC context.

**PII redaction** uses Pino's built-in path-based redaction, configured at logger creation:

```typescript
redact: {
  paths: [
    'req.headers.authorization', 'req.headers.cookie',
    '*.password', '*.ssn', '*.bank_account', '*.routing_number',
    '*.credit_card', '*.card_number', '*.cvv', '*.client_secret'
  ],
  censor: '[REDACTED]'
}
```

The defensive rule: **never log raw request bodies or full user objects**. Extract only needed non-sensitive fields explicitly.

### CloudWatch log retention strategy

| Log group | Retention | Class | Rationale |
|---|---|---|---|
| `/ecs/hoa-api` (application) | 30 days | Standard | Active debugging window |
| `/hoa/audit` (audit events) | **365 days** | Standard | SOC 2 compliance requirement |
| `/aws/lambda/*` | 14 days | Infrequent Access | High volume, 50% ingestion savings |
| Logs older than 30 days | Archive to S3 | — | $0.023/GB vs $0.03/GB storage |

**Never leave the default "Never Expire" retention.** This is the single most common CloudWatch cost mistake. At Tier 1, logs stay within the 5 GB free ingestion tier. At Tier 3 (~20–50 GB/month), expect $10–25/month with proper retention policies.

### SOC 2 audit logging

Maintain a dedicated **audit_logs table** in PostgreSQL (with RLS) alongside CloudWatch Logs streams. The database table is queryable and tenant-scoped; CloudWatch serves as backup compliance evidence. Required events: authentication success/failure, authorization changes, data access and modifications on sensitive records, configuration changes, administrative actions, and security events. Minimum **365-day retention** for both database records and log streams.

**Correlation IDs** propagate across services: Fastify generates a UUID per request (or accepts `x-correlation-id` from clients), passes it to Lambda via SQS message attributes, and Lambda creates child loggers with the same ID. Skip AWS X-Ray until Tier 2 — at Tier 1, correlation IDs in structured logs plus Sentry error tracking provide sufficient traceability.

---

## 8. PgBouncer is the only viable connection pooler for RLS

This is the **most critical architectural finding** in the research. RDS Proxy and PgBouncer handle RLS session variables fundamentally differently, and choosing wrong creates a tenant data isolation vulnerability.

**The problem**: RLS policies use `current_setting('app.current_tenant')` to filter rows. This requires setting a session variable before each query. With connection pooling, connections are shared — if a session variable from one tenant persists on a pooled connection, the next tenant sees the wrong data.

**RDS Proxy fails here.** When you execute `SET app.current_tenant`, RDS Proxy **pins** the connection to that client session, completely defeating connection multiplexing. The `EXCLUDE_VARIABLE_SETS` filter that could bypass pinning is available only for MySQL, not PostgreSQL. AWS's own documentation confirms: "RDS Proxy is incompatible with PostgreSQL RLS policies based on session variables."

**PgBouncer in transaction mode works correctly** with `SET LOCAL`:

```typescript
async function withTenant<T>(tenantId: string, callback: (tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.current_tenant = ${tenantId}`);
    return callback(tx);
  });
}
```

`SET LOCAL` scopes the variable to the current transaction only — it's automatically cleared on COMMIT/ROLLBACK. In PgBouncer's transaction mode, the connection returns to the pool after each transaction with no lingering state. **Every database interaction must run inside an explicit transaction**, even reads.

Deploy PgBouncer as an **ECS sidecar container** or on a small EC2 instance (~$5–15/month). Configuration:

```ini
[pgbouncer]
pool_mode = transaction
server_reset_query = DISCARD ALL
max_client_conn = 100
default_pool_size = 20
```

### Drizzle Kit for migrations

Drizzle Kit is the better choice over Prisma Migrate for this stack. Its **~7.4 KB** bundle (versus Prisma's 15 MB+ Rust engine) matters for App Runner/Lambda cold starts. The SQL-like query builder gives full control needed for `SET LOCAL` patterns. No codegen step means faster development loops.

Drizzle Kit has **no built-in rollback**. Mitigation: always take an RDS snapshot before production migrations, keep manually written reverse migration SQL files alongside forward migrations, and keep migrations small and backward-compatible.

**RDS Performance Insights** (being rebranded to CloudWatch Database Insights by June 2026) is free at the Standard tier with 7-day retention. Enable it by default. Monitor specifically for I/O wait events that indicate missing `tenant_id` composite indexes — RLS policies add WHERE clauses that cause sequential scans without proper indexes. Every RLS-filtered table needs a composite index on `(tenant_id, <query_columns>)`.

---

## 9. Incident response playbook for a solo developer

### Severity classification

| Severity | Definition | Response time | Alert method | Communication |
|---|---|---|---|---|
| **P1 — Critical** | Payment processing failure, data breach, database down | Immediate (15 min) | Phone call (Better Stack) | Status page + direct email to HOA board within 30 min |
| **P2 — Major** | App/API completely unavailable, auth (Clerk) fully down | 30 min (business hours) / 2 hr (off-hours) | Push notification | Status page update within 1 hour |
| **P3 — Degraded** | Slow performance, non-critical feature broken, notifications delayed | 4 business hours | Email | Status page if duration exceeds 1 hour |
| **P4 — Minor** | Cosmetic issues, minor UI bugs | Next business day | GitHub issue | None |

**Realistic on-call for one person**: Business hours (8am–8pm) respond within 15 minutes for P1/P2. Off-hours: phone alerts for P1 only. DND hours (midnight–7am): wake only for P1 (payment processing down). Accept that 24/7/365 on-call is unsustainable — design SLAs accordingly and invest heavily in self-healing infrastructure.

### Top 5 incident runbooks

**Runbook 1 — Stripe Webhook Failures (P1)**
Trigger: CloudWatch alarm on webhook endpoint error rate or Stripe Dashboard failure notifications. Steps: (1) Check Stripe Dashboard → Webhooks → Recent events for failure type. (2) If 5xx: check app health and DB load. (3) If 4xx: check application logs for validation errors. (4) Fix and deploy. (5) Stripe retries webhooks for up to 3 days with exponential backoff — most events self-heal if fix deploys within hours. (6) For critical missed events: use `stripe events resend <event_id>` or Dashboard "Resend" button. (7) Reconcile payments table against Stripe Dashboard.

**Runbook 2 — Deployment Rollback (P2)**
Trigger: Health check failures or error rate spike after deployment. Steps: (1) Confirm a recent deploy occurred. (2) App Runner: update service with previous image tag via `aws apprunner update-service`. ECS: `aws ecs update-service --task-definition <previous-revision>`. (3) Verify health endpoint returns 200. (4) If migration caused the issue: evaluate whether reverse migration is needed or RDS PITR. (5) Post-recovery: investigate root cause before re-attempting deploy.

**Runbook 3 — RDS Database Failover (P1/P2)**
Trigger: DB connectivity alarm or RDS failover event notification. Steps: (1) Check RDS Events for "Multi-AZ failover" (automatic). (2) Verify app connectivity via health endpoint. (3) Check PgBouncer logs for reconnection. (4) Expect ~60 seconds of elevated latency during failover. (5) If no auto-failover: check instance status, security groups; if stuck, initiate `aws rds reboot-db-instance --force-failover`. (6) Post-recovery: verify pending Stripe webhooks processed, check DLQ, run data integrity check.

**Runbook 4 — Clerk Auth Outage (P2)**
Trigger: Users unable to log in, https://status.clerk.com shows incident. Steps: (1) Confirm via Clerk status page. (2) Existing sessions with valid JWTs continue working. (3) Ensure JWKS keys are cached locally. (4) Display graceful error: "Authentication service temporarily unavailable." (5) Update your status page noting external dependency. (6) Wait for Clerk resolution — this cannot be fixed on your end. (7) Document as external dependency risk for SOC 2.

**Runbook 5 — WatermelonDB Sync Failure (P3)**
Trigger: User reports of stale data, sync error logs in CloudWatch. Steps: (1) Check application logs filtered by `event = "sync_failure"`. (2) Determine if upstream (API response errors) or client-side (local DB corruption). (3) If API issue: check tRPC sync endpoint health and response times. (4) If client-side: guide user to force full re-sync via app settings. (5) Last resort: clear local WatermelonDB and re-download.

### Communication templates for HOA board members

Write in zero-jargon language. Focus on impact ("what this means for you"), explicitly address financial concerns (board members are fiduciaries), and always mention data safety. Template for active outage:

> **Subject: [HOA Manager] Update on service availability**
>
> Dear Board Members,
>
> We're aware that the HOA management portal is currently unavailable. Our team is actively working to restore service, and we expect resolution within [timeframe].
>
> **What this means for you:** You may be unable to access the portal to view accounts or submit requests. Any pending payments are safely queued and will process once service is restored — no payments will be lost.
>
> **Next update:** We'll provide another update by [time]. If you need to make an urgent payment or report an issue, please contact us at [email/phone].

### SLA targets

Start with **99.5% monthly uptime** (3 hours 39 minutes downtime/month). This is realistically achievable with RDS automated backups, App Runner auto-restart, and Better Stack monitoring. Upgrade to **99.9%** (43 minutes/month) when you have robust monitoring, auto-healing, and rapid response capabilities — typically at Tier 2. Do not promise 99.99% — that requires multi-region active-active architecture.

---

## 10. Cost projection across three growth tiers

The table below extends the confirmed $54/$121/$589 infrastructure projections with all DevOps, monitoring, and tooling costs.

| Category | Tier 1: 1 HOA (50 units) | Tier 2: 5 HOAs (500 units) | Tier 3: 20+ HOAs (5,000 units) |
|---|---|---|---|
| **Compute** (App Runner/ECS ARM) | $9 | $18 | $55 |
| **Database** (RDS Graviton) | $13 | $20 (1-yr RI) | $120 (Multi-AZ, RI) |
| **Storage** (S3 Intelligent-Tiering) | $0.12 | $1 | $8 |
| **Serverless** (Lambda ARM) | $1 | $3 | $15 |
| **Networking** (ALB + CloudFront) | $18 | $25 | $60 |
| **Security** (WAF + GuardDuty + CloudTrail) | $9 | $15 | $40 |
| **CloudWatch** (metrics, logs, alarms) | $3 | $10 | $35 |
| **External APIs** (SES, Twilio, Lob, Textract) | $1 | $15–30 | $80–120 |
| **Infrastructure subtotal** | **~$54** | **~$107–122** | **~$413–453** |
| | | | |
| **Sentry** (error tracking + replay) | $0 (Free) | $29 (Team) | $89 (Business) |
| **Better Stack** (uptime + alerting) | $0 (Free) | $0 (Free) | $24 (Team) |
| **Status page** (Instatus) | $0 (Free) | $0 (Free) | $20 |
| **CI/CD** (GitHub Actions) | $0 (Free 2K min) | $0 | $0–4 (Pro) |
| **CI/CD** (EAS Build) | $0 (Free 30 builds) | $19 (Starter) | $19–199 (Starter/Production) |
| **Auth** (Clerk) | $0 (Free 10K MAU) | $25 (Pro) | $50–100 |
| **Secrets** (SM + Parameter Store) | $2 | $3 | $8 |
| **Feature flags** (PostHog/env vars) | $0 | $0 | $0 |
| **SAST** (Semgrep + Dependabot) | $0 | $0 | $0–30 (GHAS) |
| **DevOps tooling subtotal** | **~$2** | **~$76** | **~$210–474** |
| | | | |
| **TOTAL** | **~$56/mo** | **~$183–198/mo** | **~$623–927/mo** |

**Key cost optimizations built into these projections**: Graviton/ARM instances everywhere (RDS, Lambda, ECS — 10–20% savings each), S3 Intelligent-Tiering (40–68% storage savings over time), CloudWatch Infrequent Access log class for Lambda logs (50% ingestion savings), EAS Update for OTA instead of native builds (saves ~$150/month at scale), and Turborepo `--affected` execution minimizing CI minutes.

**AWS Budgets** (2 free budgets) should be configured from day one with alerts at 50%, 80%, and 100% of forecast. **Cost Anomaly Detection** (completely free, ML-based) needs 10 days of baseline data and catches runaway Lambdas, forgotten instances, and unexpected data transfer spikes — set the threshold at $10–20 absolute impact for the initial scale.

---

## 11. Security operations beyond the established baseline

### Secrets management: use both tools strategically

**AWS Secrets Manager** ($0.40/secret/month) for credentials requiring automatic rotation: RDS database credentials, Stripe secret key, and Clerk secret key. **SSM Parameter Store SecureString** (free, up to 10,000 parameters) for everything else: Twilio SID, Lob API key, SES configuration, environment URLs. Total cost: **~$2/month** versus $8–20/month if everything lived in Secrets Manager.

Enable Secrets Manager **automatic rotation for RDS** credentials — it creates a Lambda function handling the create → update → verify → activate cycle every 30–90 days with zero application downtime. For Stripe and Twilio keys, use manual quarterly rotation with calendar reminders; writing custom rotation Lambdas isn't justified until Tier 3.

### SAST pipeline: Semgrep + Dependabot at zero cost

The optimal free SAST combination: **Semgrep OSS** (fast, customizable YAML rules, excellent TypeScript support) for static analysis in GitHub Actions, **GitHub Dependabot** (free for all repos) for dependency vulnerability scanning and automatic PRs, and **Amazon Inspector enhanced scanning** on ECR ($0.09/image initial scan) for container vulnerabilities. This combination costs $0/month and covers code-level, dependency, and container scanning.

CodeQL has the highest accuracy (**88%**, 5% false positive rate) but requires GitHub Advanced Security at **$30/committer/month** for private repos. Defer to SOC 2 preparation stage. Snyk's free tier (100 tests/month) is useful as a supplementary check but its paid tier ($52/dev/month, minimum 5 developers) is priced for teams.

### Security headers for PCI DSS 4.0.1 compliance

Configure `@fastify/helmet` with a CSP that explicitly allows Stripe Elements while blocking everything else:

```typescript
fastify.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://js.stripe.com"],
      frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
      connectSrc: ["'self'", "https://api.stripe.com"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Stripe Elements requires inline styles
      imgSrc: ["'self'", "data:", "https://*.stripe.com"],
    }
  }
});
```

PCI DSS 4.0.1 Requirement **6.4.3** (script inventory/authorization) is directly satisfied by CSP's `script-src` directive controlling which scripts execute on payment pages. Requirement **11.6.1** (tamper detection) is addressed by CSP violation reporting (`report-uri` directive) plus Subresource Integrity hashes on external scripts. Since the platform uses **SAQ-A** via Stripe Elements iframes, these requirements apply in attenuated form — but implementing CSP is still essential best practice.

### Rate limiting: two layers

**AWS WAF** rate-based rules at the edge: 2,000 requests per 5-minute window globally, 100 requests per 5-minute window on auth endpoints. **`@fastify/rate-limit`** at the application layer: 100 requests/minute per IP globally, 5 requests/minute on auth endpoints. WAF catches volumetric DDoS before it reaches your container; application-level handles per-user business logic limits.

**Shield Advanced ($3,000/month) is not justified at any projected tier.** Shield Standard (free, automatic) plus WAF rate-based rules plus CloudFront edge protection provides adequate DDoS defense for an HOA SaaS. Reconsider only if revenue exceeds $500K/year or you become a specific DDoS target.

### Penetration testing

AWS no longer requires prior approval for penetration testing on EC2, ECS, Fargate, RDS, CloudFront, API Gateway, Lambda, and App Runner. Scope should include OWASP Top 10 against the web app and API, authentication flow testing, **tenant isolation verification** (critical for RLS), S3 bucket permissions, and IAM policy review. Budget **$5,000–15,000** annually for external testing, with initial automated scanning via Prowler (AWS configuration) and OWASP ZAP (application DAST) at zero cost.

---

## Conclusion: the critical decisions that matter most

Three findings from this research override all others in impact. First, **PgBouncer with `SET LOCAL` in transaction mode is the only correct connection pooling strategy** for RLS with PostgreSQL — RDS Proxy causes session pinning that defeats pooling entirely. Second, **EAS Update (OTA) should handle 80%+ of mobile deployments**, reserving native builds for native dependency changes and store submissions. This keeps both EAS Build and GitHub Actions within free tiers. Third, the **Sentry + Better Stack + CloudWatch monitoring stack at $0/month** provides production-grade observability that's genuinely competitive with $200+/month commercial alternatives for a small-scale SaaS.

The entire DevOps tooling layer adds just **$2/month at launch** on top of the confirmed $54/month infrastructure cost. The strategy scales to $200–475/month in DevOps tooling at 20+ HOAs — well within the economics of a SaaS charging HOAs for management services. The single largest future cost decision is EAS Build: the free tier works through Tier 2, but at 20+ communities with frequent releases, the Production plan ($199/month) may be necessary. Alternatively, EAS local builds running on GitHub Actions can substitute, trading CI minutes for EAS build credits.

Every recommendation above can be implemented incrementally. Start with the CI/CD pipeline and Sentry integration in week one. Add CloudWatch alarms and the audit logging table in week two. Write the five runbooks before launch. Everything else — status page, feature flags, X-Ray tracing, Grafana dashboards — layers on as the platform grows.
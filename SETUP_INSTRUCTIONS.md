# Trellis HOA Platform — Setup Instructions

**Follow these steps in order. Each step must complete before moving to the next.**

---

## Step 1: Place Cursor Rules

Copy the `.cursor/rules/` folder into your project root.

```
C:\Users\mikel\OneDrive\Desktop\HOA\.cursor\rules\
├── typescript.mdc
├── react-native.mdc
├── api.mdc
├── database.mdc
├── infrastructure.mdc
├── shared.mdc
└── behavioral.mdc
```

On Windows, the `.cursor` folder may be hidden. Create it with:
```powershell
mkdir "C:\Users\mikel\OneDrive\Desktop\HOA\.cursor\rules"
```

Then copy all 7 `.mdc` files into it.

**Verify:** Open Cursor → Settings → Rules. All 7 rules should appear.

---

## Step 2: Place Reference Files at Project Root

Copy these to `C:\Users\mikel\OneDrive\Desktop\HOA\`:

```
HOA\
├── schema.sql              # SQL reference (source of truth for DB)
├── PHASE1_BUILD_PLAN.md    # Week-by-week build plan with checkboxes
├── scaffold.sh             # Monorepo scaffold script
└── patches.sh              # Post-scaffold fixes (ESLint, tRPC v11, Expo deep links)
```

---

## Step 3: Run the Scaffold Script

Open Git Bash (or WSL) in `C:\Users\mikel\OneDrive\Desktop\HOA\` and run:

```bash
bash scaffold.sh
```

This creates the entire Turborepo monorepo: all `package.json` files, TypeScript configs, Dockerfile, CI workflow, and starter code.

---

## Step 4: Run the Patches Script

Still in Git Bash:

```bash
bash patches.sh
```

This applies fixes the scaffold doesn't include:
- ESLint 9 flat config with TypeScript + React rules
- Corrected tRPC v11 package names (`@trpc/tanstack-react-query`)
- Expo `app.config.ts` with `trellis://` deep link scheme, camera/location permissions, and Universal Links
- EAS Build configuration (development/preview/production profiles)
- Prettier config

---

## Step 5: Install Dependencies

```bash
pnpm install
pnpm add -Dw eslint @eslint/js typescript-eslint eslint-plugin-react eslint-plugin-react-hooks prettier
rm .eslintrc-deps.json
pnpm install
```

**Verify:**
```bash
turbo run check-types
```

Should complete with zero errors. If you see `expo` version warnings, run:
```bash
cd apps/mobile && npx expo install --fix && cd ../..
```

---

## Step 6: Initialize Git

```bash
git init
git add .
git commit -m "chore: initial Trellis monorepo scaffold"
```

Connect to GitHub:
```bash
git remote add origin https://github.com/<your-username>/trellis.git
git push -u origin main
```

---

## Step 7: Configure Cursor for Trellis

Open the project in Cursor:
```bash
cursor .
```

**7a. Verify rules loaded:**
Settings → Rules — confirm all 7 `.mdc` files appear with their glob patterns.

**7b. Add framework docs** (Settings → Features → Docs):
- Expo SDK 53: `https://docs.expo.dev`
- tRPC v11: `https://trpc.io/docs`
- Fastify v5: `https://fastify.dev/docs/latest`
- Clerk Expo: `https://clerk.com/docs/references/expo`
- Drizzle ORM: `https://orm.drizzle.team/docs/overview`

Only these 5 — over-indexing slows Cursor's retrieval.

**7c. Set up two Cursor windows** (as planned):
- Window 1: Trellis HOA (`C:\Users\mikel\OneDrive\Desktop\HOA`)
- Window 2: StoriesOfYou (existing project)

---

## Step 8: First Cursor Task — Generate Drizzle Schema from SQL

The `packages/db/src/schema/platform.ts` file is a placeholder. Your first Cursor task fills it with real Drizzle table definitions.

Open Cursor chat and prompt (Plan Mode):

> Looking at `@schema.sql`, generate the Drizzle ORM schema files for all Phase 1 tables. Create these files in `packages/db/src/schema/`:
> - `platform.ts` — tenants, users, tenant_memberships
> - `community.ts` — communities, compliance_profiles, properties, members
> - `ownership.ts` — property_ownerships, board_terms, committees, committee_memberships
> - `financial.ts` — assessment_schedules, assessment_rate_history, charges, payments, payment_applications, autopay_enrollments
> - `governance.ts` — violation_categories, violations, violation_transitions, violation_transition_rules, violation_evidence, arc_modification_types, arc_requests, arc_transitions, arc_votes
> - `operations.ts` — meetings, meeting_agenda_items, meeting_attendees, elections, ballot_options, vote_records, voter_registry, documents, document_versions
> - `communications.ts` — communications, communication_deliveries, document_categories
> - `audit.ts` — audit_log
>
> Follow the conventions in `@.cursor/rules/database.mdc`. Use pgTable, map snake_case SQL to camelCase TS. Export all tables from `index.ts`.

After Cursor generates these, verify with:
```bash
turbo run check-types --filter=@repo/db
```

---

## Step 9: AWS Infrastructure

This requires the `hoa` CLI profile you already set up.

**9a. Domain registration:**
If `trellishoa.com` isn't registered yet, register it in Route 53:
```bash
aws route53domains register-domain --domain-name trellishoa.com --profile hoa
```

**9b. CDK bootstrap:**
```bash
cd packages/infra
npx cdk bootstrap aws://572885593026/us-west-2 --profile hoa
cd ../..
```

**9c. Build CDK stacks** (Plan Mode in Cursor):

> Looking at `@.cursor/rules/infrastructure.mdc` and `@PHASE1_BUILD_PLAN.md`, create the Phase 1 CDK stacks in `packages/infra/src/`:
> - `TrellisNetworkStack` — VPC with 2 AZs, public + private subnets
> - `TrellisDataStack` — RDS PostgreSQL 16 (db.t4g.micro), S3 bucket, Secrets Manager
> - `TrellisComputeStack` — App Runner service with VPC connector
>
> Use stage-based naming: `const stage = app.node.tryGetContext('stage') || 'dev';`
> AWS account 572885593026, us-west-2, profile `hoa`.

**9d. Deploy:**
```bash
cd packages/infra
npx cdk deploy --all --context stage=dev --profile hoa
cd ../..
```

**9e. Apply database schema:**
```bash
psql -h <rds-endpoint-from-cdk-output> -U postgres -d trellis_dev -f schema.sql
```

---

## Step 10: Continue with Phase 1 Build Plan

Open `PHASE1_BUILD_PLAN.md` and work through the Week 2–4 tasks. Reference it in Cursor prompts with `@PHASE1_BUILD_PLAN.md` to keep the AI oriented.

**Use Plan Mode for:**
- CDK stacks (Week 1)
- tRPC middleware chain (Week 2)
- Clerk webhook handler (Week 2)

**Use Normal Mode for:**
- Individual tRPC routers
- Mobile screens
- Zod schemas
- Seed scripts

---

## File Inventory

After completing Steps 1–6, your project should contain:

```
HOA/
├── .cursor/rules/           # 7 rule files (auto-applied by Cursor)
├── .github/workflows/
│   └── ci.yml               # GitHub Actions: lint + types + test
├── apps/
│   ├── api/                 # Fastify + tRPC (Week 2)
│   ├── mobile/              # Expo React Native (Week 2–3)
│   └── web/                 # Next.js admin (Phase 5)
├── packages/
│   ├── api-client/          # tRPC client types
│   ├── db/                  # Drizzle schema + migrations
│   ├── infra/               # AWS CDK stacks
│   ├── shared/              # Zod schemas, constants, types
│   └── tsconfig/            # Shared TS configs
├── .env.example
├── .gitignore
├── .npmrc
├── .prettierrc
├── .prettierignore
├── Dockerfile
├── eslint.config.mjs
├── package.json
├── patches.sh
├── PHASE1_BUILD_PLAN.md
├── pnpm-workspace.yaml
├── scaffold.sh
├── schema.sql
└── turbo.json
```

---

## Troubleshooting

**`turbo run check-types` fails on Expo types:**
Run `cd apps/mobile && npx expo install --fix && cd ../..` to align Expo peer dependencies.

**ESLint can't find config:**
Ensure `eslint.config.mjs` is at the project root (not inside an app).

**Cursor doesn't see rules:**
Verify the path is exactly `.cursor/rules/` (dot prefix, lowercase) at the project root. Restart Cursor after placing files.

**pnpm workspace resolution errors:**
Run `pnpm install --no-frozen-lockfile` once, then commit the updated lockfile.

**RDS connection refused:**
RDS is in a private subnet. Use an SSH tunnel via a bastion host, or temporarily enable public access for initial schema setup, then disable it.

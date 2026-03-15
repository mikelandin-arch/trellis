#!/usr/bin/env bash
set -euo pipefail
echo "🏠 Scaffolding Trellis HOA Platform monorepo..."

# ── Root config ──
cat > package.json << 'EOF'
{
  "name": "trellis",
  "private": true,
  "packageManager": "pnpm@9.15.4",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "check-types": "turbo check-types",
    "test": "turbo test",
    "db:generate": "turbo db:generate --filter=@repo/db",
    "db:migrate": "turbo db:migrate --filter=@repo/db",
    "db:studio": "turbo db:studio --filter=@repo/db",
    "clean": "turbo clean && rm -rf node_modules",
    "format": "prettier --write ."
  },
  "devDependencies": {
    "turbo": "^2.4.0",
    "typescript": "^5.7.0",
    "@types/node": "^22.0.0"
  }
}
EOF

cat > turbo.json << 'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**", ".expo/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": { "dependsOn": ["^build"] },
    "check-types": { "dependsOn": ["^build"] },
    "test": { "outputs": ["coverage/**"] },
    "clean": { "cache": false },
    "db:generate": { "cache": false },
    "db:migrate": { "cache": false },
    "db:studio": { "cache": false, "persistent": true }
  }
}
EOF

cat > pnpm-workspace.yaml << 'EOF'
packages:
  - "apps/*"
  - "packages/*"
EOF

cat > .gitignore << 'EOF'
node_modules/
dist/
.next/
.expo/
*.tsbuildinfo
.env
.env.local
.env.*.local
.turbo/
.DS_Store
Thumbs.db
coverage/
cdk.out/
ios/
android/
EOF

cat > .npmrc << 'EOF'
auto-install-peers=true
strict-peer-dependencies=false
EOF

cat > .env.example << 'EOF'
TRELLIS_DB_HOST=localhost
TRELLIS_DB_PORT=5432
TRELLIS_DB_NAME=trellis_dev
TRELLIS_DB_USER=app_user
TRELLIS_DB_PASSWORD=
TRELLIS_DB_URL=postgresql://${TRELLIS_DB_USER}:${TRELLIS_DB_PASSWORD}@${TRELLIS_DB_HOST}:${TRELLIS_DB_PORT}/${TRELLIS_DB_NAME}
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
AWS_REGION=us-west-2
AWS_ACCOUNT_ID=572885593026
TRELLIS_S3_BUCKET=trellis-documents-dev
API_PORT=3001
API_URL=http://localhost:3001
NODE_ENV=development
EOF

# ── Shared TypeScript configs ──
mkdir -p packages/tsconfig
cat > packages/tsconfig/package.json << 'EOF'
{ "name": "@repo/tsconfig", "version": "0.0.0", "private": true }
EOF

cat > packages/tsconfig/base.json << 'EOF'
{
  "compilerOptions": {
    "strict": true, "esModuleInterop": true, "forceConsistentCasingInFileNames": true,
    "isolatedModules": true, "moduleResolution": "bundler", "module": "ESNext",
    "target": "ES2022", "lib": ["ES2022"], "skipLibCheck": true, "resolveJsonModule": true,
    "declaration": true, "declarationMap": true, "sourceMap": true,
    "noUncheckedIndexedAccess": true, "noUnusedLocals": true, "noUnusedParameters": true
  },
  "exclude": ["node_modules", "dist"]
}
EOF

cat > packages/tsconfig/api.json << 'EOF'
{ "extends": "./base.json", "compilerOptions": { "module": "ESNext", "target": "ES2022", "lib": ["ES2022"], "outDir": "./dist", "rootDir": "./src" } }
EOF

cat > packages/tsconfig/react-native.json << 'EOF'
{ "extends": "./base.json", "compilerOptions": { "jsx": "react-jsx", "lib": ["ES2022"], "moduleResolution": "bundler" } }
EOF

cat > packages/tsconfig/react.json << 'EOF'
{ "extends": "./base.json", "compilerOptions": { "jsx": "react-jsx", "lib": ["ES2022", "DOM", "DOM.Iterable"], "moduleResolution": "bundler" } }
EOF

# ── packages/shared ──
mkdir -p packages/shared/src/{schemas,constants,types,utils}
cat > packages/shared/package.json << 'EOF'
{ "name": "@repo/shared", "version": "0.0.0", "private": true, "main": "./src/index.ts", "types": "./src/index.ts",
  "scripts": { "lint": "eslint src/", "check-types": "tsc --noEmit" },
  "dependencies": { "zod": "^3.24.0" },
  "devDependencies": { "@repo/tsconfig": "workspace:*", "typescript": "^5.7.0" } }
EOF
cat > packages/shared/tsconfig.json << 'EOF'
{ "extends": "@repo/tsconfig/base.json", "include": ["src"] }
EOF

cat > packages/shared/src/index.ts << 'EOF'
export * from './schemas/common';
export * from './constants/roles';
export * from './constants/violation-states';
export * from './types';
EOF

cat > packages/shared/src/schemas/common.ts << 'EOF'
import { z } from 'zod';
export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
});
export const idParamSchema = z.object({ id: z.string().uuid() });
export const tenantIdSchema = z.number().int().positive().brand('TenantId');
export type Pagination = z.infer<typeof paginationSchema>;
export type IdParam = z.infer<typeof idParamSchema>;
EOF

cat > packages/shared/src/constants/roles.ts << 'EOF'
export const CLERK_ROLES = {
  SUPER_ADMIN: 'org:super_admin',
  BOARD_OFFICER: 'org:board_officer',
  BOARD_MEMBER: 'org:board_member',
  PROPERTY_MANAGER: 'org:property_manager',
  COMMITTEE_MEMBER: 'org:committee_member',
  HOMEOWNER: 'org:homeowner',
  VENDOR: 'org:vendor',
} as const;
export type ClerkRole = (typeof CLERK_ROLES)[keyof typeof CLERK_ROLES];
EOF

cat > packages/shared/src/constants/violation-states.ts << 'EOF'
export const VIOLATION_STATUS = {
  REPORTED: 'reported', VERIFIED: 'verified',
  COURTESY_NOTICE_SENT: 'courtesy_notice_sent', FORMAL_NOTICE_SENT: 'formal_notice_sent',
  ESCALATED: 'escalated', HEARING_SCHEDULED: 'hearing_scheduled',
  FINE_ASSESSED: 'fine_assessed', PAYMENT_PLAN: 'payment_plan',
  LIEN_FILED: 'lien_filed', LEGAL_REFERRAL: 'legal_referral',
  RESOLVED_CURED: 'resolved_cured', RESOLVED_PAID: 'resolved_paid', DISMISSED: 'dismissed',
} as const;
export type ViolationStatus = (typeof VIOLATION_STATUS)[keyof typeof VIOLATION_STATUS];
export const TERMINAL_STATES: readonly ViolationStatus[] = [
  VIOLATION_STATUS.RESOLVED_CURED, VIOLATION_STATUS.RESOLVED_PAID,
  VIOLATION_STATUS.DISMISSED, VIOLATION_STATUS.LEGAL_REFERRAL,
] as const;
export const VALID_TRANSITIONS: Record<string, readonly ViolationStatus[]> = {
  [VIOLATION_STATUS.REPORTED]: [VIOLATION_STATUS.VERIFIED, VIOLATION_STATUS.DISMISSED],
  [VIOLATION_STATUS.VERIFIED]: [VIOLATION_STATUS.COURTESY_NOTICE_SENT, VIOLATION_STATUS.DISMISSED],
  [VIOLATION_STATUS.COURTESY_NOTICE_SENT]: [VIOLATION_STATUS.FORMAL_NOTICE_SENT, VIOLATION_STATUS.RESOLVED_CURED],
  [VIOLATION_STATUS.FORMAL_NOTICE_SENT]: [VIOLATION_STATUS.ESCALATED, VIOLATION_STATUS.HEARING_SCHEDULED, VIOLATION_STATUS.RESOLVED_CURED],
  [VIOLATION_STATUS.ESCALATED]: [VIOLATION_STATUS.HEARING_SCHEDULED, VIOLATION_STATUS.RESOLVED_CURED],
  [VIOLATION_STATUS.HEARING_SCHEDULED]: [VIOLATION_STATUS.FINE_ASSESSED, VIOLATION_STATUS.DISMISSED, VIOLATION_STATUS.RESOLVED_CURED],
  [VIOLATION_STATUS.FINE_ASSESSED]: [VIOLATION_STATUS.PAYMENT_PLAN, VIOLATION_STATUS.LIEN_FILED, VIOLATION_STATUS.RESOLVED_PAID],
  [VIOLATION_STATUS.PAYMENT_PLAN]: [VIOLATION_STATUS.RESOLVED_PAID, VIOLATION_STATUS.LIEN_FILED],
  [VIOLATION_STATUS.LIEN_FILED]: [VIOLATION_STATUS.LEGAL_REFERRAL, VIOLATION_STATUS.RESOLVED_PAID],
} as const;
EOF

cat > packages/shared/src/types/index.ts << 'EOF'
export type { Pagination, IdParam } from '../schemas/common';
export type { ClerkRole } from '../constants/roles';
export type { ViolationStatus } from '../constants/violation-states';
EOF

# ── packages/db ──
mkdir -p packages/db/src/{schema,migrations}
cat > packages/db/package.json << 'EOF'
{ "name": "@repo/db", "version": "0.0.0", "private": true, "main": "./src/index.ts", "types": "./src/index.ts",
  "scripts": { "db:generate": "drizzle-kit generate", "db:migrate": "drizzle-kit migrate", "db:studio": "drizzle-kit studio", "check-types": "tsc --noEmit" },
  "dependencies": { "drizzle-orm": "^0.38.0", "postgres": "^3.4.0" },
  "devDependencies": { "@repo/tsconfig": "workspace:*", "drizzle-kit": "^0.30.0", "typescript": "^5.7.0" } }
EOF
cat > packages/db/tsconfig.json << 'EOF'
{ "extends": "@repo/tsconfig/base.json", "include": ["src"] }
EOF
cat > packages/db/drizzle.config.ts << 'EOF'
import { defineConfig } from 'drizzle-kit';
export default defineConfig({ dialect: 'postgresql', schema: './src/schema/index.ts', out: './src/migrations', dbCredentials: { url: process.env.TRELLIS_DB_URL! } });
EOF
cat > packages/db/src/index.ts << 'EOF'
export * from './schema';
export * from './client';
EOF
cat > packages/db/src/client.ts << 'EOF'
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
const queryClient = postgres(process.env.TRELLIS_DB_URL!);
export const db = drizzle(queryClient, { schema });
export type Database = typeof db;
EOF
cat > packages/db/src/schema/index.ts << 'EOF'
// Step 8 in SETUP_INSTRUCTIONS.md: Use Cursor to generate Drizzle schemas from schema.sql
export * from './platform';
EOF
cat > packages/db/src/schema/platform.ts << 'EOF'
// Placeholder — run Step 8 in SETUP_INSTRUCTIONS.md to generate from schema.sql
export {};
EOF

# ── packages/api-client ──
mkdir -p packages/api-client/src
cat > packages/api-client/package.json << 'EOF'
{ "name": "@repo/api-client", "version": "0.0.0", "private": true, "main": "./src/index.ts", "types": "./src/index.ts",
  "dependencies": { "@trpc/client": "^11.0.0", "@trpc/tanstack-react-query": "^11.0.0", "@tanstack/react-query": "^5.62.0" },
  "devDependencies": { "@repo/tsconfig": "workspace:*", "typescript": "^5.7.0" } }
EOF
cat > packages/api-client/tsconfig.json << 'EOF'
{ "extends": "@repo/tsconfig/base.json", "include": ["src"] }
EOF
cat > packages/api-client/src/index.ts << 'EOF'
// tRPC client configured after API router types exist (Week 2)
export {};
EOF

# ── packages/infra ──
mkdir -p packages/infra/src
cat > packages/infra/package.json << 'EOF'
{ "name": "@repo/infra", "version": "0.0.0", "private": true,
  "scripts": { "cdk": "cdk", "synth": "cdk synth", "deploy": "cdk deploy", "check-types": "tsc --noEmit" },
  "dependencies": { "aws-cdk-lib": "^2.180.0", "constructs": "^10.4.0" },
  "devDependencies": { "@repo/tsconfig": "workspace:*", "aws-cdk": "^2.180.0", "typescript": "^5.7.0" } }
EOF
cat > packages/infra/tsconfig.json << 'EOF'
{ "extends": "@repo/tsconfig/base.json", "include": ["src"] }
EOF
cat > packages/infra/src/index.ts << 'EOF'
// CDK stacks created in Week 1 via Cursor Plan Mode
export {};
EOF

# ── apps/api ──
mkdir -p apps/api/src/{routers,middleware,lib,webhooks}
cat > apps/api/package.json << 'EOF'
{ "name": "@repo/api", "version": "0.0.0", "private": true,
  "scripts": { "dev": "tsx watch src/server.ts", "build": "tsc", "start": "node dist/server.js", "lint": "eslint src/", "check-types": "tsc --noEmit", "test": "vitest run" },
  "dependencies": { "@clerk/fastify": "^2.0.0", "@repo/db": "workspace:*", "@repo/shared": "workspace:*", "@trpc/server": "^11.0.0", "fastify": "^5.2.0", "zod": "^3.24.0", "pino": "^9.0.0" },
  "devDependencies": { "@repo/tsconfig": "workspace:*", "tsx": "^4.19.0", "typescript": "^5.7.0", "vitest": "^3.0.0" } }
EOF
cat > apps/api/tsconfig.json << 'EOF'
{ "extends": "@repo/tsconfig/api.json", "compilerOptions": { "outDir": "./dist", "rootDir": "./src" }, "include": ["src"] }
EOF
cat > apps/api/src/server.ts << 'EOF'
import Fastify from 'fastify';
const PORT = Number(process.env.API_PORT) || 3001;
async function main(): Promise<void> {
  const app = Fastify({ logger: true });
  app.get('/health', async () => ({ status: 'ok', service: 'trellis-api' }));
  await app.listen({ port: PORT, host: '0.0.0.0' });
  app.log.info(`Trellis API running on port ${PORT}`);
}
main().catch((err) => { console.error('Failed to start server:', err); process.exit(1); });
EOF
touch apps/api/src/routers/.gitkeep apps/api/src/middleware/.gitkeep apps/api/src/webhooks/.gitkeep

# ── apps/mobile ──
mkdir -p apps/mobile/src/app/{'(auth)','(tabs)'/payments,'(tabs)'/community,'(tabs)'/requests,'(tabs)'/admin}
mkdir -p apps/mobile/src/{components,hooks,lib,providers}
cat > apps/mobile/package.json << 'EOF'
{ "name": "@repo/mobile", "version": "0.0.0", "private": true, "main": "expo-router/entry",
  "scripts": { "dev": "expo start", "build:ios": "eas build --platform ios", "build:android": "eas build --platform android", "lint": "eslint src/", "check-types": "tsc --noEmit", "test": "vitest run" },
  "dependencies": { "@clerk/clerk-expo": "^2.5.0", "@repo/api-client": "workspace:*", "@repo/shared": "workspace:*", "@tanstack/react-query": "^5.62.0", "@trpc/client": "^11.0.0", "@trpc/tanstack-react-query": "^11.0.0", "expo": "~53.0.0", "expo-router": "~4.0.0", "expo-secure-store": "~14.0.0", "react": "^19.0.0", "react-native": "~0.79.0" },
  "devDependencies": { "@repo/tsconfig": "workspace:*", "typescript": "^5.7.0" } }
EOF
cat > apps/mobile/tsconfig.json << 'EOF'
{ "extends": "@repo/tsconfig/react-native.json", "include": ["src", "app.config.ts"], "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }
EOF
cat > apps/mobile/app.config.ts << 'EOF'
import type { ExpoConfig } from 'expo/config';
const config: ExpoConfig = {
  name: 'Trellis HOA', slug: 'trellis-hoa', version: '0.1.0', orientation: 'portrait',
  scheme: 'trellis', newArchEnabled: true,
  ios: { bundleIdentifier: 'com.trellishoa.app', supportsTablet: true, associatedDomains: ['applinks:trellishoa.com'] },
  android: { package: 'com.trellishoa.app', adaptiveIcon: { backgroundColor: '#ffffff' } },
  plugins: ['expo-router', 'expo-secure-store'],
  extra: { clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY },
};
export default config;
EOF
cat > apps/mobile/src/app/_layout.tsx << 'EOF'
import { Slot } from 'expo-router';
export default function RootLayout() { return <Slot />; }
EOF

# ── apps/web placeholder ──
mkdir -p apps/web/src
cat > apps/web/package.json << 'EOF'
{ "name": "@repo/web", "version": "0.0.0", "private": true, "scripts": { "dev": "echo 'Phase 5'", "check-types": "echo 'No source'" }, "devDependencies": { "@repo/tsconfig": "workspace:*" } }
EOF
touch apps/web/src/.gitkeep

# ── Docker ──
cat > Dockerfile << 'DOCKERFILE'
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat && corepack enable
FROM base AS pruner
WORKDIR /app
RUN npm install turbo --global
COPY . .
RUN turbo prune @repo/api --docker
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo build --filter=@repo/api
FROM node:22-alpine AS runner
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 appuser
WORKDIR /app
COPY --from=installer --chown=appuser:nodejs /app/apps/api/dist ./dist
COPY --from=installer --chown=appuser:nodejs /app/apps/api/package.json .
COPY --from=installer --chown=appuser:nodejs /app/node_modules ./node_modules
USER appuser
EXPOSE 8080
ENV NODE_ENV=production
CMD ["node", "dist/server.js"]
DOCKERFILE

# ── GitHub Actions ──
mkdir -p .github/workflows
cat > .github/workflows/ci.yml << 'EOF'
name: CI/CD
on:
  push: { branches: ["main"] }
  pull_request: { types: [opened, synchronize] }
env:
  NODE_VERSION: "22"
jobs:
  quality:
    name: Lint, Types, Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: "${{ env.NODE_VERSION }}", cache: "pnpm" }
      - name: Turborepo Cache
        uses: rharkor/caching-for-turbo@v2.2.1
      - run: pnpm install --frozen-lockfile
      - run: turbo run lint check-types test --affected
EOF

echo ""
echo "✅ Trellis monorepo scaffolded. Now run: bash patches.sh"

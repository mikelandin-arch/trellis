#!/usr/bin/env bash
# ============================================================================
# Trellis HOA Platform — Post-Scaffold Patches
# Run AFTER scaffold.sh completes and pnpm install succeeds
# Fixes: ESLint flat config, tRPC v11 package names, Expo deep links
# Usage: bash patches.sh
# ============================================================================
set -euo pipefail

echo "🔧 Applying post-scaffold patches..."

# ── 1. ESLint flat config (root) ───────────────────────────────────────────

cat > eslint.config.mjs << 'EOF'
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-non-null-assertion': 'warn',
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['apps/mobile/**/*.tsx', 'apps/web/**/*.tsx'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...reactHooksPlugin.configs.recommended.rules,
      'react/jsx-no-leaked-render': 'warn',
    },
    settings: {
      react: { version: 'detect' },
    },
  },
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.expo/**', '**/.next/**', '**/cdk.out/**'],
  },
);
EOF

# Add ESLint dependencies to root package.json
# (pnpm install will pick these up)
cat > .eslintrc-deps.json << 'EOF'
{
  "_comment": "Run: pnpm add -Dw @eslint/js typescript-eslint eslint-plugin-react eslint-plugin-react-hooks eslint",
  "devDependencies_to_add": {
    "eslint": "^9.18.0",
    "@eslint/js": "^9.18.0",
    "typescript-eslint": "^8.22.0",
    "eslint-plugin-react": "^7.37.0",
    "eslint-plugin-react-hooks": "^5.1.0"
  }
}
EOF

# ── 2. Fix tRPC package names for v11 ─────────────────────────────────────

# The scaffold used @trpc/react-query which was renamed in tRPC v11
# Correct packages: @trpc/tanstack-react-query (replaces @trpc/react-query)

cat > packages/api-client/package.json << 'EOF'
{
  "name": "@repo/api-client",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "@trpc/client": "^11.0.0",
    "@trpc/tanstack-react-query": "^11.0.0",
    "@tanstack/react-query": "^5.62.0"
  },
  "devDependencies": {
    "@repo/tsconfig": "workspace:*",
    "typescript": "^5.7.0"
  }
}
EOF

# ── 3. Fix Expo app.config.ts with deep link scheme ───────────────────────

cat > apps/mobile/app.config.ts << 'EOF'
import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Trellis HOA',
  slug: 'trellis-hoa',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'trellis',
  newArchEnabled: true,
  ios: {
    bundleIdentifier: 'com.trellishoa.app',
    supportsTablet: true,
    associatedDomains: ['applinks:trellishoa.com'],
  },
  android: {
    package: 'com.trellishoa.app',
    adaptiveIcon: {
      backgroundColor: '#ffffff',
    },
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: 'trellishoa.com', pathPrefix: '/auth' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-camera',
      {
        cameraPermission: 'Allow Trellis HOA to access your camera for violation documentation.',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'Allow Trellis HOA to access your location for property identification.',
      },
    ],
  ],
  extra: {
    eas: {
      projectId: '', // Fill after running: eas init
    },
    clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
  },
};

export default config;
EOF

# ── 4. Add mobile dependencies for tRPC v11 ──────────────────────────────

cat > apps/mobile/package.json << 'EOF'
{
  "name": "@repo/mobile",
  "version": "0.0.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "dev": "expo start",
    "build:ios": "eas build --platform ios",
    "build:android": "eas build --platform android",
    "lint": "eslint src/",
    "check-types": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@clerk/clerk-expo": "^2.5.0",
    "@repo/api-client": "workspace:*",
    "@repo/shared": "workspace:*",
    "@tanstack/react-query": "^5.62.0",
    "@trpc/client": "^11.0.0",
    "@trpc/tanstack-react-query": "^11.0.0",
    "expo": "~53.0.0",
    "expo-camera": "~16.0.0",
    "expo-location": "~18.0.0",
    "expo-router": "~4.0.0",
    "expo-secure-store": "~14.0.0",
    "react": "^19.0.0",
    "react-native": "~0.79.0",
    "react-native-mmkv": "^3.2.0"
  },
  "devDependencies": {
    "@repo/tsconfig": "workspace:*",
    "typescript": "^5.7.0"
  }
}
EOF

# ── 5. EAS config ─────────────────────────────────────────────────────────

cat > apps/mobile/eas.json << 'EOF'
{
  "cli": {
    "version": ">= 14.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_API_URL": "http://localhost:3001",
        "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY": ""
      }
    },
    "preview": {
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api-dev.trellishoa.com",
        "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY": ""
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.trellishoa.com",
        "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY": ""
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "",
        "ascAppId": ""
      },
      "android": {
        "serviceAccountKeyPath": ""
      }
    }
  }
}
EOF

# ── 6. Prettier config (works with ESLint) ─────────────────────────────────

cat > .prettierrc << 'EOF'
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
EOF

cat > .prettierignore << 'EOF'
node_modules
dist
.expo
.next
cdk.out
coverage
*.sql
EOF

echo ""
echo "✅ Patches applied successfully!"
echo ""
echo "Next: run these commands:"
echo "  pnpm add -Dw eslint @eslint/js typescript-eslint eslint-plugin-react eslint-plugin-react-hooks prettier"
echo "  rm .eslintrc-deps.json"
echo "  pnpm install"
echo "  turbo run lint check-types"

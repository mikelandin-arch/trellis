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

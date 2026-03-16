import { TRPCError } from '@trpc/server';
import { sql as drizzleSql } from 'drizzle-orm';
import { db, adminDb } from '@repo/db';
import { middleware, publicProcedure } from './router';
import { resolveTenantId } from './context';

// ---------------------------------------------------------------------------
// Layer 1 — isAuthed: JWT validated, userId exists
// ---------------------------------------------------------------------------

const isAuthed = middleware(async ({ ctx, next }) => {
  if (!ctx.auth.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }

  return next({
    ctx: {
      auth: {
        ...ctx.auth,
        userId: ctx.auth.userId,
        sessionId: ctx.auth.sessionId!,
      },
    },
  });
});

// ---------------------------------------------------------------------------
// Layer 2 — hasOrgContext: active organization required, resolves tenantId
// ---------------------------------------------------------------------------

const hasOrgContext = middleware(async ({ ctx, next }) => {
  const orgId = ctx.auth.orgId;
  if (!orgId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'No active organization. Select an HOA first.',
    });
  }

  const tenantId = await resolveTenantId(orgId);
  if (tenantId === null) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Organization not linked to a tenant',
    });
  }

  return next({
    ctx: {
      auth: {
        ...ctx.auth,
        orgId,
        orgRole: ctx.auth.orgRole!,
        orgPermissions: ctx.auth.orgPermissions ?? [],
      },
      tenantId,
    },
  });
});

// ---------------------------------------------------------------------------
// requirePermission — factory for per-route permission checks
// ---------------------------------------------------------------------------

export function requirePermission(permission: string) {
  return middleware(async ({ ctx, next }) => {
    const perms = ctx.auth.orgPermissions ?? [];

    if (!perms.includes(permission)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Missing permission: ${permission}`,
      });
    }

    return next({ ctx });
  });
}

// ---------------------------------------------------------------------------
// isSuperAdmin — verifies platform super_admin role, provides BYPASSRLS pool
// ---------------------------------------------------------------------------

const isSuperAdmin = middleware(async ({ ctx, next }) => {
  if (ctx.auth.orgRole !== 'org:super_admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Super admin access required',
    });
  }

  return next({ ctx: { db: adminDb } });
});

// ---------------------------------------------------------------------------
// Exported procedure hierarchy
// ---------------------------------------------------------------------------

export const authedProcedure = publicProcedure.use(isAuthed);

export const orgProcedure = authedProcedure.use(hasOrgContext);

// Layer 3+4 — inline on orgProcedure so ctx.tenantId is visible to TypeScript.
// Wraps the entire downstream resolver in a Drizzle transaction with SET LOCAL.
export const tenantProcedure = orgProcedure.use(async ({ ctx, next }) =>
  db.transaction(async (tx) => {
    await tx.execute(
      drizzleSql`SELECT set_config('app.current_tenant', ${String(ctx.tenantId)}, true)`,
    );
    return next({ ctx: { db: tx } });
  }),
);

export const superAdminProcedure = authedProcedure.use(isSuperAdmin);

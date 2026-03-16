import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { getAuth } from '@clerk/fastify';
import { db, tenants } from '@repo/db';
import { eq } from 'drizzle-orm';

const CACHE_TTL_MS = 5 * 60 * 1000;

const tenantCache = new Map<
  string,
  { tenantId: number; expiresAt: number }
>();

export async function resolveTenantId(
  clerkOrgId: string,
): Promise<number | null> {
  const cached = tenantCache.get(clerkOrgId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.tenantId;
  }

  const rows = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.clerkOrgId, clerkOrgId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  tenantCache.set(clerkOrgId, {
    tenantId: row.id,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return row.id;
}

export function createContext({ req, res }: CreateFastifyContextOptions): {
  req: CreateFastifyContextOptions['req'];
  res: CreateFastifyContextOptions['res'];
  auth: {
    userId: string | null;
    sessionId: string | null;
    orgId: string | null;
    orgRole: string | null;
    orgPermissions: readonly string[] | null;
  };
} {
  const clerkAuth = getAuth(req);

  return {
    req,
    res,
    auth: {
      userId: clerkAuth.userId ?? null,
      sessionId: clerkAuth.sessionId ?? null,
      orgId: clerkAuth.orgId ?? null,
      orgRole: clerkAuth.orgRole ?? null,
      orgPermissions:
        (clerkAuth as Record<string, unknown>).orgPermissions as
          | readonly string[]
          | null ?? null,
    },
  };
}

export type Context = ReturnType<typeof createContext>;

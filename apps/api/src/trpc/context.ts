import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import type { FastifyRequest } from 'fastify';
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

export interface AuthInfo {
  userId: string | null;
  sessionId: string | null;
  orgId: string | null;
  orgRole: string | null;
  orgPermissions: readonly string[] | null;
}

function extractAuth(req: FastifyRequest): AuthInfo {
  const raw = (req as FastifyRequest & { auth?: Record<string, unknown> }).auth;
  if (!raw) {
    return {
      userId: null,
      sessionId: null,
      orgId: null,
      orgRole: null,
      orgPermissions: null,
    };
  }

  return {
    userId: (raw.userId as string) ?? null,
    sessionId: (raw.sessionId as string) ?? null,
    orgId: (raw.orgId as string) ?? null,
    orgRole: (raw.orgRole as string) ?? null,
    orgPermissions: (raw.orgPermissions as readonly string[]) ?? null,
  };
}

export function createContext({ req, res }: CreateFastifyContextOptions): {
  req: CreateFastifyContextOptions['req'];
  res: CreateFastifyContextOptions['res'];
  auth: AuthInfo;
} {
  return { req, res, auth: extractAuth(req) };
}

export type Context = ReturnType<typeof createContext>;

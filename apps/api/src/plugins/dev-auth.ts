import type {
  FastifyInstance,
  FastifyPluginCallback,
  FastifyRequest,
} from 'fastify';
import fp from 'fastify-plugin';

/**
 * Development-only replacement for @clerk/fastify clerkPlugin.
 * Decorates req.auth with mock values when a mock-dev-token is present,
 * allowing the full tRPC stack (incl. tenantProcedure) to run without
 * a real Clerk secret key.
 *
 * NEVER registered when NODE_ENV !== 'development'.
 */
const devAuth: FastifyPluginCallback = (
  instance: FastifyInstance,
  _opts: Record<string, unknown>,
  done: () => void,
) => {
  instance.decorateRequest('auth', null);

  instance.addHook('preHandler', async (req: FastifyRequest) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token === 'mock-dev-token') {
      (req as FastifyRequest & { auth: unknown }).auth = {
        userId: 'user_3B0lenUBBFeWFai0wg1f6G6fxRk',
        sessionId: 'sess_mock_dev',
        orgId: 'org_3B0ke05kRyhNKSjphKtcJyycHcd',
        orgRole: 'org:board_officer',
        orgSlug: 'talasera-hoa',
        orgPermissions: [
          'org:violations:create',
          'org:finance:manage',
          'org:arc:manage',
        ],
      };
    } else {
      (req as FastifyRequest & { auth: unknown }).auth = {
        userId: null,
        sessionId: null,
        orgId: null,
        orgRole: null,
        orgSlug: null,
        orgPermissions: null,
      };
    }
  });

  done();
};

export const devAuthPlugin = fp(devAuth, {
  name: 'dev-auth',
  fastify: '5.x',
});

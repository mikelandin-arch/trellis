import Fastify from 'fastify';
import cors from '@fastify/cors';
import { clerkPlugin } from '@clerk/fastify';
import {
  fastifyTRPCPlugin,
  type FastifyTRPCPluginOptions,
} from '@trpc/server/adapters/fastify';
import { createContext } from './trpc/context';
import { appRouter, type AppRouter } from './routers';
import { clerkWebhookPlugin } from './webhooks/clerk';
import { stripeWebhookPlugin } from './webhooks/stripe';
import { devAuthPlugin } from './plugins/dev-auth';

const PORT = Number(process.env.API_PORT) || 3001;

function hasValidClerkKeys(): boolean {
  const pk = process.env.CLERK_PUBLISHABLE_KEY ?? '';
  const sk = process.env.CLERK_SECRET_KEY ?? '';
  return pk.length > 15 && sk.length > 15;
}

async function main(): Promise<void> {
  const app = Fastify({
    logger: true,
    maxParamLength: 5000,
  });

  const useRealClerk = hasValidClerkKeys();

  if (!useRealClerk && process.env.NODE_ENV === 'production') {
    throw new Error(
      'CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY are required in production.',
    );
  }

  if (!useRealClerk) {
    app.log.warn('Clerk keys missing or placeholder — using dev auth bypass');
  }

  await app.register(cors, {
    origin: [
      'http://localhost:8081',
      'http://localhost:19006',
      /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
    ],
    credentials: true,
  });

  app.get('/health', async () => ({
    status: 'ok' as const,
    service: 'trellis-api',
    timestamp: new Date().toISOString(),
  }));

  await app.register(stripeWebhookPlugin);

  await app.register(async function authedRoutes(scope) {
    await scope.register(clerkWebhookPlugin);

    if (useRealClerk) {
      await scope.register(clerkPlugin);
    } else {
      await scope.register(devAuthPlugin);
    }

    await scope.register(fastifyTRPCPlugin, {
      prefix: '/trpc',
      trpcOptions: {
        router: appRouter,
        createContext,
        onError({ path, error }) {
          app.log.error({ path, code: error.code }, error.message);
        },
      } satisfies FastifyTRPCPluginOptions<AppRouter>['trpcOptions'],
    });
  });

  await app.listen({ port: PORT, host: '0.0.0.0' });
  app.log.info(`Trellis API running on port ${PORT}`);
}

main().catch((err: unknown) => {
  process.stderr.write(
    `Failed to start server: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});

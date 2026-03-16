import Fastify from 'fastify';
import { clerkPlugin } from '@clerk/fastify';
import {
  fastifyTRPCPlugin,
  type FastifyTRPCPluginOptions,
} from '@trpc/server/adapters/fastify';
import { createContext } from './trpc/context';
import { appRouter, type AppRouter } from './routers';
import { clerkWebhookPlugin } from './webhooks/clerk';

const PORT = Number(process.env.API_PORT) || 3001;

async function main(): Promise<void> {
  const app = Fastify({
    logger: true,
    maxParamLength: 5000,
  });

  // Health endpoint at root scope — clerkPlugin (fastify-plugin wrapped)
  // leaks its preHandler to whatever scope it's registered in, so /health
  // must live outside that scope to avoid Clerk key validation.
  app.get('/health', async () => ({
    status: 'ok' as const,
    service: 'trellis-api',
    timestamp: new Date().toISOString(),
  }));

  // All auth-dependent routes live in a child scope so clerkPlugin's
  // preHandler (leaked via fastify-plugin) stays contained here.
  await app.register(async function authedRoutes(scope) {
    // Webhook plugins registered before clerkPlugin so they get their own
    // encapsulated content-type parser (raw string body for Svix verification)
    // and are not decorated with Clerk's auth preHandler hooks.
    await scope.register(clerkWebhookPlugin);

    await scope.register(clerkPlugin);

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

    // REST webhook stubs — will be fully implemented in later phases
    scope.post('/webhooks/stripe', async (_req, reply) => {
      await reply.send({ received: true });
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

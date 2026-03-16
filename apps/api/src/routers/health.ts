import { router, publicProcedure } from '../trpc/router';

export const healthRouter = router({
  check: publicProcedure.query(() => ({
    status: 'ok' as const,
    service: 'trellis-api',
    timestamp: new Date().toISOString(),
  })),
});

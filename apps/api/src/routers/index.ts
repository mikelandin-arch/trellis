import { router } from '../trpc/router';
import { healthRouter } from './health';
import { propertyRouter } from './property';

export const appRouter = router({
  health: healthRouter,
  property: propertyRouter,
});

export type AppRouter = typeof appRouter;

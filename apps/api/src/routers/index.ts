import { router } from '../trpc/router';
import { healthRouter } from './health';
import { propertyRouter } from './property';
import { violationRouter } from './violation';
import { violationCategoryRouter } from './violation-category';
import { stripeConnectRouter } from './stripe-connect';
import { assessmentRouter } from './assessment';
import { chargeRouter } from './charge';
import { paymentRouter } from './payment';

export const appRouter = router({
  health: healthRouter,
  property: propertyRouter,
  violation: violationRouter,
  violationCategory: violationCategoryRouter,
  stripeConnect: stripeConnectRouter,
  assessment: assessmentRouter,
  charge: chargeRouter,
  payment: paymentRouter,
});

export type AppRouter = typeof appRouter;

import { router } from '../trpc/router';
import { healthRouter } from './health';
import { propertyRouter } from './property';
import { violationRouter } from './violation';
import { violationCategoryRouter } from './violation-category';
import { stripeConnectRouter } from './stripe-connect';
import { assessmentRouter } from './assessment';
import { chargeRouter } from './charge';
import { paymentRouter } from './payment';
import { arcRequestRouter } from './arc-request';
import { arcModificationTypeRouter } from './arc-modification-type';
import { communicationRouter } from './communication';
import { documentRouter } from './document';
import { documentCategoryRouter } from './document-category';
import { meetingRouter } from './meeting';
import { agendaItemRouter } from './agenda-item';

export const appRouter = router({
  health: healthRouter,
  property: propertyRouter,
  violation: violationRouter,
  violationCategory: violationCategoryRouter,
  stripeConnect: stripeConnectRouter,
  assessment: assessmentRouter,
  charge: chargeRouter,
  payment: paymentRouter,
  arcRequest: arcRequestRouter,
  arcModificationType: arcModificationTypeRouter,
  communication: communicationRouter,
  document: documentRouter,
  documentCategory: documentCategoryRouter,
  meeting: meetingRouter,
  agendaItem: agendaItemRouter,
});

export type AppRouter = typeof appRouter;

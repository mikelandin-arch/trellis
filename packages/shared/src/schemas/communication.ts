import { z } from 'zod';
import { paginationSchema } from './common';
import {
  COMMUNICATION_TYPE, COMMUNICATION_STATUS,
  COMMUNICATION_PRIORITY, AUDIENCE_TYPE, DELIVERY_CHANNEL,
} from '../constants/communication-states';

const allTypes = Object.values(COMMUNICATION_TYPE);
const allStatuses = Object.values(COMMUNICATION_STATUS);
const allPriorities = Object.values(COMMUNICATION_PRIORITY);
const allAudienceTypes = Object.values(AUDIENCE_TYPE);
const allChannels = Object.values(DELIVERY_CHANNEL);

export const communicationTypeSchema = z.enum(allTypes as [string, ...string[]]);
export type CommunicationTypeValue = z.infer<typeof communicationTypeSchema>;

export const communicationStatusSchema = z.enum(allStatuses as [string, ...string[]]);

export const communicationPrioritySchema = z.enum(allPriorities as [string, ...string[]]);

export const audienceTypeSchema = z.enum(allAudienceTypes as [string, ...string[]]);

export const channelSchema = z.enum(allChannels as [string, ...string[]]);

// ── Create Communication ───────────────────────────────────────────────

export const createCommunicationSchema = z.object({
  communicationType: communicationTypeSchema,
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(50_000),
  bodyHtml: z.string().max(100_000).optional(),
  priority: communicationPrioritySchema.default('standard'),
  audienceType: audienceTypeSchema.default('all_members'),
  audienceFilter: z.record(z.unknown()).optional(),
  channels: z.array(channelSchema).min(1).default(['email']),
  scheduledAt: z.coerce.date().optional(),
  sourceType: z.string().optional(),
  sourceId: z.string().uuid().optional(),
});
export type CreateCommunication = z.infer<typeof createCommunicationSchema>;

// ── Send Communication ─────────────────────────────────────────────────

export const sendCommunicationSchema = z.object({
  id: z.string().uuid(),
});
export type SendCommunication = z.infer<typeof sendCommunicationSchema>;

// ── List / Filter ──────────────────────────────────────────────────────

export const communicationListSchema = paginationSchema.extend({
  communicationType: z.array(communicationTypeSchema).optional(),
  status: z.array(communicationStatusSchema).optional(),
  priority: communicationPrioritySchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type CommunicationListInput = z.infer<typeof communicationListSchema>;

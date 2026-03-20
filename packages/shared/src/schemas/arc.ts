import { z } from 'zod';
import { paginationSchema } from './common';
import { ARC_STATUS } from '../constants/arc-states';

const allStatuses = Object.values(ARC_STATUS);

export const arcStatusSchema = z.enum(
  allStatuses as [string, ...string[]],
);

export const arcVoteValueSchema = z.enum(['approve', 'deny', 'conditional']);
export type ArcVoteValue = z.infer<typeof arcVoteValueSchema>;

// ── Create ARC Request ─────────────────────────────────────────────────

export const createArcRequestSchema = z.object({
  propertyId: z.string().uuid(),
  modificationTypeId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  estimatedCost: z.number().positive().multipleOf(0.01).optional(),
  estimatedStartDate: z.coerce.date().optional(),
  estimatedCompletionDate: z.coerce.date().optional(),
});
export type CreateArcRequest = z.infer<typeof createArcRequestSchema>;

// ── List / Filter ──────────────────────────────────────────────────────

export const arcRequestListSchema = paginationSchema.extend({
  status: z.array(arcStatusSchema).optional(),
  propertyId: z.string().uuid().optional(),
  applicantId: z.string().uuid().optional(),
});
export type ArcRequestListInput = z.infer<typeof arcRequestListSchema>;

// ── Transition ─────────────────────────────────────────────────────────

export const transitionArcRequestSchema = z.object({
  requestId: z.string().uuid(),
  toState: arcStatusSchema,
  reason: z.string().min(1).max(2000),
  metadata: z.record(z.unknown()).optional(),
});
export type TransitionArcRequest = z.infer<typeof transitionArcRequestSchema>;

// ── Vote ───────────────────────────────────────────────────────────────

export const arcVoteSchema = z.object({
  requestId: z.string().uuid(),
  voteValue: arcVoteValueSchema,
  rationale: z.string().min(1).max(2000),
  conditionsProposed: z.array(z.object({
    condition: z.string().min(1).max(500),
    dueDate: z.coerce.date().optional(),
  })).optional(),
  guidelineCitations: z.array(z.string().max(200)).optional(),
  conflictOfInterest: z.boolean().default(false),
});
export type ArcVote = z.infer<typeof arcVoteSchema>;

// ── Conditions ─────────────────────────────────────────────────────────

export const addArcConditionSchema = z.object({
  requestId: z.string().uuid(),
  condition: z.string().min(1).max(500),
  dueDate: z.coerce.date().optional(),
});
export type AddArcCondition = z.infer<typeof addArcConditionSchema>;

export const acceptArcConditionsSchema = z.object({
  requestId: z.string().uuid(),
});
export type AcceptArcConditions = z.infer<typeof acceptArcConditionsSchema>;

// ── Modification Types ─────────────────────────────────────────────────

export const arcModificationTypeCreateSchema = z.object({
  name: z.string().min(1).max(100),
  complexityTier: z.number().int().min(1).max(3).default(2),
  requiresSiteVisit: z.boolean().default(false),
  defaultReviewDays: z.number().int().min(1).max(365).default(30),
  requiredDocuments: z.array(z.string().max(200)).default([]),
  feeAmount: z.number().positive().multipleOf(0.01).optional(),
  sortOrder: z.number().int().min(0).default(0),
});
export type ArcModificationTypeCreate = z.infer<typeof arcModificationTypeCreateSchema>;

export const arcModificationTypeUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  complexityTier: z.number().int().min(1).max(3).optional(),
  requiresSiteVisit: z.boolean().optional(),
  defaultReviewDays: z.number().int().min(1).max(365).optional(),
  requiredDocuments: z.array(z.string().max(200)).optional(),
  feeAmount: z.number().positive().multipleOf(0.01).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});
export type ArcModificationTypeUpdate = z.infer<typeof arcModificationTypeUpdateSchema>;

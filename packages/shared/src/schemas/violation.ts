import { z } from 'zod';
import { paginationSchema } from './common';
import { VIOLATION_STATUS } from '../constants/violation-states';

const allStatuses = Object.values(VIOLATION_STATUS);

export const violationStatusSchema = z.enum(
  allStatuses as [string, ...string[]],
);

export const violationSeveritySchema = z.enum([
  'minor',
  'moderate',
  'major',
  'health_safety',
]);
export type ViolationSeverity = z.infer<typeof violationSeveritySchema>;

export const violationSourceSchema = z.enum([
  'board_inspection',
  'homeowner_report',
  'anonymous',
  'automated',
  'management_company',
]);
export type ViolationSource = z.infer<typeof violationSourceSchema>;

export const evidenceTypeSchema = z.enum(['photo', 'video', 'document']);
export type EvidenceType = z.infer<typeof evidenceTypeSchema>;

// ── Create Violation ───────────────────────────────────────────────────

export const createViolationSchema = z.object({
  propertyId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  severity: violationSeveritySchema,
  source: violationSourceSchema.default('board_inspection'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isAnonymousReport: z.boolean().default(false),
});
export type CreateViolation = z.infer<typeof createViolationSchema>;

// ── List / Filter ──────────────────────────────────────────────────────

export const violationListSchema = paginationSchema.extend({
  status: z.array(violationStatusSchema).optional(),
  propertyId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  severity: violationSeveritySchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type ViolationListInput = z.infer<typeof violationListSchema>;

// ── Transition ─────────────────────────────────────────────────────────

export const transitionViolationSchema = z.object({
  violationId: z.string().uuid(),
  toState: violationStatusSchema,
  reason: z.string().min(1).max(2000),
  metadata: z.record(z.unknown()).optional(),
  hearingDate: z.coerce.date().optional(),
  fineAmount: z
    .number()
    .positive()
    .multipleOf(0.01)
    .optional(),
});
export type TransitionViolation = z.infer<typeof transitionViolationSchema>;

// ── Add Evidence ───────────────────────────────────────────────────────

export const addEvidenceSchema = z.object({
  violationId: z.string().uuid(),
  evidenceType: evidenceTypeSchema,
  description: z.string().max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  fileHash: z.string().optional(),
});
export type AddEvidence = z.infer<typeof addEvidenceSchema>;

// ── Dismiss (shortcut) ────────────────────────────────────────────────

export const dismissViolationSchema = z.object({
  violationId: z.string().uuid(),
  reason: z.string().min(1).max(2000),
});
export type DismissViolation = z.infer<typeof dismissViolationSchema>;

// ── Violation Categories ───────────────────────────────────────────────

export const violationCategoryCreateSchema = z.object({
  parentId: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  defaultSeverity: violationSeveritySchema.default('minor'),
  defaultCureDays: z.number().int().min(1).max(365).default(14),
  defaultFineAmount: z.number().positive().multipleOf(0.01).optional(),
  governingDocSection: z.string().max(100).optional(),
  sortOrder: z.number().int().min(0).default(0),
});
export type ViolationCategoryCreate = z.infer<typeof violationCategoryCreateSchema>;

export const violationCategoryUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  defaultSeverity: violationSeveritySchema.optional(),
  defaultCureDays: z.number().int().min(1).max(365).optional(),
  defaultFineAmount: z.number().positive().multipleOf(0.01).nullable().optional(),
  governingDocSection: z.string().max(100).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});
export type ViolationCategoryUpdate = z.infer<typeof violationCategoryUpdateSchema>;

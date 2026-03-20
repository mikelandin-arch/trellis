import { z } from 'zod';
import { paginationSchema } from './common';

export const documentCategorySchema = z.enum([
  'governing_docs',
  'financial',
  'meeting_minutes',
  'correspondence',
  'violation_evidence',
  'arc_documents',
  'insurance',
  'contracts',
  'maintenance',
  'forms',
  'other',
]);
export type DocumentCategory = z.infer<typeof documentCategorySchema>;

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  governing_docs: 'Governing Documents',
  financial: 'Financial',
  meeting_minutes: 'Meeting Minutes',
  correspondence: 'Correspondence',
  violation_evidence: 'Violation Evidence',
  arc_documents: 'ARC Documents',
  insurance: 'Insurance',
  contracts: 'Contracts',
  maintenance: 'Maintenance',
  forms: 'Forms',
  other: 'Other',
};

// ── Get Upload URL ─────────────────────────────────────────────────────

export const getUploadUrlSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  category: documentCategorySchema,
});
export type GetUploadUrl = z.infer<typeof getUploadUrlSchema>;

// ── Confirm Upload ─────────────────────────────────────────────────────

export const confirmUploadSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  category: documentCategorySchema,
  fileKey: z.string().min(1),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1).max(100),
  isPublic: z.boolean().default(false),
  searchText: z.string().max(50_000).optional(),
});
export type ConfirmUpload = z.infer<typeof confirmUploadSchema>;

// ── Create Version ─────────────────────────────────────────────────────

export const createVersionSchema = z.object({
  documentId: z.string().uuid(),
  fileKey: z.string().min(1),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1).max(100),
  changeSummary: z.string().max(1000).optional(),
});
export type CreateVersion = z.infer<typeof createVersionSchema>;

// ── List / Filter ──────────────────────────────────────────────────────

export const documentListSchema = paginationSchema.extend({
  category: documentCategorySchema.optional(),
  isPublic: z.boolean().optional(),
});
export type DocumentListInput = z.infer<typeof documentListSchema>;

// ── Search ─────────────────────────────────────────────────────────────

export const documentSearchSchema = z.object({
  query: z.string().min(1).max(500),
  category: documentCategorySchema.optional(),
  limit: z.number().int().min(1).max(50).default(20),
});
export type DocumentSearch = z.infer<typeof documentSearchSchema>;

// ── Document Category CRUD ─────────────────────────────────────────────

export const documentCategoryCreateSchema = z.object({
  name: z.string().min(1).max(100),
  parentId: z.string().uuid().optional(),
  sortOrder: z.number().int().min(0).default(0),
});
export type DocumentCategoryCreate = z.infer<typeof documentCategoryCreateSchema>;

export const documentCategoryUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  sortOrder: z.number().int().min(0).optional(),
});
export type DocumentCategoryUpdate = z.infer<typeof documentCategoryUpdateSchema>;

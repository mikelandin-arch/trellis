import { TRPCError } from '@trpc/server';
import { eq, and, desc, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import {
  documents, documentVersions, communities,
} from '@repo/db';
import type { DbClient } from '@repo/db';
import {
  getUploadUrlSchema, confirmUploadSchema, createVersionSchema,
  documentListSchema, documentSearchSchema, idParamSchema,
} from '@repo/shared';
import { router } from '../trpc/router';
import { tenantProcedure, requirePermission } from '../trpc/procedures';
import { getPresignedUploadUrl, getPresignedDownloadUrl, buildDocumentFileKey, buildFileUrl } from '../lib/s3';

const ADMIN_ROLES = new Set(['org:super_admin', 'org:board_officer', 'org:board_member', 'org:property_manager']);

async function resolveCommunityId(db: DbClient): Promise<string> {
  const rows = await db
    .select({ id: communities.id })
    .from(communities)
    .limit(1);
  if (!rows[0]) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'No community found for this tenant' });
  }
  return rows[0].id;
}

export const documentRouter = router({
  list: tenantProcedure
    .input(documentListSchema)
    .query(async ({ ctx, input }) => {
      const isAdmin = ADMIN_ROLES.has(ctx.auth.orgRole);
      const conditions: SQL[] = [];

      if (input.category) {
        conditions.push(eq(documents.category, input.category));
      }
      if (!isAdmin) {
        conditions.push(eq(documents.isPublic, true));
      }
      if (input.cursor) {
        conditions.push(sql`${documents.id} <= ${input.cursor}`);
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await ctx.db
        .select()
        .from(documents)
        .where(where)
        .orderBy(desc(documents.createdAt))
        .limit(input.limit + 1);

      const hasMore = rows.length > input.limit;
      const items = hasMore ? rows.slice(0, input.limit) : rows;
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

      return { items, nextCursor };
    }),

  getById: tenantProcedure
    .input(idParamSchema)
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(documents)
        .where(eq(documents.id, input.id))
        .limit(1);

      if (!rows[0]) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });
      }

      const isAdmin = ADMIN_ROLES.has(ctx.auth.orgRole);
      if (!isAdmin && !rows[0].isPublic) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied to this document' });
      }

      const versions = await ctx.db
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.documentId, input.id))
        .orderBy(desc(documentVersions.version));

      const downloadUrl = await getPresignedDownloadUrl(rows[0].fileKey);

      return { ...rows[0], versions, downloadUrl };
    }),

  getUploadUrl: tenantProcedure
    .use(requirePermission('org:documents:manage'))
    .input(getUploadUrlSchema)
    .mutation(async ({ ctx, input }) => {
      const fileKey = buildDocumentFileKey(ctx.tenantId, input.category, input.filename);
      const { uploadUrl } = await getPresignedUploadUrl(fileKey, input.mimeType);
      return { uploadUrl, fileKey };
    }),

  confirmUpload: tenantProcedure
    .use(requirePermission('org:documents:manage'))
    .input(confirmUploadSchema)
    .mutation(async ({ ctx, input }) => {
      const communityId = await resolveCommunityId(ctx.db);
      const fileUrl = buildFileUrl(input.fileKey);

      const [doc] = await ctx.db.insert(documents).values({
        tenantId: ctx.tenantId,
        communityId,
        category: input.category,
        title: input.title,
        description: input.description,
        fileKey: input.fileKey,
        fileUrl,
        fileSizeBytes: input.fileSize,
        mimeType: input.mimeType,
        isPublic: input.isPublic,
        uploadedBy: ctx.auth.userId,
        searchText: input.searchText,
      }).returning();

      return doc!;
    }),

  createVersion: tenantProcedure
    .use(requirePermission('org:documents:manage'))
    .input(createVersionSchema)
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(documents)
        .where(eq(documents.id, input.documentId))
        .limit(1);

      if (!rows[0]) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });
      }

      const current = rows[0];

      await ctx.db.insert(documentVersions).values({
        tenantId: ctx.tenantId,
        documentId: current.id,
        version: current.version,
        fileKey: current.fileKey,
        fileUrl: current.fileUrl,
        fileSizeBytes: current.fileSizeBytes,
        changeSummary: input.changeSummary,
        uploadedBy: current.uploadedBy,
      });

      const [updated] = await ctx.db
        .update(documents)
        .set({
          fileKey: input.fileKey,
          fileUrl: buildFileUrl(input.fileKey),
          fileSizeBytes: input.fileSize,
          mimeType: input.mimeType,
          version: current.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, input.documentId))
        .returning();

      return updated!;
    }),

  search: tenantProcedure
    .input(documentSearchSchema)
    .query(async ({ ctx, input }) => {
      const isAdmin = ADMIN_ROLES.has(ctx.auth.orgRole);
      const conditions: SQL[] = [
        sql`search_vector @@ plainto_tsquery('english', ${input.query})`,
      ];

      if (input.category) {
        conditions.push(eq(documents.category, input.category));
      }
      if (!isAdmin) {
        conditions.push(eq(documents.isPublic, true));
      }

      const rows = await ctx.db
        .select({
          id: documents.id,
          title: documents.title,
          description: documents.description,
          category: documents.category,
          mimeType: documents.mimeType,
          createdAt: documents.createdAt,
          rank: sql<number>`ts_rank(search_vector, plainto_tsquery('english', ${input.query}))`.as('rank'),
        })
        .from(documents)
        .where(and(...conditions))
        .orderBy(sql`rank DESC`)
        .limit(input.limit);

      return rows;
    }),

  delete: tenantProcedure
    .use(requirePermission('org:documents:manage'))
    .input(idParamSchema)
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(documents)
        .where(eq(documents.id, input.id))
        .limit(1);

      if (!rows[0]) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });
      }

      const doc = rows[0];
      const retentionYears = 7;
      const retentionCutoff = new Date();
      retentionCutoff.setFullYear(retentionCutoff.getFullYear() - retentionYears);

      if (doc.createdAt && doc.createdAt > retentionCutoff) {
        const categories = new Set(['governing_docs', 'violation_evidence']);
        if (categories.has(doc.category)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Cannot delete ${doc.category} documents within the ${retentionYears}-year retention window (RCW 64.38.045)`,
          });
        }
      }

      const [deleted] = await ctx.db
        .update(documents)
        .set({ updatedAt: new Date(), category: 'other' })
        .where(eq(documents.id, input.id))
        .returning();

      return deleted!;
    }),
});

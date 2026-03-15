import { z } from 'zod';
export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
});
export const idParamSchema = z.object({ id: z.string().uuid() });
export const tenantIdSchema = z.number().int().positive().brand('TenantId');
export type Pagination = z.infer<typeof paginationSchema>;
export type IdParam = z.infer<typeof idParamSchema>;

import { z } from 'zod';
import { GrantModeSchema } from './common';

export const CreateGrantSchema = z.object({
  bookId: z.string().uuid(),
  email: z.string().email().max(255),
  password: z.string().min(8).max(255).optional(),
  mode: GrantModeSchema.default('private'),
  commentsAllowed: z.boolean().default(false),
  offlineAllowed: z.boolean().default(false),
  expiresAt: z.string().datetime().optional(),
});

export type CreateGrant = z.infer<typeof CreateGrantSchema>;

export const UpdateGrantSchema = z.object({
  mode: GrantModeSchema.optional(),
  commentsAllowed: z.boolean().optional(),
  offlineAllowed: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export type UpdateGrant = z.infer<typeof UpdateGrantSchema>;

// Admin grants list: bounded like the library endpoint, but with a higher
// default so the (non-paginated) admin grants view is not silently truncated.
// LIMIT 1000 matches the comments/bookmarks/highlights list convention from
// plan 212-P4 (bounded scans, no unbounded reads).
export const GrantsListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).default(1000),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type GrantsListQuery = z.infer<typeof GrantsListQuerySchema>;

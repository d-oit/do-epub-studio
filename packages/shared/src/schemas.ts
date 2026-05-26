import { z } from 'zod';

export const BookVisibilitySchema = z.enum([
  'private',
  'password_protected',
  'reader_only',
  'editorial_review',
  'public',
]);

export const GrantModeSchema = z.enum([
  'private',
  'password_protected',
  'reader_only',
  'editorial_review',
  'public',
]);

export const GlobalRoleSchema = z.enum(['admin', 'editor', 'reader']);

export const CommentStatusSchema = z.enum(['open', 'resolved', 'deleted']);

export const CommentVisibilitySchema = z.enum(['shared', 'internal', 'resolved']);

export const SyncOperationSchema = z.enum(['create', 'update', 'delete']);

export const SyncStatusSchema = z.enum(['pending', 'synced', 'failed', 'conflict']);

export const EntityTypeSchema = z.enum([
  'book',
  'grant',
  'session',
  'comment',
  'user',
  'bookmark',
  'highlight',
]);

export const AnnotationLocatorSchema = z
  .object({
    cfi: z.string().max(2048).optional(),
    selectedText: z.string().max(10000).optional(),
    chapterRef: z.string().max(1024).optional(),
    elementIndex: z.number().optional(),
    charOffset: z.number().optional(),
  })
  .refine((loc: { cfi?: string; selectedText?: string }) => Boolean(loc.cfi ?? loc.selectedText), {
    message: 'Locator must have at least cfi or selectedText',
  });

// Multi-signal locator requiring CFI + text + chapter per ADR-006
export const MultiSignalLocatorSchema = z
  .object({
    cfi: z.string().min(1, 'CFI is required for multi-signal locator').max(2048),
    selectedText: z
      .string()
      .min(1, 'Selected text is required for multi-signal locator')
      .max(10000),
    chapterRef: z
      .string()
      .min(1, 'Chapter reference is required for multi-signal locator')
      .max(1024),
  })
  .strict();

export const AccessRequestSchema = z.object({
  bookSlug: z.string().min(1).max(255),
  email: z.string().email().max(255),
  password: z.string().max(255).optional(),
});

export const CreateBookSchema = z.object({
  title: z.string().min(1).max(500),
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9_-]+$/),
  authorName: z.string().max(255).optional(),
  description: z.string().max(5000).optional(),
  language: z.string().length(2).default('en'),
  visibility: BookVisibilitySchema.default('private'),
});

export const CreateGrantSchema = z.object({
  bookId: z.string().uuid(),
  email: z.string().email().max(255),
  password: z.string().min(8).max(255).optional(),
  mode: GrantModeSchema.default('private'),
  commentsAllowed: z.boolean().default(false),
  offlineAllowed: z.boolean().default(false),
  expiresAt: z.string().datetime().optional(),
});

export const UpdateGrantSchema = z.object({
  mode: GrantModeSchema.optional(),
  commentsAllowed: z.boolean().optional(),
  offlineAllowed: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const ProgressUpdateSchema = z.object({
  locator: MultiSignalLocatorSchema,
  progressPercent: z.number().min(0).max(100),
});

export const BookmarkCreateSchema = z.object({
  locator: MultiSignalLocatorSchema,
  label: z.string().max(255).optional(),
});

export const HighlightCreateSchema = z.object({
  locator: MultiSignalLocatorSchema,
  note: z.string().max(5000).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .default('#ffff00'),
});

export const CommentCreateSchema = z.object({
  locator: MultiSignalLocatorSchema.optional(),
  body: z.string().min(1).max(10000),
  visibility: CommentVisibilitySchema.default('shared'),
  parentCommentId: z.string().uuid().optional(),
});

export const CommentUpdateSchema = z.object({
  body: z.string().min(1).max(10000).optional(),
  status: CommentStatusSchema.optional(),
  visibility: CommentVisibilitySchema.optional(),
});

export const CspReportSchema = z.object({
  'csp-report': z.object({
    'document-uri': z.string().url(),
    'referrer': z.string().optional(),
    'blocked-uri': z.string().optional(),
    'violated-directive': z.string(),
    'effective-directive': z.string().optional(),
    'original-policy': z.string().optional(),
    'disposition': z.enum(['enforce', 'report']).optional(),
    'status-code': z.number().optional(),
    'script-sample': z.string().optional(),
  }),
});

export const AuditQuerySchema = z.object({
  entityType: EntityTypeSchema.optional(),
  entityId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type AccessRequest = z.infer<typeof AccessRequestSchema>;
export type CreateBook = z.infer<typeof CreateBookSchema>;
export type CreateGrant = z.infer<typeof CreateGrantSchema>;
export type UpdateGrant = z.infer<typeof UpdateGrantSchema>;
export type ProgressUpdate = z.infer<typeof ProgressUpdateSchema>;
export type BookmarkCreate = z.infer<typeof BookmarkCreateSchema>;
export type HighlightCreate = z.infer<typeof HighlightCreateSchema>;
export type CommentCreate = z.infer<typeof CommentCreateSchema>;
export type CommentUpdate = z.infer<typeof CommentUpdateSchema>;
export type CspReport = z.infer<typeof CspReportSchema>;
export type AuditQuery = z.infer<typeof AuditQuerySchema>;

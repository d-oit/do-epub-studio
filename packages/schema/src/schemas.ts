import { z } from 'zod';

/** Visibility levels for a book: private through fully public. */
export const BookVisibilitySchema = z.enum([
  'private',
  'password_protected',
  'reader_only',
  'editorial_review',
  'public',
]);

/** Access mode granted to a reader on a specific book. */
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

/**
 * Locator for anchoring annotations in EPUB content.
 * Requires at least a CFI or selectedText per ADR-006.
 */
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

export const RecoveryRequestSchema = z.object({
  bookSlug: z.string().min(1).max(255),
  email: z.string().email().max(255),
});

export const AdminRecoveryRequestSchema = z.object({
  email: z.string().email().max(255),
});

export const RecoveryVerifySchema = z.object({
  token: z.string().min(1),
});

export const TelemetryLogSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']),
  traceId: z.string().max(255),
  spanId: z.string().max(255).optional(),
  event: z.string().max(1024),
  metadata: z.record(z.string(), z.unknown()).optional(),
  error: z
    .object({
      name: z.string().max(255),
      message: z.string().max(5000),
      stack: z.string().max(20000).optional(),
    })
    .optional(),
});

export const TelemetryPayloadSchema = z.object({
  logs: z.array(TelemetryLogSchema).max(100),
});

/** Schema for creating a new book. Slug must be URL-safe lowercase. */
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

export const UpdateBookSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  authorName: z.string().max(255).optional(),
  description: z.string().max(5000).optional(),
  language: z.string().length(2).optional(),
  visibility: BookVisibilitySchema.optional(),
});

/** Schema for granting a user access to a book. */
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

/** Schema for creating a highlight annotation with optional note and color. */
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

export const CatalogQuerySchema = z.object({
  q: z.string().min(1).max(255).optional(),
  author: z.string().min(1).max(255).optional(),
  language: z.string().min(2).max(16).optional(),
  limit: z.coerce.number().int().positive().max(100).default(24),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type CatalogQuery = z.infer<typeof CatalogQuerySchema>;

export const LoginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(255),
});

export const ValidateQuerySchema = z.object({
  bookId: z.string().min(1).max(255),
});

export const SignedUrlSchema = z.object({
  expires: z.string().min(1).max(64),
  signature: z.string().min(1).max(255),
});

export const UploadCompleteSchema = z.object({
  storageKey: z.string().min(1).max(1024),
  originalFilename: z.string().min(1).max(500),
  mimeType: z.string().max(200).optional(),
  fileSizeBytes: z.number().int().nonnegative().optional(),
  sha256: z.string().max(64).optional(),
  epubVersion: z.string().max(10).optional(),
  validationResults: z
    .object({
      isValid: z.boolean(),
      errors: z.array(z.string().max(1000)),
      warnings: z.array(z.string().max(1000)),
      epubVersion: z.string().max(10).optional(),
    })
    .optional(),
});

/** Flatten Zod validation issues into a human-readable semicolon-separated string. */
export function formatZodError(error: {
  issues: Array<{ path: (string | number)[]; message: string }>;
}): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') + ': ' : '';
      return path + issue.message;
    })
    .join('; ');
}

export type AccessRequest = z.infer<typeof AccessRequestSchema>;
export type RecoveryRequest = z.infer<typeof RecoveryRequestSchema>;
export type AdminRecoveryRequest = z.infer<typeof AdminRecoveryRequestSchema>;
export type RecoveryVerify = z.infer<typeof RecoveryVerifySchema>;
export type CreateBook = z.infer<typeof CreateBookSchema>;
export type UpdateBook = z.infer<typeof UpdateBookSchema>;
export type CreateGrant = z.infer<typeof CreateGrantSchema>;
export type UpdateGrant = z.infer<typeof UpdateGrantSchema>;
export type ProgressUpdate = z.infer<typeof ProgressUpdateSchema>;
export type BookmarkCreate = z.infer<typeof BookmarkCreateSchema>;
export type HighlightCreate = z.infer<typeof HighlightCreateSchema>;
export type CommentCreate = z.infer<typeof CommentCreateSchema>;
export type CommentUpdate = z.infer<typeof CommentUpdateSchema>;
export type CspReport = z.infer<typeof CspReportSchema>;
export type AuditQuery = z.infer<typeof AuditQuerySchema>;
export type TelemetryLog = z.infer<typeof TelemetryLogSchema>;
export type TelemetryPayload = z.infer<typeof TelemetryPayloadSchema>;

export const ReadingInsightBucketSchema = z.object({
  bookId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  activeMinutes: z.number().int().nonnegative().max(1440),
  activePages: z.number().int().nonnegative().max(10000),
  lastUpdated: z.number().int().nonnegative(),
});

export const ReadingInsightSyncSchema = z.object({
  bookId: z.string().uuid(),
  buckets: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      activeMinutes: z.number().int().nonnegative().max(1440),
      activePages: z.number().int().nonnegative().max(10000),
    }),
  ),
});

export const ReadingInsightSummarySchema = z.object({
  totalActiveMinutes: z.number().int().nonnegative(),
  totalActivePages: z.number().int().nonnegative(),
  estimatedMinutesRemaining: z.number().int().nonnegative().nullable(),
  currentStreakDays: z.number().int().nonnegative(),
  recentActivity: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      activeMinutes: z.number().int().nonnegative(),
      activePages: z.number().int().nonnegative(),
    }),
  ),
});

export type ReadingInsightBucket = z.infer<typeof ReadingInsightBucketSchema>;
export type ReadingInsightSync = z.infer<typeof ReadingInsightSyncSchema>;
export type ReadingInsightSummary = z.infer<typeof ReadingInsightSummarySchema>;

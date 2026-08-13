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

export const CommentStatusSchema = z.enum(['open', 'resolved', 'deleted']);

export const CommentVisibilitySchema = z.enum(['shared', 'internal', 'resolved']);

export const EntityTypeSchema = z.enum([
  'book',
  'grant',
  'session',
  'comment',
  'user',
  'bookmark',
  'highlight',
]);

/** Flexible locator type for export/import (no Zod validation — use MultiSignalLocatorSchema for API boundaries) */
export interface AnnotationLocator {
  cfi?: string;
  selectedText?: string;
  chapterRef?: string;
  elementIndex?: number;
  charOffset?: number;
}

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

/**
 * Shared password policy (ADR-231). Allows long passphrases, blocks known weak
 * values, and avoids composition rules. Service-name/email-derivative rejection
 * is enforced at the route layer where the account email is known.
 */
// Static membership lookup keyed by lowercase password (ts-set-map: use a
// Record<string, true> for small static string-keyed tables, not a Set).
const KNOWN_WEAK_PASSWORDS: Record<string, true> = {
  '12345678': true,
  '123456789': true,
  password: true,
  password1: true,
  password123: true,
  qwerty123: true,
  letmein: true,
  welcome: true,
  admin123: true,
  iloveyou: true,
  abc12345: true,
  monkey123: true,
  dragon123: true,
  superman: true,
  '1q2w3e4r': true,
  changeme: true,
  passw0rd: true,
};

export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .refine((pw) => pw.trim().length > 0, 'Password cannot be blank')
  .refine((pw) => !/^(.)\1{7,}$/.test(pw), 'Password is too simple')
  .refine(
    (pw) => KNOWN_WEAK_PASSWORDS[pw.toLowerCase()] !== true,
    'Password is too common/weak',
  );

export type Password = z.infer<typeof PasswordSchema>;

/**
 * Admin password-reset verification contract (ADR-232). Replaces the broken
 * token-only recovery-verify with a real reset that requires the new password
 * and its confirmation. The worker must only update the password hash after the
 * persisted single-use reset token has been verified.
 */
export const AdminRecoveryVerifySchema = z
  .object({
    token: z.string().min(1),
    newPassword: PasswordSchema,
    newPasswordConfirm: PasswordSchema,
  })
  .refine((d) => d.newPassword === d.newPasswordConfirm, {
    message: 'Passwords do not match',
    path: ['newPasswordConfirm'],
  });

export type AdminRecoveryVerify = z.infer<typeof AdminRecoveryVerifySchema>;

/** Authenticated password change (requires the current password). */
export const PasswordChangeSchema = z
  .object({
    currentPassword: z.string().min(1).max(255),
    newPassword: PasswordSchema,
    newPasswordConfirm: PasswordSchema,
  })
  .refine((d) => d.newPassword === d.newPasswordConfirm, {
    message: 'Passwords do not match',
    path: ['newPasswordConfirm'],
  });

export type PasswordChange = z.infer<typeof PasswordChangeSchema>;

/** Step-up reauthentication (ADR-234): re-confirm the current password. */
export const StepUpSchema = z.object({
  currentPassword: z.string().min(1).max(255),
});

export type StepUp = z.infer<typeof StepUpSchema>;

/** Set a password after verify (no current-password requirement). */
export const SetPasswordSchema = z
  .object({
    newPassword: PasswordSchema,
    newPasswordConfirm: PasswordSchema,
  })
  .refine((d) => d.newPassword === d.newPasswordConfirm, {
    message: 'Passwords do not match',
    path: ['newPasswordConfirm'],
  });

export type SetPassword = z.infer<typeof SetPasswordSchema>;

/** Email verification token (ADR-231 account lifecycle). */
export const EmailVerifyRequestSchema = z.object({
  token: z.string().min(1),
});

export type EmailVerifyRequest = z.infer<typeof EmailVerifyRequestSchema>;

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
  // Client logger's bounded buffer may drop entries when it overflows; report
  // the count so worker-side drop pressure is observable (Plan 212 O3).
  dropped: z.number().int().nonnegative().optional(),
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

export const UpdateBookSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  authorName: z.string().max(255).optional(),
  description: z.string().max(5000).optional(),
  language: z.string().length(2).optional(),
  visibility: BookVisibilitySchema.optional(),
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

export const ProgressLocatorSchema = z.object({
  cfi: z.string().min(1).max(2048),
  selectedText: z.string().max(10000).optional(),
  chapterRef: z.string().max(1024).optional(),
});

export const ProgressUpdateSchema = z.object({
  locator: ProgressLocatorSchema,
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
  offset: z.coerce.number().int().nonnegative().max(100_000).default(0),
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

export const LibraryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type LibraryQuery = z.infer<typeof LibraryQuerySchema>;

// Admin grants list: bounded like the library endpoint, but with a higher
// default so the (non-paginated) admin grants view is not silently truncated.
// LIMIT 1000 matches the comments/bookmarks/highlights list convention from
// plan 212-P4 (bounded scans, no unbounded reads).
export const GrantsListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).default(1000),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type GrantsListQuery = z.infer<typeof GrantsListQuerySchema>;

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
export type ProgressLocator = z.infer<typeof ProgressLocatorSchema>;
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

export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export const ExportQuerySchema = z.object({
  format: z.enum(['markdown', 'html']).default('markdown'),
});

export type ExportQuery = z.infer<typeof ExportQuerySchema>;

export const HighlightUpdateSchema = HighlightCreateSchema.pick({ note: true, color: true }).partial();

export type HighlightUpdate = z.infer<typeof HighlightUpdateSchema>;

export const NotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  unread: z.enum(['true', 'false']).default('false'),
});

export type NotificationsQuery = z.infer<typeof NotificationsQuerySchema>;

export const RecoveryTokenPayloadSchema = z.object({
  email: z.string().email(),
  bookSlug: z.string().optional(),
  purpose: z.string(),
});

export type RecoveryTokenPayload = z.infer<typeof RecoveryTokenPayloadSchema>;

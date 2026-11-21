import { z } from 'zod';

/**
 * Canonical API wire contracts shared by the Worker route registry and the
 * client parsing layer (issue #1489 — production API contract enforcement).
 *
 * Every public Worker route returns one of two envelope shapes:
 *
 * - success: `{ ok: true, data: ... }` (extra top-level keys such as
 *   `updatedAt` / `pagination` are permitted; do not `.strict()` the envelope)
 * - failure: `{ ok: false, error: { code, message, traceId? } }`
 *
 * These schemas are the source of truth for the contract snapshot generator
 * (`apps/worker/scripts/generate-api-contract.mjs`) and for the runtime
 * response-boundary middleware (`apps/worker/src/middleware/contract.ts`).
 */

/** Error payload carried by every non-success envelope. */
export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  traceId: z.string().optional(),
});

/** Failure envelope: `{ ok: false, error: { code, message, traceId? } }`. */
export const ApiErrorEnvelopeSchema = z.object({
  ok: z.literal(false),
  error: ApiErrorSchema.passthrough(),
});
/** Health reports its payload at the envelope top level (`service`), not under `data`. */
export const HealthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal('do-epub-studio-worker'),
}).passthrough();
/**
 * Wrap a data schema in the success envelope. Extra top-level keys are
 * allowed: several routes (e.g. GET /api/books/:bookId/annotation-interchange,
 * GET /api/admin/insights) legitimately emit sibling fields next to `data`.
 */
export function apiSuccessEnvelope<T extends z.ZodType>(dataSchema: T) {
  return z.object({ ok: z.literal(true), data: dataSchema }).passthrough();
}

/** `{ ok: true }` — actions with no payload. */
export const ApiActionSuccessEnvelopeSchema = z.object({ ok: z.literal(true) }).passthrough();

/** Pagination fields shared by list endpoints (catalog, books, notifications). */
export const PaginatedMetaSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  hasMore: z.boolean(),
});

const CatalogBookItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  authorName: z.string().nullable(),
  description: z.string().nullable(),
  language: z.string(),
  coverImageUrl: z.string().nullable(),
  publishedAt: z.string().nullable(),
});

export const CatalogResponseSchema = apiSuccessEnvelope(
  z.object({
    items: z.array(CatalogBookItemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    hasMore: z.boolean(),
  }),
);

const AccessBookSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  authorName: z.string().nullable(),
  visibility: z.string(),
  coverImageUrl: z.string().nullable(),
});

export const AccessRequestResponseSchema = apiSuccessEnvelope(
  z.object({
    sessionToken: z.string(),
    expiresAt: z.string(),
    book: AccessBookSummarySchema,
    capabilities: z.record(z.string(), z.boolean()).optional(),
  }),
);

export const AccessSessionResponseSchema = apiSuccessEnvelope(
  z.object({
    sessionToken: z.string(),
    expiresAt: z.string(),
  }),
);

export const AccessValidateResponseSchema = apiSuccessEnvelope(
  z.object({
    valid: z.boolean(),
    sessionToken: z.string().optional(),
    expiresAt: z.string().optional(),
    book: AccessBookSummarySchema.optional(),
    capabilities: z.record(z.string(), z.boolean()).optional(),
    grantId: z.string().optional(),
    canComment: z.boolean().optional(),
    canDownloadOffline: z.boolean().optional(),
  }),
);

export const AccessValidateAllResponseSchema = apiSuccessEnvelope(
  z.object({
    grantIds: z.array(z.string()),
    revokedBookIds: z.array(z.string()),
  }),
);

export const AcceptInvitationResponseSchema = apiSuccessEnvelope(
  z.object({
    sessionToken: z.string(),
    expiresAt: z.string(),
    email: z.string(),
    role: z.string(),
    book: AccessBookSummarySchema,
    capabilities: z.record(z.string(), z.boolean()),
  }),
);

export const DemoReaderLoginResponseSchema = apiSuccessEnvelope(
  z.object({
    sessionToken: z.string(),
    expiresAt: z.string(),
    book: AccessBookSummarySchema,
    capabilities: z.record(z.string(), z.boolean()),
  }),
);

export const AdminSessionUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.string(),
});

export const AdminLoginResponseSchema = apiSuccessEnvelope(
  z.object({
    token: z.string(),
    user: AdminSessionUserSchema,
  }),
);

export const AdminLoginMfaRequiredResponseSchema = apiSuccessEnvelope(
  z.object({
    mfaRequired: z.literal(true),
    loginTicket: z.string(),
    user: AdminSessionUserSchema,
  }),
);

export const AdminMfaOptionsResponseSchema = apiSuccessEnvelope(
  z.object({
    options: z.record(z.string(), z.unknown()),
  }),
);

export const AdminStepUpResponseSchema = apiSuccessEnvelope(
  z.object({
    token: z.string(),
  }),
);

export const AdminResetCompleteResponseSchema = apiSuccessEnvelope(
  z.object({
    reset: z.literal(true),
  }),
);

export const BookDetailResponseSchema = apiSuccessEnvelope(
  z.object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    authorName: z.string().nullable(),
    description: z.string().nullable(),
    language: z.string(),
    visibility: z.string(),
    coverImageUrl: z.string().nullable(),
  }),
);

export const BookFileUrlResponseSchema = apiSuccessEnvelope(
  z.object({
    fileId: z.string(),
    url: z.string(),
    expiresAt: z.string(),
    fileSize: z.number(),
    mimeType: z.string(),
  }),
);

export const ProgressResponseSchema = apiSuccessEnvelope(
  z.object({
    locator: z.record(z.string(), z.unknown()).nullable(),
    progressPercent: z.number(),
    updatedAt: z.string().nullable(),
    revision: z.number(),
  }),
);

export const BookmarkItemSchema = z.object({
  id: z.string(),
  locator: z.record(z.string(), z.unknown()),
  label: z.string().nullable(),
  createdAt: z.string(),
});

export const BookmarkListResponseSchema = apiSuccessEnvelope(z.array(BookmarkItemSchema));

export const BookmarkCreateResponseSchema = apiSuccessEnvelope(BookmarkItemSchema);

export const HighlightItemSchema = z.object({
  id: z.string(),
  chapterRef: z.string().nullable(),
  cfiRange: z.string().nullable(),
  selectedText: z.string(),
  note: z.string().nullable(),
  color: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  anchorStatus: z.string(),
  confidence: z.number(),
  migrationOutcome: z.string().nullable(),
  revisionId: z.string().nullable(),
  originalCfi: z.string().nullable(),
  originalChapterRef: z.string().nullable(),
  originalSelectedText: z.string().nullable(),
});

export const HighlightListResponseSchema = apiSuccessEnvelope(z.array(HighlightItemSchema));

export const HighlightCreateResponseSchema = apiSuccessEnvelope(HighlightItemSchema);

export const HighlightUpdateResponseSchema = apiSuccessEnvelope(
  z.object({
    id: z.string(),
    note: z.string().nullable().optional(),
    color: z.string().optional(),
  }),
);

export const CommentItemSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  isOwn: z.boolean(),
  chapterRef: z.string().nullable(),
  cfiRange: z.string().nullable(),
  selectedText: z.string().nullable(),
  body: z.string(),
  visibility: z.string(),
  status: z.string(),
  parentCommentId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  resolvedAt: z.string().nullable(),
  anchorStatus: z.string(),
  confidence: z.number(),
  migrationOutcome: z.string().nullable(),
  revisionId: z.string().nullable(),
  originalCfi: z.string().nullable(),
  originalChapterRef: z.string().nullable(),
  originalSelectedText: z.string().nullable(),
});

export const CommentListResponseSchema = apiSuccessEnvelope(z.array(CommentItemSchema));

export const CommentCreateResponseSchema = apiSuccessEnvelope(CommentItemSchema);

export const CommentUpdateResponseSchema = apiSuccessEnvelope(
  z.object({
    id: z.string(),
    body: z.string().optional(),
    status: z.string().optional(),
    visibility: z.string().optional(),
  }),
);

export const InsightsResponseSchema = apiSuccessEnvelope(
  z.object({
    totalActiveMinutes: z.number(),
    totalActivePages: z.number(),
    currentStreakDays: z.number(),
    recentActivity: z.array(
      z.object({
        date: z.string(),
        activeMinutes: z.number(),
        activePages: z.number(),
      }),
    ),
  }),
);

export const InterchangeSavedResponseSchema = apiSuccessEnvelope(
  z.object({
    saved: z.literal(true),
  }),
);

export const SearchResultSchema = z.object({
  bookId: z.string(),
  chapterRef: z.string(),
  snippet: z.string(),
  rank: z.number(),
});

export const SearchResponseSchema = apiSuccessEnvelope(
  z.object({
    results: z.array(SearchResultSchema),
    total: z.number(),
    indexed: z.boolean(),
    indexedAt: z.string().nullable().optional(),
    chapterCount: z.number().optional(),
    message: z.string().optional(),
  }),
);


export const NotificationsListResponseSchema = apiSuccessEnvelope(
  z.object({
    notifications: z.array(
      z.object({
        id: z.string(),
        bookId: z.string(),
        commentId: z.string(),
        parentCommentId: z.string().nullable(),
        type: z.string(),
        message: z.string(),
        readAt: z.string().nullable(),
        createdAt: z.string(),
      }),
    ),
    total: z.number().int().nonnegative(),
    limit: z.number().int().nonnegative(),
    offset: z.number().int().nonnegative(),
  }),
);

export const UnreadCountResponseSchema = apiSuccessEnvelope(
  z.object({
    count: z.number().int().nonnegative(),
  }),
);

export const GrantItemSchema = z.object({
  id: z.string(),
  email: z.string(),
  mode: z.string(),
  commentsAllowed: z.boolean(),
  offlineAllowed: z.boolean(),
  authoringAllowed: z.boolean(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
  revokedAt: z.string().nullable(),
});

export const GrantListResponseSchema = apiSuccessEnvelope(z.array(GrantItemSchema));

export const AdminBookItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  authorName: z.string().nullable(),
  description: z.string().nullable(),
  language: z.string(),
  visibility: z.string(),
  coverImageUrl: z.string().nullable(),
  publishedAt: z.string().nullable(),
});

export const AdminBookListResponseSchema = apiSuccessEnvelope(z.array(AdminBookItemSchema));

export const AdminBookCreateResponseSchema = apiSuccessEnvelope(
  z.object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    uploadUrl: z.string(),
  }),
);

export const RevisionItemSchema = z.object({
  id: z.string(),
  book_id: z.string(),
  storage_key: z.string(),
  original_filename: z.string(),
  mime_type: z.string(),
  file_size_bytes: z.number(),
  sha256: z.string().nullable(),
  epub_version: z.string().nullable(),
  created_at: z.string(),
});

export const RevisionsListResponseSchema = apiSuccessEnvelope(z.array(RevisionItemSchema));

export const AuditEntrySchema = z.object({
  id: z.string(),
  actorEmail: z.string().nullable(),
  entityType: z.string(),
  entityId: z.string(),
  action: z.string(),
  payload: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
});

export const AuditListResponseSchema = apiSuccessEnvelope(
  z.object({
    entries: z.array(AuditEntrySchema),
    total: z.number().int().nonnegative(),
  }),
);

export const AdminStatsResponseSchema = apiSuccessEnvelope(
  z.object({
    totalBooks: z.number(),
    archivedBooks: z.number(),
    activeGrants: z.number(),
    activeSessions: z.number(),
    storageBytes: z.number(),
    recentActivity: z.array(z.object({ action: z.string(), count: z.number() })),
  }),
);

export const AdminInsightsResponseSchema = apiSuccessEnvelope(
  z.array(
    z.object({
      bookId: z.string(),
      totalActiveMinutes: z.number(),
      totalActivePages: z.number(),
      readerCount: z.number(),
      lastActivity: z.string().nullable(),
    }),
  ),
);

export const ValidationReportResponseSchema = apiSuccessEnvelope(
  z.object({
    revisionId: z.string(),
    bytesSha256: z.string().nullable(),
    validatorVersion: z.string(),
    status: z.string(),
    safetyStatus: z.string(),
    epubVersion: z.string().nullable(),
    groups: z.object({
      errors: z.array(z.record(z.string(), z.unknown())),
      warnings: z.array(z.record(z.string(), z.unknown())),
      information: z.array(z.record(z.string(), z.unknown())),
    }),
    accessibility: z.record(z.string(), z.unknown()),
    remediation: z.record(z.string(), z.unknown()),
    failureCode: z.string().nullable(),
    updatedAt: z.string(),
  }),
);

export const ValidationReportListResponseSchema = apiSuccessEnvelope(
  z.array(
    z.object({
      revisionId: z.string(),
      bytesSha256: z.string().nullable(),
      validatorVersion: z.string(),
      status: z.string(),
      safetyStatus: z.string(),
      epubVersion: z.string().nullable(),
      updatedAt: z.string(),
    }),
  ),
);

/** Machine-readable API error with code and message. */
export interface ApiError {
  code: string;
  message: string;
}

/**
 * Standard API response envelope used by all Worker endpoints.
 *
 * @typeParam T - The shape of the success payload
 */
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: ApiError;
}

/** Book metadata returned by admin and catalog endpoints. */
export interface BookResponse {
  id: string;
  slug: string;
  title: string;
  authorName: string | null;
  description: string | null;
  language: string;
  visibility: string;
  coverImageUrl: string | null;
  publishedAt: string | null;
}

/** Book list item with per-reader reading progress joined in. */
export interface LibraryBookResponse {
  id: string;
  slug: string;
  title: string;
  authorName: string | null;
  visibility: string;
  coverImageUrl: string | null;
  description: string | null;
  language: string;
  progressPercent: number;
  progressUpdatedAt: string | null;
}

/** Response after successfully requesting access to a book. */
export interface AccessResponse {
  sessionToken: string;
  book: BookResponse;
  capabilities: ReaderCapabilities;
}

/** Capabilities granted to the current reader for a specific book. */
export interface ReaderCapabilities {
  canRead: boolean;
  canComment: boolean;
  canHighlight: boolean;
  canBookmark: boolean;
  canDownloadOffline: boolean;
  canExportNotes: boolean;
  canManageAccess: boolean;
}

/** Signed URL for downloading an EPUB file, with expiry metadata. */
export interface SignedUrlResponse {
  url: string;
  expiresAt: string;
  fileSize: number;
  mimeType: string;
}

export interface ProgressResponse {
  locator: string;
  progressPercent: number;
  updatedAt: string;
}

export interface BookmarkResponse {
  id: string;
  locator: string;
  label: string | null;
  createdAt: string;
}

export interface HighlightResponse {
  id: string;
  chapterRef: string | null;
  cfiRange: string | null;
  selectedText: string;
  note: string | null;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommentResponse {
  id: string;
  userEmail: string;
  chapterRef: string | null;
  cfiRange: string | null;
  selectedText: string | null;
  body: string;
  status: string;
  visibility: string;
  parentCommentId: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  replies?: CommentResponse[];
}

export interface AuditLogResponse {
  id: string;
  actorEmail: string | null;
  entityType: string;
  entityId: string;
  action: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface GrantResponse {
  id: string;
  email: string;
  mode: string;
  commentsAllowed: boolean;
  offlineAllowed: boolean;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface PaginationQuery {
  limit?: number;
  offset?: number;
  page?: number;
}

export function clampPageSize(value: number | undefined, fallback = 24, max = 100): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(Math.floor(value), max);
}

export function computeOffset(page: number | undefined, limit: number): number {
  if (typeof page !== 'number' || !Number.isFinite(page) || page <= 0) return 0;
  return Math.floor((page - 1) * limit);
}

export function paginate<T>(items: T[], total: number, query: PaginationQuery): PaginatedResponse<T> {
  const limit = clampPageSize(query.limit);
  const offset = query.offset ?? computeOffset(query.page, limit);
  return {
    items,
    total,
    page: query.page ?? Math.floor(offset / limit) + 1,
    pageSize: limit,
    hasMore: offset + items.length < total,
  };
}

export interface SyncQueueItem {
  idempotencyKey: string;
  entityType: string;
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  payload: string;
  createdAt: string;
}

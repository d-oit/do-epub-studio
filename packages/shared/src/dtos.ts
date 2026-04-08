export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: ApiError;
}

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

export interface AccessResponse {
  sessionToken: string;
  book: BookResponse;
  capabilities: ReaderCapabilities;
}

export interface ReaderCapabilities {
  canRead: boolean;
  canComment: boolean;
  canHighlight: boolean;
  canBookmark: boolean;
  canDownloadOffline: boolean;
  canExportNotes: boolean;
  canManageAccess: boolean;
}

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

export interface SyncQueueItem {
  idempotencyKey: string;
  entityType: string;
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  payload: string;
  createdAt: string;
}

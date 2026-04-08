export type GlobalRole = 'admin' | 'editor' | 'reader';

export type BookVisibility = 'private' | 'password_protected' | 'reader_only' | 'editorial_review' | 'public';

export type GrantMode = 'private' | 'password_protected' | 'reader_only' | 'editorial_review' | 'public';

export type CommentStatus = 'open' | 'resolved' | 'deleted';

export type CommentVisibility = 'shared' | 'internal' | 'resolved';

export type SyncOperation = 'create' | 'update' | 'delete';

export type SyncStatus = 'pending' | 'synced' | 'failed' | 'conflict';

export type EntityType = 'book' | 'grant' | 'session' | 'comment' | 'user' | 'bookmark' | 'highlight';

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  globalRole: GlobalRole;
  createdAt: string;
  updatedAt: string;
}

export interface Book {
  id: string;
  slug: string;
  title: string;
  authorName: string | null;
  description: string | null;
  language: string;
  visibility: BookVisibility;
  coverImageUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface BookFile {
  id: string;
  bookId: string;
  storageProvider: 'r2' | 'local';
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  sha256: string | null;
  epubVersion: string | null;
  manifestJson: string | null;
  createdAt: string;
}

export interface BookAccessGrant {
  id: string;
  bookId: string;
  email: string;
  passwordHash: string | null;
  mode: GrantMode;
  allowed: boolean;
  commentsAllowed: boolean;
  offlineAllowed: boolean;
  expiresAt: string | null;
  invitedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
}

export interface ReaderSession {
  id: string;
  bookId: string;
  email: string;
  sessionTokenHash: string;
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface ReadingProgress {
  id: string;
  bookId: string;
  userEmail: string;
  locator: AnnotationLocator;
  progressPercent: number;
  updatedAt: string;
}

export interface Bookmark {
  id: string;
  bookId: string;
  userEmail: string;
  locator: AnnotationLocator;
  label: string | null;
  createdAt: string;
}

export interface Highlight {
  id: string;
  bookId: string;
  userEmail: string;
  chapterRef: string | null;
  cfiRange: string | null;
  selectedText: string;
  note: string | null;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  bookId: string;
  userEmail: string;
  chapterRef: string | null;
  cfiRange: string | null;
  selectedText: string | null;
  body: string;
  status: CommentStatus;
  visibility: CommentVisibility;
  parentCommentId: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface AuditLogEntry {
  id: string;
  actorEmail: string | null;
  entityType: EntityType;
  entityId: string;
  action: string;
  payloadJson: string | null;
  createdAt: string;
}

export interface SyncState {
  id: string;
  userEmail: string;
  entityType: string;
  entityId: string;
  operation: SyncOperation;
  payloadJson: string;
  idempotencyKey: string;
  syncAttempts: number;
  lastSyncAt: string | null;
  status: SyncStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AnnotationLocator {
  cfi?: string;
  selectedText?: string;
  chapterRef?: string;
  elementIndex?: number;
  charOffset?: number;
}

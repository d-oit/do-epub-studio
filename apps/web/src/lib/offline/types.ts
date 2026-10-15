// Persisted offline record shapes, extracted from `db.ts` (ADR-278 warn-zone
// extraction). This module is a leaf: it imports nothing, so `db.ts` can type
// the stores without an edge back into the domain modules — madge treats
// `import type` as a real edge, and `conflict-resolution.ts` re-exports
// `ConflictType` for external callers.

export interface ProgressEntry {
  id: string;
  bookId: string;
  cfi: string;
  percentage: number;
  lastRead: number;
  synced: boolean;
  mutationId: string;
  baseRevision?: number;
}

export interface AnnotationEntry {
  id: string;
  bookId: string;
  type: 'highlight' | 'comment' | 'bookmark';
  cfi: string;
  endCfi?: string;
  text?: string;
  comment?: string;
  color?: string;
  chapter?: string;
  createdAt: number;
  synced: boolean;
  mutationId: string;
  updatedAt?: number;
  displayName?: string;
  syncError?: string;
  /** Comment status — persisted for offline resolve/unresolve (Plan 998). */
  status?: 'open' | 'resolved';
  /** Comment visibility — persisted for offline mutations (Plan 998). */
  visibility?: 'shared' | 'internal' | 'resolved';
}

export interface SyncQueueItem {
  id: string;
  type: 'progress' | 'annotation' | 'reading-insight' | 'feedback';
  payload: unknown;
  mutationId: string;
  createdAt: number;
  attempts: number;
  lastAttempt?: number;
  error?: string;
  permanentError?: boolean;
}

export interface ReadingInsightEntry {
  bookId: string;
  date: string;
  activeMinutes: number;
  activePages: number;
  lastUpdated: number;
  /** Cumulative active minutes per chapter (href -> minutes). Optional; absent for pre-feature entries. */
  chapterMinutes?: Record<string, number>;
  /** Word count per chapter read (href -> words). Optional; absent for pre-feature entries. */
  chapterWords?: Record<string, number>;
}

export interface PermissionCache {
  bookId: string;
  grantId: string;
  canComment: boolean;
  canDownloadOffline: boolean;
  cachedAt: number;
  expiresAt: number;
}

/**
 * Last successfully resolved signed book-file URL (A5, GOAP-300). The URL is a
 * time-limited capability, so it is encrypted at rest like the other sensitive
 * offline payloads; the reader falls back to it only while offline.
 */
export interface BookFileEntry {
  bookId: string;
  url: string;
  fileId: string | null;
  cachedAt: number;
}

/**
 * Offline conflict categories (value + type merged). Kept as a value/type pair
 * (not an enum) so `db.ts` can type the conflicts store without importing the
 * domain module; `conflict-resolution.ts` re-exports it so external modules
 * keep importing from the domain module.
 */
export const ConflictType = {
  ProgressUpdate: 'progress_update',
  AnnotationEdit: 'annotation_edit',
  BookmarkChange: 'bookmark_change',
  CommentUpdate: 'comment_update',
} as const;

export type ConflictType = (typeof ConflictType)[keyof typeof ConflictType];

/** A conflict requiring user resolution; `localVersion`/`remoteVersion`
 *  (entity contents) are encrypted at rest, everything else is plaintext. */
export interface ConflictRecord {
  id: string;
  type: ConflictType;
  localVersion: unknown;
  remoteVersion: unknown;
  localTimestamp: number;
  remoteTimestamp: number;
  resolved: boolean;
  resolution: 'local' | 'remote' | null;
  resolvedAt: number | null;
  bookId: string;
  entityId: string;
  createdAt: number;
}

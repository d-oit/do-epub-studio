/**
 * Shared types for the sync model suite. This module is a leaf: it imports
 * nothing, so `reference-model.ts` can stay a pure, dependency-free model.
 */

export type EntityKind = 'highlight' | 'comment' | 'bookmark';

export type LedgerKind = EntityKind | 'progress' | 'resolve';

export type LedgerStage =
  | 'enqueued' // queued locally, not yet observed settled
  | 'synced' // server state reflects the mutation (or a replay return)
  | 'conflicted' // an explicit conflict record preserves it
  | 'terminal' // surfaced as a permanent failure (queue permanentError / entry syncError)
  | 'purged'; // removed by the app's designed wipe on auth loss

export interface LedgerEntry {
  mutationId: string;
  kind: LedgerKind;
  /** Client-side payload fingerprint used to match conflict records. */
  fingerprint: string;
  /** Server row id once known (annotations / progress rows). */
  serverId: string | null;
  stage: LedgerStage;
  terminalReason?: string;
  /** For resolve ops: the status the client asked the server to set. */
  targetStatus?: string;
  /** Set once any durable evidence for the mutation has been observed. */
  settled?: boolean;
}

export interface ServerCommentRow {
  id: string;
  bookId: string;
  userEmail: string;
  mutationId: string | null;
  chapterRef: string | null;
  cfiRange: string | null;
  selectedText: string | null;
  body: string;
  visibility: string;
  status: string;
  parentCommentId: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface ServerHighlightRow {
  id: string;
  bookId: string;
  userEmail: string;
  mutationId: string | null;
  chapterRef: string | null;
  cfiRange: string | null;
  selectedText: string;
  note: string | null;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServerBookmarkRow {
  id: string;
  bookId: string;
  userEmail: string;
  mutationId: string | null;
  locator: { cfi: string; chapterRef?: string };
  label: string;
  createdAt: string;
}

export interface ServerProgressRow {
  id: string;
  bookId: string;
  userEmail: string;
  locator: { cfi: string } | null;
  progressPercent: number;
  updatedAt: string | null;
  revision: number;
  mutationId: string | null;
}

export interface ServerSnapshot {
  highlights: ServerHighlightRow[];
  comments: ServerCommentRow[];
  bookmarks: ServerBookmarkRow[];
  progress: ServerProgressRow | null;
  /** mirror of the worker's `reading_progress_mutations` table */
  progressMutations: { mutationId: string | null; revision: number }[];
}

export interface RequestLogEntry {
  n: number;
  source: 'client' | 'remote';
  method: string;
  path: string;
  mutationId: string | null;
  status: number;
  committed: boolean;
  /** Server recognized this mutationId as already applied (replay). */
  replay: boolean;
  errorCode?: string;
  /** Transport-level failure injected after a server commit. */
  droppedResponse?: boolean;
}

export interface FailureDirective {
  kind: 'transient5xx' | 'transientNetwork' | 'lostAfterCommit' | 'timeoutAfterCommit';
  /** Substring matched against the request path. */
  path: string;
  /** Remaining activations (decremented on use). */
  times: number;
}

export type RemoteAction =
  | { kind: 'createHighlight'; body: Record<string, unknown> }
  | { kind: 'editHighlight'; id: string; body: Record<string, unknown> }
  | { kind: 'deleteHighlight'; id: string }
  | { kind: 'createComment'; body: Record<string, unknown> }
  | { kind: 'editComment'; id: string; body: Record<string, unknown> }
  | { kind: 'deleteComment'; id: string }
  | { kind: 'createBookmark'; body: Record<string, unknown> }
  | { kind: 'deleteBookmark'; id: string }
  | { kind: 'putProgress'; body: Record<string, unknown> };

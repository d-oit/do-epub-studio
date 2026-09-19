import { api, apiRequest } from '../api';
import { resolveConflict, ConflictType } from './conflict-resolution';
import type { SyncQueueItem } from './db';
import { logClientEvent } from '../client-logger';

/** Outcome of one sync-queue item attempt (owned here so the progress
 *  conflict handler can return it without importing the sync engine). */
export interface SyncResult {
  success: boolean;
  error?: string;
  /** Human-actionable detail for terminal states (e.g. blocked delivery). */
  detail?: string;
}

/** Progress payload synced from the offline queue. */
export interface ProgressSyncPayload {
  bookId: string;
  cfi: string;
  percentage: number;
  mutationId: string;
}

/** Remote progress shape returned by GET /api/books/:bookId/progress. */
interface RemoteProgressResponse {
  locator?: unknown;
  progressPercent?: number;
  updatedAt?: string;
}

/** Write one queued progress mutation to the reader progress API. */
export async function syncProgress(item: SyncQueueItem): Promise<void> {
  const payload = item.payload as ProgressSyncPayload;
  await api.put(`/api/books/${payload.bookId}/progress`, {
    locator: {
      cfi: payload.cfi,
    },
    progressPercent: payload.percentage,
    mutationId: payload.mutationId,
  });
}

/**
 * Resolve a 409 on a progress PUT by fetching the ACTUAL remote progress so
 * the conflict reflects real server state instead of a fabricated copy of the
 * local payload (REL-03, GOAP-999).
 *
 * Outcome mapping:
 * - remote fetch fails (non-401): `conflict_remote_unavailable` — the caller
 *   retains pending state (no fabrication, no retry-cap count, no removal).
 * - remote fetch fails with 401: rethrown so the caller keeps the normal
 *   permission-revocation handling.
 * - LWW resolves with local winner: success (server state is superseded by
 *   the caller's next write semantics — the queue item is acknowledged).
 * - remote wins or manual resolution needed: `conflict_requires_manual_
 *   resolution` — the conflict record keeps both real versions durably for
 *   the user-choice UI.
 */
export async function handleProgressConflict(
  item: SyncQueueItem,
  traceId: string,
  spanId: string,
): Promise<SyncResult> {
  const payload = item.payload as ProgressSyncPayload;

  let remoteData: RemoteProgressResponse | undefined;
  try {
    remoteData = await apiRequest<RemoteProgressResponse>(
      `/api/books/${payload.bookId}/progress`,
    );
  } catch (remoteError) {
    // 401 keeps the normal permission-revocation handling in the outer
    // switch instead of being swallowed as "remote unavailable".
    if ((remoteError as { status?: number }).status === 401) {
      throw remoteError;
    }
    // Unavailable remote fetch retains pending state: do NOT fabricate a
    // conflict and do NOT remove the queue item — it is retried on the next
    // natural sync trigger (online event, next queueSync, SW sync request)
    // and never counts toward the retry cap.
    logClientEvent({
      level: 'warn',
      traceId,
      spanId,
      event: 'sync.item.conflict_remote_unavailable',
      metadata: { itemId: item.id, type: item.type },
      error: {
        name: remoteError instanceof Error ? remoteError.name : 'Error',
        message: remoteError instanceof Error ? remoteError.message : 'Unknown error',
      },
    });
    return { success: false, error: 'conflict_remote_unavailable' };
  }

  const remoteLocator = remoteData?.locator as { cfi?: unknown } | null | undefined;
  // Shape mirrors ProgressSyncPayload minus mutationId: the server's GET
  // progress does not return one.
  const remoteVersion: Omit<ProgressSyncPayload, 'mutationId'> = {
    bookId: payload.bookId,
    cfi: typeof remoteLocator?.cfi === 'string' ? remoteLocator.cfi : '',
    percentage: typeof remoteData?.progressPercent === 'number' ? remoteData.progressPercent : 0,
  };
  const parsedRemoteTs = remoteData?.updatedAt ? Date.parse(remoteData.updatedAt) : NaN;
  // Unusable remote timestamp: keep equal timestamps (forces the manual
  // resolution path with the existing user-choice semantics) but pair it
  // with the REAL remote version content instead of a fabricated copy.
  const remoteTimestamp = Number.isFinite(parsedRemoteTs) ? parsedRemoteTs : item.createdAt;

  const resolution = resolveConflict(
    ConflictType.ProgressUpdate,
    item.payload,
    remoteVersion,
    item.createdAt,
    remoteTimestamp,
    payload.bookId,
    payload.bookId,
  );

  logClientEvent({
    level: 'warn',
    traceId,
    spanId,
    event: 'sync.item.conflict',
    metadata: {
      itemId: item.id,
      type: item.type,
      resolved: resolution.resolved,
      strategy: resolution.strategy,
      winner: resolution.winner,
      remoteFetched: true,
    },
  });

  if (resolution.resolved && resolution.winner === 'local') {
    // Local wins LWW — sync is successful, no need to re-send
    return { success: true };
  }

  // Remote wins (server state supersedes the local write) or manual
  // resolution needed — the conflict record keeps both versions durably.
  return { success: false, error: 'conflict_requires_manual_resolution' };
}

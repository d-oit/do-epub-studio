import { apiRequest } from '../api';
import { recordConflict, ConflictType, flushConflictWrites } from './conflict-resolution';
import type { SyncQueueItem } from './db';
import { requireSessionToken } from './session';
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
  baseRevision?: number;
  dependsOnMutationId?: string;
}

export interface ProgressSyncResult {
  revision: number;
  updatedAt: string;
}

export interface RemoteProgressVersion {
  bookId: string;
  cfi: string;
  percentage: number;
  revision: number;
  updatedAt: string | null;
}

/** Remote progress shape returned by GET /api/books/:bookId/progress. */
interface RemoteProgressResponse {
  locator?: unknown;
  progressPercent?: number;
  updatedAt?: string | null;
  revision?: number;
}

/** Write one queued progress mutation to the reader progress API. */
export async function syncProgress(item: SyncQueueItem): Promise<ProgressSyncResult> {
  const payload = item.payload as ProgressSyncPayload;
  return apiRequest<ProgressSyncResult>(`/api/books/${payload.bookId}/progress`, {
    method: 'PUT',
    token: requireSessionToken(),
    body: JSON.stringify({
      locator: { cfi: payload.cfi },
      progressPercent: payload.percentage,
      mutationId: item.mutationId,
      baseRevision: payload.baseRevision ?? 0,
      ...(payload.dependsOnMutationId ? { dependsOnMutationId: payload.dependsOnMutationId } : {}),
    }),
  });
}

/**
 * Resolve a progress 409 by reading and durably preserving both exact versions.
 * Revision conflicts always require a user choice; timestamps never decide
 * which position wins.
 */
export async function handleProgressConflict(
  item: SyncQueueItem,
  traceId: string,
  spanId: string,
): Promise<SyncResult> {
  const payload = item.payload as ProgressSyncPayload;

  let remoteData: RemoteProgressResponse | undefined;
  try {
    // The progress route is behind `readerAuth`, so the conflict read needs
    // the session token; without it the server answers 401 and the conflict
    // can never be resolved against the remote version.
    remoteData = await apiRequest<RemoteProgressResponse>(`/api/books/${payload.bookId}/progress`, {
      token: requireSessionToken(),
    });
  } catch (remoteError) {
    if (
      typeof remoteError === 'object' &&
      remoteError !== null &&
      'status' in remoteError &&
      remoteError.status === 401
    ) {
      throw remoteError;
    }
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

  const remoteRevision = remoteData?.revision;
  const remotePercentage = remoteData?.progressPercent;
  if (
    typeof remoteRevision !== 'number' ||
    !Number.isInteger(remoteRevision) ||
    remoteRevision < 0 ||
    typeof remotePercentage !== 'number' ||
    !Number.isFinite(remotePercentage) ||
    remotePercentage < 0 ||
    remotePercentage > 100
  ) {
    logClientEvent({
      level: 'warn',
      traceId,
      spanId,
      event: 'sync.item.conflict_remote_unavailable',
      metadata: { itemId: item.id, type: item.type, reason: 'invalid_remote_progress' },
    });
    return { success: false, error: 'conflict_remote_unavailable' };
  }

  const locator = remoteData.locator;
  const remoteCfi =
    typeof locator === 'object' &&
    locator !== null &&
    'cfi' in locator &&
    typeof locator.cfi === 'string'
      ? locator.cfi
      : '';
  const remoteTimestampValue = remoteData.updatedAt ? Date.parse(remoteData.updatedAt) : NaN;
  const remoteTimestamp = Number.isFinite(remoteTimestampValue) ? remoteTimestampValue : 0;
  const remoteVersion: RemoteProgressVersion = {
    bookId: payload.bookId,
    cfi: remoteCfi,
    percentage: remotePercentage,
    revision: remoteRevision,
    updatedAt: remoteData.updatedAt ?? null,
  };

  const conflict = recordConflict(
    ConflictType.ProgressUpdate,
    item.payload,
    remoteVersion,
    item.createdAt,
    remoteTimestamp,
    payload.bookId,
    payload.bookId,
  );
  if (!(await flushConflictWrites())) {
    logClientEvent({
      level: 'error',
      traceId,
      spanId,
      event: 'sync.item.conflict_persist_failed',
      metadata: { itemId: item.id, type: item.type },
    });
    return { success: false, error: 'conflict_persist_failed' };
  }

  logClientEvent({
    level: 'warn',
    traceId,
    spanId,
    event: 'sync.item.conflict',
    metadata: {
      itemId: item.id,
      type: item.type,
      conflictId: conflict.id,
      resolved: false,
      strategy: 'manual',
      remoteFetched: true,
    },
  });

  return { success: false, error: 'conflict_requires_manual_resolution' };
}

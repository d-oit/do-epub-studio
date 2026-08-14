import { v4 as uuidv4 } from 'uuid';
import {
  addToSyncQueue,
  getSyncQueue,
  removeSyncQueueItem,
  updateSyncQueueItem,
  getUnsyncedProgress,
  getUnsyncedAnnotations,
  saveProgress,
  saveAnnotation,
  type SyncQueueItem,
} from './db';
import { api, apiRequest } from '../api';
import type { AnnotationEntry } from './db';
import { clearAllPermissions } from './permissions';
import { createTraceId, createSpanId } from '@do-epub-studio/shared';
import { logClientEvent } from '../client-logger';
import { resolveConflict, ConflictType, getPendingConflicts, clearResolvedConflicts } from './conflict-resolution';

const MAX_RETRY_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

interface SyncResult {
  success: boolean;
  error?: string;
}

// Callback for permission revocation
let onPermissionRevoked: ((bookId: string) => void) | null = null;

/**
 * Tracks the pending retry timeout so it can be cancelled on cleanup.
 * A module-level handle is sufficient since only one retry chain runs at
 * a time (queue is processed item-by-item).
 */
let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;

/** Single-flight drain guard: only one attemptSync loop runs at a time. */
let drainPromise: Promise<void> | null = null;

export function setPermissionRevokedCallback(callback: (bookId: string) => void): void {
  onPermissionRevoked = callback;
}

/** Cancel any pending retry timer. Call this on component/app unmount. */
export function cancelPendingRetry(): void {
  if (retryTimeoutId !== null) {
    clearTimeout(retryTimeoutId);
    retryTimeoutId = null;
  }
}

/** Reset the single-flight drain guard. Exported for test teardown only. */
export function resetDrainPromise(): void {
  drainPromise = null;
}

export function generateMutationId(): string {
  return uuidv4();
}

function calculateDelay(attempt: number): number {
  const delay = BASE_DELAY_MS * Math.pow(2, attempt);
  return Math.min(delay, MAX_DELAY_MS);
}

export async function queueSync(
  type: 'progress' | 'annotation' | 'reading-insight',
  payload: unknown,
  mutationId: string,
): Promise<void> {
  const item: SyncQueueItem = {
    id: uuidv4(),
    type,
    payload,
    mutationId,
    createdAt: Date.now(),
    attempts: 0,
  };
  await addToSyncQueue(item);
  void ensureDrain();
}

function ensureDrain(): Promise<void> {
  if (drainPromise) return drainPromise;
  drainPromise = attemptSync().finally(() => {
    drainPromise = null;
  });
  return drainPromise;
}

async function attemptSync(): Promise<void> {
  if (!navigator.onLine) return;

  const snapshot = await getSyncQueue();
  if (!snapshot || snapshot.length === 0) return;

  // Sort once by creation time; drain FIFO.
  const sorted = [...snapshot].sort((a, b) => a.createdAt - b.createdAt);
  const processed = new Set<string>();

  for (const item of sorted) {
    if (!navigator.onLine) return;
    if (processed.has(item.id)) continue;

    const traceId = createTraceId();
    const spanId = createSpanId();

    if (item.attempts >= MAX_RETRY_ATTEMPTS) {
      await removeSyncQueueItem(item.id);
      processed.add(item.id);
      logClientEvent({
        level: 'warn',
        traceId,
        spanId,
        event: 'sync.item.exceeded_max_retries',
        metadata: { itemId: item.id, type: item.type, attempts: item.attempts },
      });
      continue;
    }

    const result = await syncItem(item, traceId, spanId);

    if (result.success) {
      await removeSyncQueueItem(item.id);
      processed.add(item.id);
      await markAsSynced(item.type, item.mutationId);
      // Clear any pending conflicts for this entity after successful sync
      if (item.type === 'progress') {
        const payload = item.payload as { bookId?: string };
        if (payload?.bookId) {
          const pendingBefore = getPendingConflicts(payload.bookId).length;
          clearResolvedConflicts(payload.bookId);
          const pendingAfter = getPendingConflicts(payload.bookId).length;
          if (pendingBefore !== pendingAfter) {
            logClientEvent({
              level: 'info',
              traceId,
              spanId,
              event: 'sync.conflicts_cleared',
              metadata: {
                itemId: item.id,
                bookId: payload.bookId,
                cleared: pendingBefore - pendingAfter,
              },
            });
          }
        }
      }
      logClientEvent({
        level: 'info',
        traceId,
        spanId,
        event: 'sync.item.success',
        metadata: { itemId: item.id, type: item.type },
      });
    } else if (result.error === 'permission_revoked') {
      logClientEvent({
        level: 'error',
        traceId,
        spanId,
        event: 'sync.permission_revoked',
        metadata: { itemId: item.id, type: item.type },
      });
      await clearAllPermissions();

      if (onPermissionRevoked) {
        const payload = item.payload as { bookId?: string };
        if (payload?.bookId) {
          onPermissionRevoked(payload.bookId);
        }
      }

      await removeSyncQueueItem(item.id);
      processed.add(item.id);
    } else if (result.error === 'conflict_requires_manual_resolution') {
      // Conflict cannot be auto-resolved — remove from queue to prevent infinite retries
      logClientEvent({
        level: 'warn',
        traceId,
        spanId,
        event: 'sync.conflict_manual_required',
        metadata: { itemId: item.id, type: item.type },
      });
      await removeSyncQueueItem(item.id);
      processed.add(item.id);
    } else {
      item.attempts++;
      item.lastAttempt = Date.now();
      item.error = result.error;
      await updateSyncQueueItem(item);

      logClientEvent({
        level: 'warn',
        traceId,
        spanId,
        event: 'sync.item.retry_scheduled',
        metadata: {
          itemId: item.id,
          type: item.type,
          attempt: item.attempts,
          error: result.error,
        },
      });

      const delay = calculateDelay(item.attempts);
      cancelPendingRetry();
      retryTimeoutId = setTimeout(() => {
        retryTimeoutId = null;
        void ensureDrain();
      }, delay);
      return;
    }
  }
}

async function syncItem(item: SyncQueueItem, traceId: string, spanId: string): Promise<SyncResult> {
  try {
    if (item.type === 'progress') {
      const payload = item.payload as {
        bookId: string;
        cfi: string;
        percentage: number;
        mutationId: string;
      };
      await api.put(`/api/books/${payload.bookId}/progress`, {
        locator: {
          cfi: payload.cfi,
        },
        progressPercent: payload.percentage,
        mutationId: payload.mutationId,
      });
    } else if (item.type === 'annotation') {
      const payload = item.payload as {
        bookId: string;
        annotation: Omit<AnnotationEntry, 'synced' | 'mutationId'> & { id?: string; status?: string };
        action?: string;
      };

      if (payload.action === 'resolve') {
        await apiRequest(`/api/comments/${payload.annotation.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: payload.annotation.status }),
        });
      } else if (payload.annotation.type === 'highlight') {
        await api.post(`/api/books/${payload.bookId}/highlights`, {
          locator: {
            cfi: payload.annotation.cfi,
            selectedText: payload.annotation.text ?? '',
            chapterRef: payload.annotation.chapter ?? '',
          },
          color: payload.annotation.color ?? '#ffff00',
          note: payload.annotation.comment ?? '',
        });
      } else if (payload.annotation.type === 'bookmark') {
        await api.post(`/api/books/${payload.bookId}/bookmarks`, {
          locator: {
            cfi: payload.annotation.cfi,
            selectedText: payload.annotation.text ?? payload.annotation.cfi,
            chapterRef: payload.annotation.chapter ?? '',
          },
          label: payload.annotation.text ?? '',
        });
      } else {
        await api.post(`/api/books/${payload.bookId}/comments`, {
          locator: {
            cfi: payload.annotation.cfi,
            selectedText: payload.annotation.text ?? '',
            chapterRef: payload.annotation.chapter ?? '',
          },
          body: payload.annotation.comment ?? '',
          visibility: 'shared' as const,
        });
      }
    } else if (item.type === 'reading-insight') {
      const payload = item.payload as {
        bookId: string;
        buckets: { date: string; activeMinutes: number; activePages: number }[];
        mutationId: string;
      };
      await api.post(`/api/books/${payload.bookId}/insights/sync`, {
        bookId: payload.bookId,
        buckets: payload.buckets,
        mutationId: payload.mutationId,
      });
    }
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown sync error';
    const status = (error as { status?: number }).status;

    // Check for permission revocation (401/403)
    if (status === 401 || status === 403) {
      logClientEvent({
        level: 'error',
        traceId,
        spanId,
        event: 'sync.item.auth_error',
        metadata: { itemId: item.id, type: item.type, status },
        error: { name: 'AuthError', message },
      });
      return { success: false, error: 'permission_revoked' };
    }

    // Check for specific error messages (fallback when status is unavailable).
    // Server revocations always return 401/403 — handled above — so do NOT treat a
    // generic "permission" substring as revocation (would spuriously clear the
    // local permission cache). Only an explicit revoked mention maps to the
    // permission_revoked outcome.
    if (message.includes('revoked')) {
      return { success: false, error: 'permission_revoked' };
    }

    // Check for conflict (409) — only for progress type
    if (status === 409 && item.type === 'progress') {
      const payload = item.payload as {
        bookId: string;
        cfi: string;
        percentage: number;
        mutationId: string;
      };

      // We don't have the remote version from a 409. Use equal timestamps
      // to force the manual resolution path — the user must decide which
      // version to keep since we can't determine the remote state.
      const resolution = resolveConflict(
        ConflictType.ProgressUpdate,
        item.payload,
        item.payload,
        item.createdAt,
        item.createdAt,
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
        },
      });

      if (resolution.resolved && resolution.winner === 'local') {
        // Local wins LWW — sync is successful, no need to re-send
        return { success: true };
      }

      // Remote wins or manual resolution needed — cannot auto-resolve without remote version
      return { success: false, error: 'conflict_requires_manual_resolution' };
    }

    logClientEvent({
      level: 'error',
      traceId,
      spanId,
      event: 'sync.item.failed',
      metadata: { itemId: item.id, type: item.type },
      error: { name: error instanceof Error ? error.name : 'Error', message },
    });

    return { success: false, error: message };
  }
}

async function markAsSynced(type: 'progress' | 'annotation' | 'reading-insight', mutationId: string): Promise<void> {
  if (type === 'progress') {
    const unsynced = await getUnsyncedProgress();
    const entry = unsynced.find((e) => e.mutationId === mutationId);
    if (entry) {
      await saveProgress({ ...entry, synced: true });
    }
  } else if (type === 'annotation') {
    const unsynced = await getUnsyncedAnnotations();
    const entry = unsynced.find((e) => e.mutationId === mutationId);
    if (entry) {
      await saveAnnotation({ ...entry, synced: true });
    }
  }
  // 'reading-insight' items are server-side only; the local IndexedDB
  // store is the source of truth and the server sync is append-only (UPSERT).
  // No local mark-as-synced is needed — the queue item itself is removed
  // on success, and the local insight entry persists for the InfoPanel.
}

export async function syncAll(): Promise<void> {
  if (!navigator.onLine) return;
  await ensureDrain();
}

export function setupOnlineListener(): () => void {
  const handler = () => {
    if (navigator.onLine) {
      void ensureDrain();
    }
  };

  window.addEventListener('online', handler);
  window.addEventListener('offline', handler);

  return () => {
    window.removeEventListener('online', handler);
    window.removeEventListener('offline', handler);
    // Also cancel any pending retry to avoid leaks when the listener is torn down
    cancelPendingRetry();
  };
}

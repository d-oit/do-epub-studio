import { v4 as uuidv4 } from 'uuid';
import {
  addToSyncQueue,
  getSyncQueue,
  removeSyncQueueItem,
  updateSyncQueueItem,
  getUnsyncedProgress,
  getUnsyncedAnnotations,
  type SyncQueueItem,
} from './db';
import { api } from '../api';
import type { AnnotationEntry } from './db';
import { clearAllPermissions } from './permissions';
import { createTraceId, createSpanId, logClientEvent } from '../telemetry';

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

export function generateMutationId(): string {
  return uuidv4();
}

function calculateDelay(attempt: number): number {
  const delay = BASE_DELAY_MS * Math.pow(2, attempt);
  return Math.min(delay, MAX_DELAY_MS);
}

export async function queueSync(
  type: 'progress' | 'annotation',
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
  void attemptSync();
}

async function attemptSync(): Promise<void> {
  if (!navigator.onLine) return;

  const queue = await getSyncQueue();
  if (!queue || queue.length === 0) return;

  const item = queue.sort((a, b) => a.createdAt - b.createdAt)[0];

  const traceId = createTraceId();
  const spanId = createSpanId();

  if (item.attempts >= MAX_RETRY_ATTEMPTS) {
    await removeSyncQueueItem(item.id);
    logClientEvent({
      level: 'warn',
      traceId,
      spanId,
      event: 'sync.item.exceeded_max_retries',
      metadata: { itemId: item.id, type: item.type, attempts: item.attempts },
    });
    return;
  }

  const result = await syncItem(item, traceId, spanId);

  if (result.success) {
    await removeSyncQueueItem(item.id);
    await markAsSynced(item.type, item.mutationId);
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

    // Notify UI about permission revocation
    if (onPermissionRevoked) {
      const payload = item.payload as { bookId?: string };
      if (payload?.bookId) {
        onPermissionRevoked(payload.bookId);
      }
    }

    // Remove the failing item so the queue doesn't stall
    await removeSyncQueueItem(item.id);
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
    // Clear any previously scheduled retry before scheduling a new one
    // to prevent multiple concurrent retry chains (memory leak fix).
    cancelPendingRetry();
    retryTimeoutId = setTimeout(() => {
      retryTimeoutId = null;
      void attemptSync();
    }, delay);
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
      await api.post(`/api/books/${payload.bookId}/progress`, {
        bookId: payload.bookId,
        locator: {
          cfi: payload.cfi,
          selectedText: '',
        },
        progressPercent: payload.percentage,
        mutationId: payload.mutationId,
      });
    } else if (item.type === 'annotation') {
      const payload = item.payload as {
        bookId: string;
        annotation: Omit<AnnotationEntry, 'synced' | 'mutationId'>;
      };

      if (payload.annotation.type === 'highlight') {
        await api.post(`/api/books/${payload.bookId}/highlights`, {
          chapterRef: payload.annotation.chapter,
          cfiRange: payload.annotation.cfi,
          selectedText: payload.annotation.text ?? '',
          color: payload.annotation.color ?? 'yellow',
          note: payload.annotation.comment ?? '',
          mutationId: item.mutationId,
        });
      } else {
        await api.post(`/api/books/${payload.bookId}/comments`, {
          chapterRef: payload.annotation.chapter,
          cfiRange: payload.annotation.cfi,
          selectedText: payload.annotation.text ?? '',
          body: payload.annotation.comment ?? '',
          visibility: 'shared' as const,
          mutationId: item.mutationId,
        });
      }
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

    // Check for specific error messages
    if (message.includes('revoked') || message.includes('permission')) {
      return { success: false, error: 'permission_revoked' };
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

async function markAsSynced(type: 'progress' | 'annotation', mutationId: string): Promise<void> {
  if (type === 'progress') {
    const unsynced = await getUnsyncedProgress();
    const entry = unsynced.find((e) => e.mutationId === mutationId);
    if (entry) {
      const { saveProgress } = await import('./db');
      await saveProgress({ ...entry, synced: true });
    }
  } else {
    const unsynced = await getUnsyncedAnnotations();
    const entry = unsynced.find((e) => e.mutationId === mutationId);
    if (entry) {
      const { saveAnnotation } = await import('./db');
      await saveAnnotation({ ...entry, synced: true });
    }
  }
}

export async function syncAll(): Promise<void> {
  if (!navigator.onLine) return;
  await attemptSync();
}

export function setupOnlineListener(): () => void {
  const handler = () => {
    if (navigator.onLine) {
      void attemptSync();
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

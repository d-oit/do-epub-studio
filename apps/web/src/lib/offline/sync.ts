import { v4 as uuidv4 } from 'uuid';
import {
  addToSyncQueue,
  getSyncQueue,
  removeSyncQueueItem,
  updateSyncQueueItem,
  type SyncQueueItem,
  type AnnotationEntry,
} from './db';
import { settleAnnotationCreation, failAnnotationCreation } from './annotation-mutations';
import { syncItem, markAsSynced, type FeedbackSyncPayload } from './sync-item';
import { useAuthStore } from '../../stores/auth';
import { useReaderStore } from '../../stores/reader';
import { markFeedbackDraft } from './feedback-drafts';
import { clearAllPermissions } from './permissions';
import { createTraceId, createSpanId } from '@do-epub-studio/shared';
import { logClientEvent } from '../client-logger';
import { ConflictType, clearResolvedConflicts, type ConflictRecord } from './conflict-resolution';
import type { ProgressSyncPayload } from './progress-conflict';

const MAX_RETRY_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;
let onPermissionRevoked: ((bookId: string) => void) | null = null;
let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
let drainPromise: Promise<void> | null = null;

export function setPermissionRevokedCallback(callback: (bookId: string) => void): void {
  onPermissionRevoked = callback;
}

export function cancelPendingRetry(): void {
  if (retryTimeoutId !== null) {
    clearTimeout(retryTimeoutId);
    retryTimeoutId = null;
  }
}

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
  type: 'progress' | 'annotation' | 'reading-insight' | 'feedback',
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

export async function queueFeedbackSubmission(payload: FeedbackSyncPayload): Promise<void> {
  await queueSync('feedback', payload, payload.mutationId);
}

function ensureDrain(): Promise<void> {
  if (drainPromise) return drainPromise;
  drainPromise = attemptSync().finally(() => {
    drainPromise = null;
  });
  return drainPromise;
}

export async function syncAll(): Promise<void> {
  await ensureDrain();
}

function isCurrentSyncSession(sessionToken: string | null, bookId: string | null): boolean {
  const current = useAuthStore.getState();
  return current.sessionToken === sessionToken && current.bookId === bookId;
}

async function attemptSync(): Promise<void> {
  if (!navigator.onLine) return;

  const { sessionToken: capturedToken, bookId: capturedBookId } = useAuthStore.getState();
  const snapshot = await getSyncQueue();
  if (!isCurrentSyncSession(capturedToken, capturedBookId)) return;
  if (!snapshot || snapshot.length === 0) return;

  const sorted = [...snapshot].sort((a, b) => a.createdAt - b.createdAt);
  const processed = new Set<string>();

  for (const item of sorted) {
    if (!navigator.onLine) return;
    if (!isCurrentSyncSession(capturedToken, capturedBookId)) return;
    if (processed.has(item.id)) continue;

    const isAnnotationCreation =
      item.type === 'annotation' &&
      item.payload &&
      typeof item.payload === 'object' &&
      (('action' in item.payload && (item.payload as { action?: string }).action === 'create') ||
        !('action' in item.payload));

    if (item.attempts >= MAX_RETRY_ATTEMPTS) {
      if (isAnnotationCreation && capturedToken) {
        if (capturedToken === useAuthStore.getState().sessionToken) {
          await failAnnotationCreation(item, item.error ?? 'Sync failed', capturedToken);
          processed.add(item.id);
          const readerState = useReaderStore.getState();
          if (capturedBookId && readerState.currentChapter !== null) {
            const localId = `local-annotation-${item.mutationId}`;
            readerState.updateHighlight(localId, {
              syncState: 'failed',
              syncError: item.error ?? 'Sync failed',
            });
            readerState.updateComment(localId, {
              syncState: 'failed',
              syncError: item.error ?? 'Sync failed',
            });
          }
        }
      } else {
        await removeSyncQueueItem(item.id);
        processed.add(item.id);
      }
      logClientEvent({
        level: 'warn',
        traceId: createTraceId(),
        spanId: createSpanId(),
        event: 'sync.item.exceeded_max_retries',
        metadata: { itemId: item.id, type: item.type, attempts: item.attempts },
      });
      continue;
    }

    const traceId = createTraceId();
    const spanId = createSpanId();

    const result = await syncItem(item, traceId, spanId);
    if (!isCurrentSyncSession(capturedToken, capturedBookId)) return;

    if (result.success) {
      if (isAnnotationCreation && result.annotation && capturedToken) {
        if (capturedToken !== useAuthStore.getState().sessionToken) {
          return;
        }

        const res = result.annotation;
        let canonicalEntry: AnnotationEntry;
        if (res.type === 'highlight') {
          const hl = res.item;
          canonicalEntry = {
            id: hl.id,
            bookId: capturedBookId ?? '',
            type: 'highlight',
            cfi: hl.cfiRange ?? '',
            text: hl.selectedText,
            chapter: hl.chapterRef ?? undefined,
            color: hl.color,
            createdAt: new Date(hl.createdAt).getTime(),
            updatedAt: new Date(hl.updatedAt).getTime(),
            synced: true,
            mutationId: item.mutationId,
          };
        } else {
          const cm = res.item;
          canonicalEntry = {
            id: cm.id,
            bookId: capturedBookId ?? '',
            type: 'comment',
            cfi: cm.cfiRange ?? '',
            text: cm.selectedText ?? undefined,
            comment: cm.body,
            chapter: cm.chapterRef ?? undefined,
            displayName: cm.displayName,
            status: cm.status === 'deleted' ? 'open' : cm.status,
            visibility: cm.visibility,
            createdAt: new Date(cm.createdAt).getTime(),
            updatedAt: new Date(cm.updatedAt).getTime(),
            synced: true,
            mutationId: item.mutationId,
          };
        }

        await settleAnnotationCreation(item, canonicalEntry, capturedToken);
        processed.add(item.id);

        if (
          capturedToken === useAuthStore.getState().sessionToken &&
          capturedBookId === useAuthStore.getState().bookId
        ) {
          const reader = useReaderStore.getState();
          const localId = `local-annotation-${item.mutationId}`;
          if (res.type === 'highlight') {
            reader.removeHighlight(localId);
            reader.addHighlight(res.item);
          } else {
            reader.updateComment(localId, { ...res.item });
          }
        }
      } else {
        await removeSyncQueueItem(item.id);
        processed.add(item.id);
        await markAsSynced(item.type, item.mutationId);
      }

      if (item.type === 'progress') {
        const payload = item.payload as { bookId?: string };
        if (payload?.bookId) {
          clearResolvedConflicts(payload.bookId);
        }
      }

      logClientEvent({
        level: 'info',
        traceId,
        spanId,
        event: 'sync.item.success',
        metadata: { itemId: item.id, type: item.type },
      });
    } else if (result.error === 'annotation_blocked') {
      if (capturedToken) {
        if (capturedToken !== useAuthStore.getState().sessionToken) {
          return;
        }
        const errorDetail = result.detail ?? 'Access denied';
        await failAnnotationCreation(item, errorDetail, capturedToken);
        processed.add(item.id);

        if (
          capturedToken === useAuthStore.getState().sessionToken &&
          capturedBookId === useAuthStore.getState().bookId
        ) {
          const reader = useReaderStore.getState();
          const localId = `local-annotation-${item.mutationId}`;
          reader.updateHighlight(localId, { syncState: 'failed', syncError: errorDetail });
          reader.updateComment(localId, { syncState: 'failed', syncError: errorDetail });
        }
      } else {
        await removeSyncQueueItem(item.id);
        processed.add(item.id);
      }
      logClientEvent({
        level: 'warn',
        traceId,
        spanId,
        event: 'sync.annotation_blocked',
        metadata: { itemId: item.id, type: item.type },
      });
    } else if (result.error === 'feedback_blocked') {
      const payload = item.payload as { draftId?: string; bookId?: string };
      if (payload?.draftId) {
        await markFeedbackDraft(payload.draftId, 'blocked', result.detail);
      }
      logClientEvent({
        level: 'warn',
        traceId,
        spanId,
        event: 'sync.feedback_blocked',
        metadata: { itemId: item.id, type: item.type },
      });
      await removeSyncQueueItem(item.id);
      processed.add(item.id);
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
      return;
    } else if (result.error === 'conflict_remote_unavailable') {
      logClientEvent({
        level: 'warn',
        traceId,
        spanId,
        event: 'sync.conflict_remote_unavailable',
        metadata: { itemId: item.id, type: item.type },
      });
      processed.add(item.id);
    } else if (result.error === 'conflict_requires_manual_resolution') {
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
      if (capturedToken && capturedToken !== useAuthStore.getState().sessionToken) {
        return;
      }

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
export async function resendProgressFromConflict(conflict: ConflictRecord): Promise<void> {
  if (conflict.type !== ConflictType.ProgressUpdate) return;

  const local = conflict.localVersion as Partial<ProgressSyncPayload> | null;
  const mutationId = typeof local?.mutationId === 'string' ? local.mutationId : '';
  if (
    !local ||
    mutationId === '' ||
    typeof local.bookId !== 'string' ||
    typeof local.cfi !== 'string' ||
    typeof local.percentage !== 'number'
  ) {
    logClientEvent({
      level: 'warn',
      traceId: createTraceId(),
      spanId: createSpanId(),
      event: 'sync.conflict_resend.skipped_malformed',
      metadata: { conflictId: conflict.id, type: conflict.type },
    });
    return;
  }

  await queueSync(
    'progress',
    {
      bookId: local.bookId,
      cfi: local.cfi,
      percentage: local.percentage,
      mutationId,
    },
    mutationId,
  );
}

export function setupOnlineListener(): () => void {
  const handler = () => {
    if (navigator.onLine) {
      void ensureDrain();
    }
  };

  const swMessageHandler = (event: MessageEvent<{ type?: unknown }>) => {
    const data: unknown = event.data;
    if (
      typeof data === 'object' &&
      data !== null &&
      'type' in data &&
      data.type === 'SYNC_REQUESTED'
    ) {
      if (navigator.onLine) {
        void ensureDrain();
      }
    }
  };

  window.addEventListener('online', handler);
  window.addEventListener('offline', handler);

  const sw =
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator
      ? navigator.serviceWorker
      : null;
  if (sw && typeof sw.addEventListener === 'function') {
    sw.addEventListener('message', swMessageHandler);
  }

  return () => {
    window.removeEventListener('online', handler);
    window.removeEventListener('offline', handler);
    if (sw && typeof sw.removeEventListener === 'function') {
      sw.removeEventListener('message', swMessageHandler);
    }
    cancelPendingRetry();
  };
}

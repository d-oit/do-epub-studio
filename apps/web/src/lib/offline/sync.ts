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

const MAX_RETRY_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

interface SyncResult {
  success: boolean;
  error?: string;
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
  if (queue.length === 0) return;

  const item = queue.sort((a, b) => a.createdAt - b.createdAt)[0];

  if (item.attempts >= MAX_RETRY_ATTEMPTS) {
    await removeSyncQueueItem(item.id);
    return;
  }

  const result = await syncItem(item);

  if (result.success) {
    await removeSyncQueueItem(item.id);
    await markAsSynced(item.type, item.mutationId);
  } else {
    item.attempts++;
    item.lastAttempt = Date.now();
    item.error = result.error;
    await updateSyncQueueItem(item);

    const delay = calculateDelay(item.attempts);
    setTimeout(() => void attemptSync(), delay);
  }
}

async function syncItem(item: SyncQueueItem): Promise<SyncResult> {
  try {
    if (item.type === 'progress') {
      const payload = item.payload as {
        bookId: string;
        cfi: string;
        percentage: number;
        mutationId: string;
      };
      await api.post('/api/reader-state/progress', {
        bookId: payload.bookId,
        cfi: payload.cfi,
        percentage: payload.percentage,
        mutationId: payload.mutationId,
      });
    } else if (item.type === 'annotation') {
      const payload = item.payload as {
        bookId: string;
        annotation: Omit<AnnotationEntry, 'synced' | 'mutationId'>;
      };
      await api.post('/api/comments', {
        bookId: payload.bookId,
        cfi: payload.annotation.cfi,
        endCfi: payload.annotation.endCfi,
        text: payload.annotation.text,
        comment: payload.annotation.comment,
        color: payload.annotation.color,
        mutationId: item.mutationId,
      });
    }
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown sync error';
    if (message.includes('revoked') || message.includes('401') || message.includes('403')) {
      return { success: false, error: 'permission_revoked' };
    }
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
  };
}

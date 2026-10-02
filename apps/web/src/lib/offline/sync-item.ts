import { api } from '../api';
import { useAuthStore } from '@/stores/auth';
import { createFeedback } from '../api/feedback';
import type { FeedbackKind, FeedbackCategory, FeedbackAnchor } from '../api/feedback';
import type { SyncQueueItem } from './db';
import { saveProgress, getUnsyncedProgress } from './db';
import { deleteFeedbackDraftByMutation } from './feedback-drafts';
import { saveAnnotation, getUnsyncedAnnotations } from './annotation-mutations';
import { syncProgress, handleProgressConflict, type SyncResult } from './progress-conflict';
import { syncAnnotation, type AnnotationCreateResult } from './annotation-sync';
import { logClientEvent } from '../client-logger';

export interface ReadingInsightSyncPayload {
  bookId: string;
  buckets: { date: string; activeMinutes: number; activePages: number }[];
  mutationId: string;
}

export async function syncReadingInsight(item: SyncQueueItem): Promise<void> {
  const payload = item.payload as ReadingInsightSyncPayload;
  await api.post(`/api/books/${payload.bookId}/insights/sync`, {
    bookId: payload.bookId,
    buckets: payload.buckets,
    mutationId: payload.mutationId,
  });
}

export interface FeedbackSyncPayload {
  bookId: string;
  draftId: string;
  kind: FeedbackKind;
  category: FeedbackCategory;
  body: string;
  proposedText?: string;
  anchor: FeedbackAnchor;
  mutationId: string;
}

export async function syncFeedback(item: SyncQueueItem): Promise<void> {
  const payload = item.payload as FeedbackSyncPayload;
  const token = useAuthStore.getState().sessionToken ?? '';
  await createFeedback(
    payload.bookId,
    {
      kind: payload.kind,
      category: payload.category,
      body: payload.body,
      proposedText: payload.proposedText,
      anchor: payload.anchor,
      mutationId: payload.mutationId,
    },
    token,
  );
}

export type ItemSyncResult = SyncResult & {
  annotation?: AnnotationCreateResult;
  detail?: string;
};

export async function syncItem(
  item: SyncQueueItem,
  traceId: string,
  spanId: string,
): Promise<ItemSyncResult> {
  try {
    let annotationResult: AnnotationCreateResult | undefined;
    if (item.type === 'progress') {
      await syncProgress(item);
    } else if (item.type === 'annotation') {
      annotationResult = await syncAnnotation(item);
    } else if (item.type === 'reading-insight') {
      await syncReadingInsight(item);
    } else if (item.type === 'feedback') {
      await syncFeedback(item);
    } else {
      const raw: unknown = item;
      const label =
        typeof raw === 'object' && raw !== null && 'type' in raw && typeof raw.type === 'string'
          ? raw.type
          : 'unknown';
      throw new Error(`Unrecognized sync queue item type: ${label}`);
    }
    return { success: true, annotation: annotationResult };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown sync error';
    const status = (error as { status?: number }).status;

    // Check if annotation creation is rejected authoritatively by the server
    const isAnnotationCreation =
      item.type === 'annotation' &&
      item.payload &&
      typeof item.payload === 'object' &&
      (('action' in item.payload && (item.payload as { action?: string }).action === 'create') ||
        !('action' in item.payload));

    if (
      isAnnotationCreation &&
      (status === 400 || status === 403 || status === 409 || status === 413 || status === 422)
    ) {
      return { success: false, error: 'annotation_blocked', detail: message };
    }

    if (
      item.type === 'feedback' &&
      (status === 400 || status === 403 || status === 409 || status === 413 || status === 422)
    ) {
      return { success: false, error: 'feedback_blocked', detail: message };
    }

    if (status === 401 || status === 403) {
      return { success: false, error: 'permission_revoked' };
    }

    if (message.includes('revoked')) {
      return { success: false, error: 'permission_revoked' };
    }

    if (status === 409 && item.type === 'progress') {
      return handleProgressConflict(item, traceId, spanId);
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

export async function markAsSynced(
  type: 'progress' | 'annotation' | 'reading-insight' | 'feedback',
  mutationId: string,
): Promise<void> {
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
  } else if (type === 'feedback') {
    await deleteFeedbackDraftByMutation(mutationId);
  }
}

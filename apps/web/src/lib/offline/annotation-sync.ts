import { api, apiRequest } from '../api';
import type { SyncQueueItem, AnnotationEntry } from './db';

/** Annotation payload synced from the offline queue. */
interface AnnotationSyncPayload {
  bookId: string;
  annotation: Omit<AnnotationEntry, 'synced' | 'mutationId'> & { id?: string; status?: string };
  action?: string;
}

async function syncAnnotationResolve(payload: AnnotationSyncPayload): Promise<void> {
  await apiRequest(`/api/comments/${payload.annotation.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: payload.annotation.status }),
  });
}

async function syncAnnotationHighlight(payload: AnnotationSyncPayload): Promise<void> {
  await api.post(`/api/books/${payload.bookId}/highlights`, {
    locator: {
      cfi: payload.annotation.cfi,
      selectedText: payload.annotation.text ?? '',
      chapterRef: payload.annotation.chapter ?? '',
    },
    color: payload.annotation.color ?? '#ffff00',
    note: payload.annotation.comment ?? '',
  });
}

async function syncAnnotationBookmark(payload: AnnotationSyncPayload): Promise<void> {
  await api.post(`/api/books/${payload.bookId}/bookmarks`, {
    locator: {
      cfi: payload.annotation.cfi,
      selectedText: payload.annotation.text ?? payload.annotation.cfi,
      chapterRef: payload.annotation.chapter ?? '',
    },
    label: payload.annotation.text ?? '',
  });
}

async function syncAnnotationComment(payload: AnnotationSyncPayload): Promise<void> {
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

/** Dispatch one queued annotation write to its matching reader API endpoint. */
export async function syncAnnotation(item: SyncQueueItem): Promise<void> {
  const payload = item.payload as AnnotationSyncPayload;

  if (payload.action === 'resolve') {
    await syncAnnotationResolve(payload);
    return;
  }

  switch (payload.annotation.type) {
    case 'highlight':
      await syncAnnotationHighlight(payload);
      return;
    case 'bookmark':
      await syncAnnotationBookmark(payload);
      return;
    default:
      await syncAnnotationComment(payload);
  }
}

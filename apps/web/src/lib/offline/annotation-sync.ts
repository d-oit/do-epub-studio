import { apiRequest } from '../api';
import { createHighlight, createComment } from '../api/annotations';
import { useAuthStore } from '@/stores/auth';
import type { Highlight, Comment } from '@/stores/reader';
import type { SyncQueueItem, AnnotationEntry } from './db';

/** Annotation payload synced from the offline queue. */
interface AnnotationSyncPayload {
  bookId: string;
  annotation: Omit<AnnotationEntry, 'synced' | 'mutationId'> & { id?: string; status?: string };
  action?: string;
}

export type AnnotationCreateResult =
  { type: 'highlight'; item: Highlight } | { type: 'comment'; item: Comment };

async function syncAnnotationResolve(payload: AnnotationSyncPayload): Promise<void> {
  await apiRequest(`/api/comments/${payload.annotation.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: payload.annotation.status }),
  });
}

async function syncAnnotationHighlight(
  payload: AnnotationSyncPayload,
  mutationId: string,
  token: string,
): Promise<Highlight> {
  return createHighlight(
    payload.bookId,
    {
      mutationId,
      locator: {
        cfi: payload.annotation.cfi,
        selectedText: payload.annotation.text ?? '',
        chapterRef: payload.annotation.chapter ?? '',
      },
      color: payload.annotation.color ?? '#ffff00',
      note: payload.annotation.comment ?? '',
    },
    token,
  );
}

async function syncAnnotationBookmark(payload: AnnotationSyncPayload): Promise<void> {
  await apiRequest(`/api/books/${payload.bookId}/bookmarks`, {
    method: 'POST',
    body: JSON.stringify({
      locator: {
        cfi: payload.annotation.cfi,
        selectedText: payload.annotation.text ?? payload.annotation.cfi,
        chapterRef: payload.annotation.chapter ?? '',
      },
      label: payload.annotation.text ?? '',
    }),
  });
}

async function syncAnnotationComment(
  payload: AnnotationSyncPayload,
  mutationId: string,
  token: string,
): Promise<Comment> {
  return createComment(
    payload.bookId,
    {
      mutationId,
      locator: {
        cfi: payload.annotation.cfi,
        selectedText: payload.annotation.text ?? '',
        chapterRef: payload.annotation.chapter ?? '',
      },
      body: payload.annotation.comment ?? '',
      visibility: 'shared',
    },
    token,
  );
}

/** Dispatch one queued annotation write to its matching reader API endpoint. */
export async function syncAnnotation(
  item: SyncQueueItem,
): Promise<AnnotationCreateResult | undefined> {
  const payload = item.payload as AnnotationSyncPayload;

  if (payload.action === 'resolve') {
    await syncAnnotationResolve(payload);
    return undefined;
  }

  const token = useAuthStore.getState().sessionToken;
  if (!token) {
    const err = new Error('Session expired');
    (err as Error & { status?: number }).status = 401;
    throw err;
  }

  // Widened so the default branch can name the unrecognized value: the
  // exhaustive switch below already narrows it to `never` there.
  const annotationType: string = payload.annotation.type;
  switch (payload.annotation.type) {
    case 'highlight': {
      const hl = await syncAnnotationHighlight(payload, item.mutationId, token);
      return { type: 'highlight', item: hl };
    }
    case 'comment': {
      const cm = await syncAnnotationComment(payload, item.mutationId, token);
      return { type: 'comment', item: cm };
    }
    case 'bookmark':
      await syncAnnotationBookmark(payload);
      return undefined;
    default:
      throw new Error(`Unrecognized annotation type: ${annotationType}`);
  }
}

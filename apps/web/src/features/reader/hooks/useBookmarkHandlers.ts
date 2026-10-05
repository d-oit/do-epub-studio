import { useCallback } from 'react';
import { useReaderStore, useAuthStore } from '../../../stores';
import type { Bookmark } from '../../../stores';
import { apiRequest } from '../../../lib/api';
import { saveAnnotation, queueSync, generateMutationId, getDB } from '../../../lib/offline';
import { useOptimisticAnnotationStore } from './useOptimisticAnnotations';

interface TocItem {
  label: string;
  href: string;
}

interface UseBookmarkHandlersReturn {
  handleCreateBookmark: (
    currentChapterRef: React.MutableRefObject<string | null>,
    toc: TocItem[],
  ) => Promise<void>;
  handleDeleteBookmark: (bookmarkId: string) => void;
}

/**
 * Remove a persisted bookmark annotation from IndexedDB by id. Missing keys
 * are a no-op, so this is safe when the bookmark was never persisted locally
 * (for example an online create whose local write failed).
 */
async function deleteLocalBookmark(bookmarkId: string): Promise<void> {
  const db = await getDB();
  await db.delete('annotations', bookmarkId);
}

export function useBookmarkHandlers(): UseBookmarkHandlersReturn {
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const bookId = useAuthStore((state) => state.bookId);
  const addBookmark = useReaderStore((state) => state.addBookmark);
  const removeBookmark = useReaderStore((state) => state.removeBookmark);
  const { addOptimisticBookmark, removeOptimistic } = useOptimisticAnnotationStore();

  const handleCreateBookmark = useCallback(
    async (currentChapterRef: React.MutableRefObject<string | null>, toc: TocItem[]) => {
      if (!sessionToken || !bookId) return;

      const currentProgress = useReaderStore.getState().progress;
      if (!currentProgress?.locator?.cfi) return;

      const chapterName = currentChapterRef.current
        ? toc.find((item) => item.href === currentChapterRef.current)?.label || 'Unknown Chapter'
        : 'Unknown Chapter';

      const bookmark: Bookmark = {
        id: `bookmark-${Date.now()}`,
        locator: currentProgress.locator,
        label: chapterName,
        createdAt: new Date().toISOString(),
      };

      addOptimisticBookmark(bookmark);
      addBookmark(bookmark);

      if (navigator.onLine) {
        try {
          // `apiRequest` unwraps the `{ ok, data }` envelope, so the created
          // bookmark record is returned directly. Defensively fall back to the
          // optimistic id if the server omits one.
          const res = await apiRequest<{ id?: string }>(`/api/books/${bookId}/bookmarks`, {
            method: 'POST',
            body: JSON.stringify({
              locator: currentProgress.locator,
              label: chapterName,
            }),
            token: sessionToken,
          });

          const mutationId = generateMutationId();
          await saveAnnotation({
            id: res.id ?? bookmark.id,
            bookId,
            type: 'bookmark',
            cfi: currentProgress.locator.cfi,
            text: chapterName,
            chapter: currentChapterRef.current ?? undefined,
            createdAt: Date.now(),
            synced: true,
            mutationId,
          });
        } catch (err) {
          removeOptimistic(bookmark.id, 'bookmark');
          removeBookmark(bookmark.id);
          throw err;
        }
        return;
      }

      try {
        const mutationId = generateMutationId();
        await saveAnnotation({
          id: bookmark.id,
          bookId,
          type: 'bookmark',
          cfi: currentProgress.locator.cfi,
          text: chapterName,
          chapter: currentChapterRef.current ?? undefined,
          createdAt: Date.now(),
          synced: false,
          mutationId,
        });
        await queueSync(
          'annotation',
          {
            bookId,
            annotation: {
              type: 'bookmark',
              cfi: currentProgress.locator.cfi,
              chapter: currentChapterRef.current ?? undefined,
              text: chapterName,
            },
          },
          mutationId,
        );
      } catch (err) {
        removeOptimistic(bookmark.id, 'bookmark');
        throw err;
      }
    },
    [sessionToken, bookId, addBookmark, removeBookmark, addOptimisticBookmark, removeOptimistic],
  );

  const handleDeleteBookmark = useCallback(
    (bookmarkId: string) => {
      removeBookmark(bookmarkId);
      removeOptimistic(bookmarkId, 'bookmark');

      if (navigator.onLine && sessionToken && bookId) {
        void apiRequest(`/api/books/${bookId}/bookmarks/${bookmarkId}`, {
          method: 'DELETE',
          token: sessionToken,
        }).catch((err) => {
          console.error('Failed to delete bookmark on server', err);
        });
      }

      void deleteLocalBookmark(bookmarkId).catch((err) => {
        console.error('Failed to delete bookmark locally', err);
      });
    },
    [removeBookmark, removeOptimistic, sessionToken, bookId],
  );

  return {
    handleCreateBookmark,
    handleDeleteBookmark,
  };
}

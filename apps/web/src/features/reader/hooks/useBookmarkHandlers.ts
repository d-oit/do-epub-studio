import { useCallback } from 'react';
import { useReaderStore, useAuthStore } from '../../../stores';
import type { Bookmark } from '../../../stores';
import { saveAnnotation, queueSync, generateMutationId } from '../../../lib/offline';
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

      try {
        addBookmark(bookmark);

        if (!navigator.onLine) {
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
          await queueSync('annotation', { bookId, annotation: bookmark }, mutationId);
        }
      } catch (err) {
        removeOptimistic(bookmark.id, 'bookmark');
        throw err;
      }
    },
    [sessionToken, bookId, addBookmark, addOptimisticBookmark, removeOptimistic],
  );

  const handleDeleteBookmark = useCallback(
    (bookmarkId: string) => {
      removeBookmark(bookmarkId);
    },
    [removeBookmark],
  );

  return {
    handleCreateBookmark,
    handleDeleteBookmark,
  };
}

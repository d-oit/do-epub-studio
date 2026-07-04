import type { MutableRefObject } from 'react';
import { createSpanId, createTraceId } from '@do-epub-studio/shared/src/telemetry';
import { logClientEvent } from '../../../lib/client-logger';
import { apiRequest } from '../../../lib/api';
import { saveProgress, queueSync, generateMutationId } from '../../../lib/offline';
import type { useReaderStore } from '../../../stores';

/**
 * Handles the 'relocated' event: saves progress to API/offline queue.
 */
export function createRelocatedHandler(
  bookId: string,
  sessionToken: string,
  setProgress: ReturnType<typeof useReaderStore.getState>['setProgress'],
  setCurrentChapter: ReturnType<typeof useReaderStore.getState>['setCurrentChapter'],
  tocItems: { href: string }[],
  currentChapterRef: MutableRefObject<string | null>,
  onChapterChange: () => void,
  markPageRead: () => void,
) {
  return async (location: { start: { cfi: string; progress: number; href: string } }) => {
    const { cfi, progress: progressPercent, href } = location.start;
    setProgress({ locator: { cfi }, progressPercent, updatedAt: new Date().toISOString() });

    const tocItem = tocItems.find((item) => item.href === href);
    if (tocItem) {
      currentChapterRef.current = tocItem.href;
      setCurrentChapter(tocItem.href);
    }

    onChapterChange();
    markPageRead();

    const mutationId = generateMutationId();
    const queueOffline = async () => {
      await saveProgress({
        id: `${bookId}-progress`,
        bookId,
        cfi,
        percentage: progressPercent,
        lastRead: Date.now(),
        synced: false,
        mutationId,
      });
      await queueSync(
        'progress',
        { bookId, cfi, percentage: progressPercent, mutationId },
        mutationId,
      );
    };

    if (navigator.onLine) {
      try {
        await apiRequest(`/api/books/${bookId}/progress`, {
          method: 'PUT',
          token: sessionToken,
          body: JSON.stringify({ locator: { cfi }, progressPercent, mutationId }),
        });
      } catch (e) {
        const saveError = e instanceof Error ? e : new Error(String(e));
        logClientEvent({
          level: 'warn',
          event: 'reader.progress_save_online_failed',
          traceId: createTraceId(),
          spanId: createSpanId(),
          error: { name: saveError.name, message: saveError.message, stack: saveError.stack },
          metadata: { bookId },
        });
        await queueOffline();
      }
    } else {
      await queueOffline();
    }
  };
}

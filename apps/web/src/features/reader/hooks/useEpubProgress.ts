import type { Rendition } from '@intity/epub-js';
import type { MutableRefObject } from 'react';
import { createSpanId, createTraceId } from '@do-epub-studio/shared';
import { logClientEvent } from '../../../lib/client-logger';
import { apiRequest } from '../../../lib/api';
import { saveProgress, queueSync, getProgress, generateMutationId } from '../../../lib/offline';
import type { useReaderStore } from '../../../stores';

/**
 * Loads reading progress from API (or offline cache) and navigates to the saved location.
 */
export async function loadProgress(
  rendition: Rendition,
  bookId: string,
  sessionToken: string,
): Promise<void> {
  try {
    let cfi: string | undefined;

    if (navigator.onLine) {
      const progressData = await apiRequest<{ locator: { cfi?: string } | null; progressPercent: number }>(
        `/api/books/${bookId}/progress`,
        { method: 'GET', token: sessionToken },
      );
      cfi = progressData.locator?.cfi;
    } else {
      const cached = await getProgress(bookId);
      if (cached?.cfi) cfi = cached.cfi;
    }

    if (cfi) await rendition.display(cfi);
  } catch (e) {
    const apiError = e instanceof Error ? e : new Error(String(e));
    logClientEvent({
      level: 'warn',
      event: 'reader.progress_load_api_failed',
      traceId: createTraceId(),
      spanId: createSpanId(),
      error: { name: apiError.name, message: apiError.message, stack: apiError.stack },
      metadata: { bookId },
    });
    try {
      const cached = await getProgress(bookId);
      if (cached?.cfi) await rendition.display(cached.cfi);
    } catch (dbErr) {
      const cacheError = dbErr instanceof Error ? dbErr : new Error(String(dbErr));
      logClientEvent({
        level: 'warn',
        event: 'reader.progress_load_cache_failed',
        traceId: createTraceId(),
        spanId: createSpanId(),
        error: { name: cacheError.name, message: cacheError.message, stack: cacheError.stack },
        metadata: { bookId },
      });
    }
  }
}

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

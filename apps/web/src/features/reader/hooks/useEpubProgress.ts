import type { MutableRefObject } from 'react';
import { createSpanId, createTraceId } from '@do-epub-studio/shared';
import { logClientEvent } from '../../../lib/client-logger';
import { apiRequest } from '../../../lib/api';
import { saveProgress, queueSync, generateMutationId } from '../../../lib/offline';
import type { useReaderStore } from '../../../stores';

/** Milliseconds to coalesce online progress PUTs (GOAP-224 B6). */
export const PROGRESS_PUT_DEBOUNCE_MS = 500;

interface RelocatedLocation {
  start: { cfi: string; progress: number; href: string };
}

export interface RelocatedHandler {
  /** Handle a single 'relocated' event (instant local state + scheduled save). */
  onRelocated: (location: RelocatedLocation) => Promise<void>;
  /** Flush any coalesced-but-unsent progress save immediately (unmount/close). */
  flush: () => Promise<void>;
}

/**
 * Handles the 'relocated' event: updates local progress state immediately and
 * persists it to the API (online) or the offline sync queue (offline).
 *
 * Online saves are debounced (GOAP-224 B6): page flips can fire many
 * 'relocated' events per second, so only the latest position within
 * `PROGRESS_PUT_DEBOUNCE_MS` is pushed — callers MUST invoke `flush()` on
 * unmount/reader-close so the final position is not lost. The offline path is
 * persisted immediately instead (it is the durability net for offline reading,
 * so it must not delay on the debounce window).
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
): RelocatedHandler {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { cfi: string; progressPercent: number } | null = null;

  const persist = async (payload: { cfi: string; progressPercent: number }): Promise<void> => {
    const { cfi, progressPercent } = payload;
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

  const clearTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const flush = async (): Promise<void> => {
    clearTimer();
    if (pending) {
      const payload = pending;
      pending = null;
      await persist(payload);
    }
  };

  const onRelocated = async (location: RelocatedLocation): Promise<void> => {
    const { cfi, progress: progressPercent, href } = location.start;
    setProgress({ locator: { cfi }, progressPercent, updatedAt: new Date().toISOString() });

    const tocItem = tocItems.find((item) => item.href === href);
    if (tocItem) {
      currentChapterRef.current = tocItem.href;
      setCurrentChapter(tocItem.href);
    }

    onChapterChange();
    markPageRead();

    pending = { cfi, progressPercent };

    if (!navigator.onLine) {
      // Offline: persist immediately — losing the latest position while
      // offline-reading would defeat the purpose of the offline queue.
      clearTimer();
      const payload = pending;
      pending = null;
      await persist(payload);
      return;
    }

    // Online: coalesce PUTs. Every call updates `pending` (latest wins), then
    // restarts the window; when it elapses, exactly one PUT fires with the
    // newest position. `void` — persistence errors are handled inside persist.
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      if (pending) {
        const payload = pending;
        pending = null;
        void persist(payload);
      }
    }, PROGRESS_PUT_DEBOUNCE_MS);
  };

  return { onRelocated, flush };
}

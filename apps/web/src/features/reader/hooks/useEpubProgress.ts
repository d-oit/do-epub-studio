import type { MutableRefObject } from 'react';
import { createSpanId, createTraceId } from '@do-epub-studio/shared';
import { logClientEvent } from '../../../lib/client-logger';
import { apiRequest } from '../../../lib/api';
import { getProgress, saveProgress, queueSync, generateMutationId } from '../../../lib/offline';
import type {
  ProgressSyncPayload,
  ProgressSyncResult,
} from '../../../lib/offline/progress-conflict';
import { useAuthStore, useReaderStore } from '../../../stores';

/** Milliseconds to coalesce online progress PUTs (GOAP-224 B6). */
export const PROGRESS_PUT_DEBOUNCE_MS = 500;
interface RelocatedLocation {
  // Matches the real epub.js relocated payload: `percentage` is a 0–1
  // fraction, present only after book.locations is generated (which this app
  // does not do). There is no `progress` field — reading one yields
  // undefined, which previously poisoned the store (NaN bar) and dropped
  // progressPercent from PUT bodies (server 400s).
  start: { cfi: string; href: string; percentage?: number };
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

  /**
   * Whether the session that opened the book is still the current one.
   *
   * The handler captures the session token at creation; a progress write may
   * only happen while that exact session is current. A cleared session
   * (sign-out, expiry) and a replaced one (a new sign-in) are both "not
   * ours" — in the replaced case the local store is about to be written
   * under a different session's encryption key.
   */
  const ownsSession = (): boolean => useAuthStore.getState().sessionToken === sessionToken;

  /**
   * Whether a write failure is the expected ownership-loss refusal.
   *
   * The commit-boundary fence rejects a write whose owning session ended
   * mid-write with a 401 (`assertSessionToken` in `lib/offline/db.ts`). That
   * is a normal outcome of a sign-out racing a save, not a storage failure.
   * The 401 status is the discriminator — a message string would be a
   * fragile contract, and a genuine storage error (quota, broken
   * IndexedDB) carries no 401 and must keep propagating.
   */
  const isOwnershipLoss = (error: unknown): boolean =>
    (error as { status?: number } | null)?.status === 401;

  let writeChain: Promise<void> = Promise.resolve();
  const persist = (payload: { cfi: string; progressPercent: number }): Promise<void> => {
    const pendingSave = writeChain.then(async () => {
      // A progress write belongs to the session that opened the book. Once
      // that session is gone (sign-out, expiry) or replaced (a new sign-in),
      // the local store has been purged and the write would either be
      // refused by the commit-boundary fence — or worse, be encrypted under
      // the *replacement* session's key, mixing two sessions in one store.
      // Skipping the write keeps the rejection off the unhandled-rejection
      // path: `flush()` and the debounce timer discard this promise.
      if (!ownsSession()) {
        logClientEvent({
          level: 'info',
          traceId: createTraceId(),
          spanId: createSpanId(),
          event: 'reader.progress_save_skipped_session_changed',
          metadata: { bookId },
        });
        return;
      }
      const { cfi, progressPercent } = payload;
      const mutationId = generateMutationId();
      let storedProgress;
      try {
        storedProgress = await getProgress(bookId);
      } catch (error) {
        const readError = error instanceof Error ? error : new Error(String(error));
        logClientEvent({
          level: 'warn',
          event: 'reader.progress_local_read_failed',
          traceId: createTraceId(),
          spanId: createSpanId(),
          error: { name: readError.name, message: readError.message, stack: readError.stack },
          metadata: { bookId },
        });
      }

      const pendingProgress = storedProgress && !storedProgress.synced ? storedProgress : undefined;
      const baseRevision =
        pendingProgress?.baseRevision ?? useReaderStore.getState().progress.revision ?? 0;
      const dependsOnMutationId = pendingProgress?.mutationId;
      const queueOffline = async () => {
        const queuePayload: ProgressSyncPayload = {
          bookId,
          cfi,
          percentage: progressPercent,
          mutationId,
          baseRevision,
          ...(dependsOnMutationId ? { dependsOnMutationId } : {}),
        };
        // The ownership check comes BEFORE the write, not after it.
        // `saveProgress` captures the *current* session token for its
        // encryption key, so a write that runs after the session was
        // replaced would encrypt the previous session's progress under the
        // new session's key — two sessions in one store. Checking afterwards
        // would be too late: the write would already have happened.
        if (!ownsSession()) {
          logClientEvent({
            level: 'info',
            traceId: createTraceId(),
            spanId: createSpanId(),
            event: 'reader.progress_queue_skipped_session_changed',
            metadata: { bookId },
          });
          return;
        }
        try {
          await saveProgress({
            id: `${bookId}-progress`,
            bookId,
            cfi,
            percentage: progressPercent,
            lastRead: Date.now(),
            synced: false,
            mutationId,
            baseRevision,
          });
        } catch (error) {
          // The commit-boundary fence refuses a write whose owning session
          // ended mid-write ("Session expired"). That refusal is expected
          // here and must not escape: `flush()` and the debounce timer
          // discard this promise, so an escaping rejection becomes an
          // unhandled rejection in the page. A genuine storage failure
          // (a quota error, a broken IndexedDB) is a different thing and is
          // reported, not swallowed.
          if (!isOwnershipLoss(error)) throw error;
          logClientEvent({
            level: 'info',
            traceId: createTraceId(),
            spanId: createSpanId(),
            event: 'reader.progress_write_skipped_session_changed',
            metadata: { bookId },
          });
          return;
        }
        // And again AFTER the write. `saveProgress` awaits the encryption
        // before its IndexedDB transaction, so the session can be replaced
        // inside that await: the write then completes under the old
        // session, and `queueSync` — which captures the current token for
        // its own fence — would enqueue the old session's progress under the
        // replacement session. The enqueue must be skipped as well.
        if (!ownsSession()) {
          logClientEvent({
            level: 'info',
            traceId: createTraceId(),
            spanId: createSpanId(),
            event: 'reader.progress_enqueue_skipped_session_changed',
            metadata: { bookId },
          });
          return;
        }
        try {
          await queueSync('progress', queuePayload, mutationId);
        } catch (error) {
          // The enqueue is fenced the same way the write is: `addToSyncQueue`
          // re-checks the owning session after its own awaits and refuses
          // with the same 401 when the session ended in the meantime. That
          // refusal is expected and must not escape either.
          if (!isOwnershipLoss(error)) throw error;
          logClientEvent({
            level: 'info',
            traceId: createTraceId(),
            spanId: createSpanId(),
            event: 'reader.progress_enqueue_refused_session_changed',
            metadata: { bookId },
          });
        }
      };

      if (!navigator.onLine || pendingProgress) {
        await queueOffline();
        return;
      }

      try {
        const result = await apiRequest<ProgressSyncResult>(`/api/books/${bookId}/progress`, {
          method: 'PUT',
          token: sessionToken,
          body: JSON.stringify({
            locator: { cfi },
            progressPercent,
            mutationId,
            baseRevision,
          }),
        });
        const auth = useAuthStore.getState();
        if (
          Number.isSafeInteger(result.revision) &&
          auth.sessionToken === sessionToken &&
          auth.bookId === bookId
        ) {
          const currentProgress = useReaderStore.getState().progress;
          setProgress({
            ...currentProgress,
            revision: result.revision,
            updatedAt: result.updatedAt,
          });
        }
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
    });
    writeChain = pendingSave.catch(() => undefined);
    return pendingSave;
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
    const { cfi, href, percentage } = location.start;

    // Chapter tracking is independent of progress persistence and must run on
    // every relocation (TOC highlight, prefetch, reading timer).
    const tocItem = tocItems.find((item) => item.href === href);
    if (tocItem) {
      currentChapterRef.current = tocItem.href;
      setCurrentChapter(tocItem.href);
    }

    onChapterChange();
    markPageRead();

    // Until the initial progress load settles (server or offline), a
    // 'relocated' event is the programmatic first display of the book — not a
    // user move. Storing or persisting it would overwrite the stored last
    // position with the book's start (an offline reload then restored 0%
    // instead of the saved percentage).
    if (!useReaderStore.getState().progressRestored) return;

    // Store/server contract is 0–100; rendition fraction is 0–1. Without a
    // usable fraction, retain the current value instead of clobbering it.
    const currentProgress = useReaderStore.getState().progress;
    const current = currentProgress.progressPercent;
    const progressPercent =
      typeof percentage === 'number' && Number.isFinite(percentage) ? percentage * 100 : current;
    setProgress({
      ...currentProgress,
      locator: { cfi },
      progressPercent,
      updatedAt: new Date().toISOString(),
    });

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

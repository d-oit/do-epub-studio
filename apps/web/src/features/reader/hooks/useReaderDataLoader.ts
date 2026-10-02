import { useEffect, useRef } from 'react';
import { createSpanId, createTraceId } from '@do-epub-studio/shared';
import { apiRequest, fetchHighlights, fetchComments, fetchProgress } from '../../../lib/api/index';
import {
  logClientEvent,
  createPerformanceMark,
  measurePerformance,
} from '../../../lib/client-logger';
import { getProgress, getAnnotations, subscribeAnnotationChanges } from '../../../lib/offline';
import type { Highlight, Comment, Bookmark, ReadingProgress } from '../../../stores';
import { mapOfflineHighlight, mapOfflineComment, mapOfflineBookmark } from './mapOfflineAnnotation';

interface UseReaderDataLoaderOptions {
  sessionToken: string | null;
  bookId: string | null;
  setHighlights: (highlights: Highlight[]) => void;
  setComments: (comments: Comment[]) => void;
  setBookmarks: (bookmarks: Bookmark[]) => void;
  setProgress: (progress: ReadingProgress) => void;
}

export function useReaderDataLoader({
  sessionToken,
  bookId,
  setHighlights,
  setComments,
  setBookmarks,
  setProgress,
}: UseReaderDataLoaderOptions): void {
  const generationRef = useRef(0);

  useEffect(() => {
    if (!sessionToken || !bookId) return;

    // Narrowed once: the effect already returned without a session/book, and
    // TS cannot carry that guard into the nested async function.
    const currentBookId: string = bookId;
    const currentSessionToken: string = sessionToken;

    let isCancelled = false;

    async function loadData() {
      const currentGen = ++generationRef.current;
      let source: 'server' | 'offline' | 'default' = 'default';

      if (!navigator.onLine) {
        createPerformanceMark('rehydrate-offline-start');
        try {
          const [progressResult, annotationsResult] = await Promise.allSettled([
            getProgress(currentBookId),
            getAnnotations(currentBookId),
          ]);
          if (isCancelled || currentGen !== generationRef.current) return;

          const cachedProgress =
            progressResult.status === 'fulfilled' ? progressResult.value : null;
          const offlineAnnotations =
            annotationsResult.status === 'fulfilled' ? annotationsResult.value : [];

          if (cachedProgress) {
            setProgress({
              locator: { cfi: cachedProgress.cfi },
              progressPercent: cachedProgress.percentage,
              updatedAt: new Date(cachedProgress.lastRead).toISOString(),
            });
            source = 'offline';
          }

          const offlineHighlights = offlineAnnotations
            .filter((a) => a.type === 'highlight')
            .map(mapOfflineHighlight);
          const offlineComments = offlineAnnotations
            .filter((a) => a.type === 'comment')
            .map(mapOfflineComment);
          const offlineBookmarks = offlineAnnotations
            .filter((a) => a.type === 'bookmark')
            .map(mapOfflineBookmark);

          setHighlights(offlineHighlights);
          setComments(offlineComments);
          setBookmarks(offlineBookmarks);
          source = 'offline';
        } finally {
          createPerformanceMark('rehydrate-offline-end');
          const rehydrateMs = measurePerformance(
            'rehydrate-offline',
            'rehydrate-offline-start',
            'rehydrate-offline-end',
          );
          if (rehydrateMs !== undefined) {
            logClientEvent({
              level: 'info',
              traceId: createTraceId(),
              spanId: createSpanId(),
              event: 'rehydrate-offline',
              metadata: { durationMs: Math.round(rehydrateMs), bookId },
            });
          }
        }
        return;
      }

      // Online: read local annotations to merge pending/failed records
      const localAnnotationsPromise = getAnnotations(currentBookId);

      try {
        const [hl, cm, bm, pg, localAnnotations] = await Promise.all([
          fetchHighlights(currentBookId, currentSessionToken),
          fetchComments(currentBookId, currentSessionToken),
          apiRequest<Bookmark[]>(`/api/books/${currentBookId}/bookmarks`, {
            token: currentSessionToken,
          }),
          fetchProgress(currentBookId, currentSessionToken),
          localAnnotationsPromise.catch(() => []),
        ]);

        if (isCancelled || currentGen !== generationRef.current) return;

        // Unsynced/failed local highlights merged into server highlights
        const unsyncedLocalHighlights = localAnnotations
          .filter((a) => a.type === 'highlight' && !a.synced)
          .map(mapOfflineHighlight);

        // Server wins matching IDs; append unsynced/failed
        const mergedHighlights = [
          ...hl,
          ...unsyncedLocalHighlights.filter(
            (local) => !hl.some((server) => server.id === local.id),
          ),
        ];

        // Unsynced/failed local comments merged into server comments
        // If an unsynced local comment has a resolve mutation on an existing ID, keep local status
        const unsyncedLocalComments = localAnnotations
          .filter((a) => a.type === 'comment' && !a.synced)
          .map(mapOfflineComment);

        const mergedComments = cm.map((serverCm) => {
          const localMatch = unsyncedLocalComments.find((l) => l.id === serverCm.id);
          if (localMatch && localMatch.status) {
            return {
              ...serverCm,
              status: localMatch.status,
              resolvedAt: localMatch.resolvedAt ?? serverCm.resolvedAt,
              syncState: localMatch.syncState,
              syncError: localMatch.syncError,
            };
          }
          return serverCm;
        });

        // Add remaining local-only unsynced comments
        for (const localCm of unsyncedLocalComments) {
          if (!mergedComments.some((c) => c.id === localCm.id)) {
            mergedComments.push(localCm);
          }
        }

        setHighlights(mergedHighlights);
        setComments(mergedComments);
        setBookmarks(bm);
        setProgress(pg);
        source = 'server';
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        const status = (error as { status?: number }).status;

        logClientEvent({
          level: 'warn',
          event: 'reader.load_failed',
          traceId: createTraceId(),
          spanId: createSpanId(),
          error: { name: error.name, message: error.message, stack: error.stack },
          metadata: { bookId },
        });

        // On server 401/403 do not fall back to annotations as if access were valid
        if (status === 401 || status === 403) {
          return;
        }

        createPerformanceMark('rehydrate-offline-start');
        try {
          const [progressResult, annotationsResult] = await Promise.allSettled([
            getProgress(currentBookId),
            getAnnotations(currentBookId),
          ]);
          if (isCancelled || currentGen !== generationRef.current) return;

          const cachedProgress =
            progressResult.status === 'fulfilled' ? progressResult.value : null;
          const offlineAnnotations =
            annotationsResult.status === 'fulfilled' ? annotationsResult.value : [];

          if (cachedProgress) {
            setProgress({
              locator: { cfi: cachedProgress.cfi },
              progressPercent: cachedProgress.percentage,
              updatedAt: new Date(cachedProgress.lastRead).toISOString(),
            });
            source = 'offline';
          }

          if (offlineAnnotations.length > 0) {
            const offlineHighlights = offlineAnnotations
              .filter((a) => a.type === 'highlight')
              .map(mapOfflineHighlight);
            const offlineComments = offlineAnnotations
              .filter((a) => a.type === 'comment')
              .map(mapOfflineComment);
            const offlineBookmarks = offlineAnnotations
              .filter((a) => a.type === 'bookmark')
              .map(mapOfflineBookmark);

            setHighlights(offlineHighlights);
            setComments(offlineComments);
            setBookmarks(offlineBookmarks);
            if (source === 'default') source = 'offline';

            logClientEvent({
              level: 'info',
              event: 'reader.offline_annotations_restored',
              traceId: createTraceId(),
              spanId: createSpanId(),
              metadata: {
                bookId: currentBookId,
                highlights: offlineHighlights.length,
                comments: offlineComments.length,
                bookmarks: offlineBookmarks.length,
              },
            });
          }
          const rehydrateMs = measurePerformance(
            'rehydrate-offline',
            'rehydrate-offline-start',
            'rehydrate-offline-end',
          );
          if (rehydrateMs !== undefined) {
            logClientEvent({
              level: 'info',
              traceId: createTraceId(),
              spanId: createSpanId(),
              event: 'rehydrate-offline',
              metadata: { durationMs: Math.round(rehydrateMs), bookId },
            });
          }
        } catch (cacheErr) {
          logClientEvent({
            level: 'debug',
            event: 'reader.offline_cache_error',
            traceId: createTraceId(),
            spanId: createSpanId(),
            error: {
              name: cacheErr instanceof Error ? cacheErr.name : 'UnknownError',
              message: cacheErr instanceof Error ? cacheErr.message : String(cacheErr),
            },
            metadata: { bookId },
          });
        }
      } finally {
        logClientEvent({
          level: 'info',
          event: 'reader.progress_loaded',
          traceId: createTraceId(),
          spanId: createSpanId(),
          metadata: { bookId, source },
        });
      }
    }

    void loadData();

    const unsubscribe = subscribeAnnotationChanges((changedBookId) => {
      if (changedBookId === bookId && !isCancelled) {
        void loadData();
      }
    });

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [sessionToken, bookId, setHighlights, setComments, setBookmarks, setProgress]);
}

import { useEffect } from 'react';
import { createSpanId, createTraceId } from '@do-epub-studio/shared';
import { apiRequest, fetchHighlights, fetchComments, fetchProgress } from '../../../lib/api/index';
import { logClientEvent } from '../../../lib/client-logger';
import { getProgress, getAnnotations } from '../../../lib/offline';
import type { Highlight, Comment, Bookmark, ReadingProgress } from '../../../stores';
import {
  mapOfflineHighlight,
  mapOfflineComment,
  mapOfflineBookmark,
} from './mapOfflineAnnotation';

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
  useEffect(() => {
    if (!sessionToken || !bookId) return;

    void (async () => {
      let source: 'server' | 'offline' | 'default' = 'default';

      try {
        const [hl, cm, bm, pg] = await Promise.all([
          fetchHighlights(bookId, sessionToken),
          fetchComments(bookId, sessionToken),
          apiRequest<Bookmark[]>(`/api/books/${bookId}/bookmarks`, { token: sessionToken }),
          fetchProgress(bookId, sessionToken),
        ]);
        setHighlights(hl);
        setComments(cm);
        setBookmarks(bm);
        setProgress(pg);
        source = 'server';
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logClientEvent({
          level: 'warn',
          event: 'reader.load_failed',
          traceId: createTraceId(),
          spanId: createSpanId(),
          error: { name: error.name, message: error.message, stack: error.stack },
          metadata: { bookId },
        });

        // Fallback to offline cache if server fetch fails (A6)
        try {
          const [progressResult, annotationsResult] = await Promise.allSettled([
            getProgress(bookId),
            getAnnotations(bookId),
          ]);
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

            if (offlineHighlights.length > 0) setHighlights(offlineHighlights);
            if (offlineComments.length > 0) setComments(offlineComments);
            if (offlineBookmarks.length > 0) setBookmarks(offlineBookmarks);
            if (source === 'default') source = 'offline';

            logClientEvent({
              level: 'info',
              event: 'reader.offline_annotations_restored',
              traceId: createTraceId(),
              spanId: createSpanId(),
              metadata: {
                bookId,
                highlights: offlineHighlights.length,
                comments: offlineComments.length,
                bookmarks: offlineBookmarks.length,
              },
            });
          }
        } catch (cacheErr) {
          // Log cache errors at debug level — non-fatal, server data already failed
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
    })();
  }, [sessionToken, bookId, setHighlights, setComments, setBookmarks, setProgress]);
}

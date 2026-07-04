import { useEffect, useRef, useCallback } from 'react';
import { ReadingTimer, computeInsightSummary } from '../../../lib/offline/reading-insights';
import { useReaderStore } from '../../../stores';
import { useAuthStore } from '../../../stores/auth';
import { apiRequest } from '../../../lib/api';
import { createTraceId, createSpanId } from '@do-epub-studio/shared/src/telemetry';
import { logClientEvent } from '../../../lib/client-logger';
import { queueSync, generateMutationId } from '../../../lib/offline';

interface InsightSummary {
  totalActiveMinutes: number;
  totalActivePages: number;
  estimatedMinutesRemaining: number | null;
  currentStreakDays: number;
  recentActivity: { date: string; activeMinutes: number; activePages: number }[];
}

export function useReadingTimer(bookId: string | null) {
  const timerRef = useRef<ReadingTimer | null>(null);
  const { progress } = useReaderStore();
  const sessionToken = useAuthStore((s) => s.sessionToken);

  useEffect(() => {
    if (!bookId) return;
    timerRef.current = new ReadingTimer(bookId);
    return () => {
      void timerRef.current?.flush();
      timerRef.current?.destroy();
      timerRef.current = null;
    };
  }, [bookId]);

  const markLoaded = useCallback(() => {
    timerRef.current?.markLoaded();
  }, []);

  const markPageRead = useCallback(() => {
    timerRef.current?.markPageRead();
  }, []);

  const flush = useCallback(async () => {
    await timerRef.current?.flush();
  }, []);

  const syncToServer = useCallback(async () => {
    if (!sessionToken || !bookId) return;

    const { getAllReadingInsights } = await import('../../../lib/offline/db');
    const entries = await getAllReadingInsights();
    const bookEntries = entries.filter((e) => e.bookId === bookId);

    if (bookEntries.length === 0) return;

    try {
      await apiRequest(`/api/books/${bookId}/insights/sync`, {
        method: 'POST',
        token: sessionToken,
        body: JSON.stringify({
          bookId,
          buckets: bookEntries.map((e) => ({
            date: e.date,
            activeMinutes: e.activeMinutes,
            activePages: e.activePages,
          })),
        }),
      });
    } catch (e) {
      const syncError = e instanceof Error ? e : new Error(String(e));
      logClientEvent({
        level: 'warn',
        event: 'reader.insight_sync_failed',
        traceId: createTraceId(),
        spanId: createSpanId(),
        error: { name: syncError.name, message: syncError.message, stack: syncError.stack },
        metadata: { bookId },
      });
      // Enqueue retry instead of silently dropping
      const mutationId = generateMutationId();
      await queueSync('reading-insight', {
        bookId,
        buckets: bookEntries.map((e) => ({
          date: e.date,
          activeMinutes: e.activeMinutes,
          activePages: e.activePages,
        })),
        mutationId,
      }, mutationId);
    }
  }, [bookId, sessionToken]);

  const getSummary = useCallback(async (): Promise<InsightSummary> => {
    if (!bookId) {
      return {
        totalActiveMinutes: 0,
        totalActivePages: 0,
        estimatedMinutesRemaining: null,
        currentStreakDays: 0,
        recentActivity: [],
      };
    }
    return computeInsightSummary(bookId, progress.progressPercent);
  }, [bookId, progress.progressPercent]);

  return { markLoaded, markPageRead, flush, syncToServer, getSummary };
}

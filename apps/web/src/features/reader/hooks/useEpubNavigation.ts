import { useEffect, useRef } from 'react';
import type { Rendition } from '@intity/epub-js';
import type { MutableRefObject } from 'react';
import type { PageDirection } from '../../../stores';
import type {
  AnnotationAdapter,
  HighlightRecord,
  CommentRecord,
} from '@do-epub-studio/reader-core';
import { createSpanId, createTraceId } from '@do-epub-studio/shared';
import {
  createPerformanceMark,
  logClientEvent,
  measurePerformance,
} from '../../../lib/client-logger';
import { useReaderStore } from '../../../stores';
import type { PrefetchManager } from '../../../lib/prefetch-manager';
import type { TocItem } from '../lib/epub-init';
import { createRelocatedSetup, parseableCfi } from './useReaderEpub.helpers';
import type { TFunction as TranslationFunction } from '../../../hooks/useTranslation';

export type AnnotationNavigation = (chapterRef: string, cfiRange?: string) => void | Promise<void>;
type AnnotationScheduler = () => void;

interface EpubNavigationOptions {
  rendition: Rendition | null;
  directionRef: MutableRefObject<PageDirection>;
  toc: TocItem[];
  bookId: string | null;
  sessionToken: string | null;
  progressCfi?: string | null;
  currentChapterRef: MutableRefObject<string | null>;
  highlightsRef: MutableRefObject<HighlightRecord[]>;
  commentsRef: MutableRefObject<CommentRecord[]>;
  adapterRef: MutableRefObject<AnnotationAdapter | null>;
  onNavigateToAnnotationRef: MutableRefObject<AnnotationNavigation>;
  prefetchManagerRef: MutableRefObject<PrefetchManager | null>;
  progressFlushRef: MutableRefObject<(() => Promise<void>) | null>;
  scheduleAnnotations: AnnotationScheduler;
  markPageRead?: () => void;
  setChapter?: (href: string | null, wordCount?: number) => void;
  t: TranslationFunction;
}

export function useEpubNavigation({
  rendition,
  directionRef,
  toc,
  bookId,
  sessionToken,
  progressCfi,
  currentChapterRef,
  highlightsRef,
  commentsRef,
  adapterRef,
  onNavigateToAnnotationRef,
  prefetchManagerRef,
  progressFlushRef,
  scheduleAnnotations,
  markPageRead,
  setChapter,
  t,
}: EpubNavigationOptions): void {
  const setError = useReaderStore((state) => state.setError);
  const setProgress = useReaderStore((state) => state.setProgress);
  const setCurrentChapter = useReaderStore((state) => state.setCurrentChapter);
  const translationRef = useRef(t);
  translationRef.current = t;
  const loadMetricRenditionRef = useRef<Rendition | null>(null);
  const displayedRenditionRef = useRef<Rendition | null>(null);
  // CFI the rendition itself reported through 'relocated'. A store update that
  // carries this CFI must not schedule another `display(cfi)`: the rendition is
  // already there, and the redundant display lands asynchronously — it can
  // revert a page turn the reader made in the meantime (measured: the chapter
  // navigation smoke test flaked ~50% without this guard).
  const renditionCfiRef = useRef<string | null>(null);

  useEffect(() => {
    if (!rendition) return;
    const adapter = adapterRef.current;
    if (!adapter) return;
    const onRelocated = createRelocatedSetup({
      bookId,
      sessionToken,
      rendition,
      setProgress,
      setCurrentChapter,
      toc,
      currentChapterRef,
      highlightsRef,
      commentsRef,
      onNavigateToAnnotationRef,
      adapter,
      prefetchManager: prefetchManagerRef,
      progressFlushRef,
      renditionCfiRef,
      setChapter,
      markPageRead,
    });
    rendition.on('relocated', onRelocated);
    return () => {
      rendition.off('relocated', onRelocated);
      const flushRef = progressFlushRef;
      const flush = flushRef.current;
      if (flush) {
        void flush();
      }
    };
  }, [
    rendition,
    bookId,
    sessionToken,
    setProgress,
    setCurrentChapter,
    toc,
    currentChapterRef,
    highlightsRef,
    commentsRef,
    onNavigateToAnnotationRef,
    adapterRef,
    prefetchManagerRef,
    progressFlushRef,
    setChapter,
    markPageRead,
  ]);

  useEffect(() => {
    if (!rendition) return;
    let active = true;
    if (displayedRenditionRef.current !== rendition) {
      displayedRenditionRef.current = rendition;
      currentChapterRef.current = null;
      renditionCfiRef.current = null;
      setCurrentChapter(null);
    }
    const savedCfi = progressCfi ?? undefined;
    const displayCfi = parseableCfi(savedCfi);
    if (savedCfi && !displayCfi) {
      logClientEvent({
        level: 'warn',
        event: 'reader.progress_cfi_invalid',
        traceId: createTraceId(),
        spanId: createSpanId(),
        metadata: { bookId },
      });
    }

    const display = async (): Promise<void> => {
      try {
        await rendition.display(displayCfi);
      } catch (caught) {
        const error = caught instanceof Error ? caught : new Error(String(caught));
        logClientEvent({
          level: 'warn',
          event: 'reader.display_fallback',
          traceId: createTraceId(),
          spanId: createSpanId(),
          error: { name: error.name, message: error.message },
        });
        try {
          await rendition.display();
        } catch (fallbackCaught) {
          const fallbackError =
            fallbackCaught instanceof Error ? fallbackCaught : new Error(String(fallbackCaught));
          if (!active) return;
          logClientEvent({
            level: 'error',
            event: 'reader.epub_init_failed',
            traceId: createTraceId(),
            spanId: createSpanId(),
            error: {
              name: fallbackError.name,
              message: fallbackError.message,
              stack: fallbackError.stack,
            },
            metadata: { bookId },
          });
          setError(translationRef.current('reader.loadError'));
          return;
        }
      }

      if (!active) return;
      if (rendition.location?.start) {
        const chapterHref = rendition.location.start.href ?? null;
        currentChapterRef.current = chapterHref;
        setCurrentChapter(chapterHref);
        void prefetchManagerRef.current?.onChapterChange(chapterHref ?? '');
      }
      scheduleAnnotations();
      if (loadMetricRenditionRef.current !== rendition) {
        loadMetricRenditionRef.current = rendition;
        createPerformanceMark('reader:load-end');
        const loadMs = measurePerformance('reader:load', 'reader:load-start', 'reader:load-end');
        if (loadMs !== undefined) {
          logClientEvent({
            level: 'info',
            traceId: createTraceId(),
            spanId: createSpanId(),
            event: 'reader:load',
            metadata: { durationMs: Math.round(loadMs) },
          });
        }
      }
    };

    // The store update was caused by the rendition's own 'relocated' event:
    // it is already displaying this position, and re-displaying it would race
    // with a page turn the reader just made.
    if (displayCfi && displayCfi === renditionCfiRef.current) return;

    void display();
    return () => {
      active = false;
    };
  }, [
    rendition,
    progressCfi,
    bookId,
    scheduleAnnotations,
    currentChapterRef,
    setCurrentChapter,
    prefetchManagerRef,
    setError,
  ]);
  useEffect(() => {
    if (!rendition) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      const isRtl =
        directionRef.current === 'rtl' ||
        (directionRef.current === 'default' && document.documentElement.dir === 'rtl');
      if (event.key === (isRtl ? 'ArrowLeft' : 'ArrowRight')) {
        event.preventDefault();
        void rendition.next();
      } else if (event.key === (isRtl ? 'ArrowRight' : 'ArrowLeft')) {
        event.preventDefault();
        void rendition.prev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rendition, directionRef]);
}

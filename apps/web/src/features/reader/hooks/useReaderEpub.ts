import { useEffect, useRef, useState } from 'react';
import type { Book, Rendition, NavItem } from '@intity/epub-js';
import { EpubCFI } from '@intity/epub-js';
import type { EpubRenditionInternals } from '../lib/epub-internals';
import type { PageDirection, ReaderZoom } from '../../../stores';
import { collectSpineSections } from '../../../lib/epub-sections';
import {
  createEpubLoader,
  createEpubSanitizerHook,
  createExternalUrlGuardHook,
} from '@do-epub-studio/reader-core';
import { createSpanId, createTraceId } from '@do-epub-studio/shared';
import {
  logClientEvent,
  createPerformanceMark,
  measurePerformance,
  observePerformance,
  reportPerformanceMetrics,
} from '../../../lib/client-logger';
import { getPrefersReducedMotion } from '../../../lib/reduced-motion';
import { useAuthStore, useReaderStore, usePreferencesStore } from '../../../stores';
import { useTranslation } from '../../../hooks/useTranslation';
import {
  createEpubAnnotationAdapter,
  type AnnotationAdapter,
  type HighlightRecord,
  type CommentRecord,
} from '@do-epub-studio/reader-core';
import {
  applyFixedLayoutZoomStyle,
  createFixedLayoutContentHooks,
  createFixedLayoutZoomHook,
  createRelocatedSetup,
  createThemeApplier,
  isSystemDark,
} from './useReaderEpub.helpers';
import { applyDirectionAndWritingMode, type TocItem, type BookInfo } from '../lib/epub-init';
import { resolveBookPresentation, resolveEffectiveSpread } from '../lib/epub-presentation';
import { PrefetchManager, type SpineItem } from '../../../lib/prefetch-manager';

/**
 * A stored CFI can be unparseable (legacy or corrupt progress), and epub.js
 * throws that from inside its display queue as an unhandled error. Validate
 * once here; an unparseable value is dropped so the reader starts cleanly.
 */
function parseableCfi(cfi: string | undefined): string | undefined {
  if (!cfi) return undefined;
  try {
    const parsed: unknown = new EpubCFI(cfi);
    return parsed instanceof EpubCFI ? cfi : undefined;
  } catch {
    return undefined;
  }
}

export function useReaderEpub(
  epubUrl: string | null,
  viewerRef: React.RefObject<HTMLDivElement | null>,
  rootRef: React.RefObject<HTMLDivElement | null>,
  highlightsRef: React.MutableRefObject<HighlightRecord[]>,
  commentsRef: React.MutableRefObject<CommentRecord[]>,
  onNavigateToAnnotation: (chapterRef: string, cfiRange?: string) => void | Promise<void>,
  progressCfi?: string,
  markPageRead?: () => void,
  setChapter?: (href: string | null, wordCount?: number) => void,
) {
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const bookId = useAuthStore((s) => s.bookId);
  const setCurrentChapter = useReaderStore((s) => s.setCurrentChapter);
  const setError = useReaderStore((s) => s.setError);
  const setProgress = useReaderStore((s) => s.setProgress);
  const setBookDirection = useReaderStore((s) => s.setBookDirection);
  const setIsFixedLayout = useReaderStore((s) => s.setIsFixedLayout);
  const readerSpread = useReaderStore((s) => s.readerSpread);
  const readerZoom = useReaderStore((s) => s.readerZoom);
  const readerTheme = usePreferencesStore((s) => s.reader.theme);
  const readerFontSize = usePreferencesStore((s) => s.reader.fontSize);
  const readerFontFamily = usePreferencesStore((s) => s.reader.fontFamily);
  const readerLineHeight = usePreferencesStore((s) => s.reader.lineHeight);
  const readerDirection = usePreferencesStore((s) => s.reader.direction);
  const readerWritingMode = usePreferencesStore((s) => s.reader.writingMode);
  const { t } = useTranslation();

  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const currentChapterRef = useRef<string | null>(null);
  const tocRef = useRef<TocItem[]>([]);
  const adapterRef = useRef<AnnotationAdapter | null>(null);
  const prefetchManagerRef = useRef<PrefetchManager | null>(null);
  const progressFlushRef = useRef<(() => Promise<void>) | null>(null);
  const loaderRef = useRef<ReturnType<typeof createEpubLoader> | null>(null);
  // Progress updates on every relocation; use the latest value for initial display
  // without tearing down and rebuilding the active EPUB rendition.
  const progressCfiRef = useRef(progressCfi);
  progressCfiRef.current = progressCfi;
  const onNavigateToAnnotationRef = useRef(onNavigateToAnnotation);
  onNavigateToAnnotationRef.current = onNavigateToAnnotation;
  const directionRef = useRef<PageDirection>('default');
  const fixedLayoutRef = useRef(false);
  const zoomRef = useRef<ReaderZoom>(readerZoom);
  zoomRef.current = readerZoom;

  const [toc, setToc] = useState<TocItem[]>([]);
  const [metadata, setMetadata] = useState<BookInfo | null>(null);

  const resolvedTheme =
    readerTheme === 'system' ? (isSystemDark() ? 'dark' : 'light') : readerTheme;

  const applyThemesRef = useRef<(rendition: Rendition) => void>(() => {
    /* noop */
  });
  applyThemesRef.current = createThemeApplier({
    rootRef,
    readerTheme,
    fixedLayoutRef,
    readerFontSize,
    readerLineHeight,
    readerFontFamily,
  });

  useEffect(() => {
    if (!epubUrl || !viewerRef.current) return;
    let active = true;
    const viewer = viewerRef.current;
    const initEpub = async () => {
      createPerformanceMark('reader:load-start');
      try {
        const loader = createEpubLoader();
        loaderRef.current = loader;
        await loader.load(epubUrl);
        const book = loader.getBook();
        if (!book) throw new Error('EPUB load returned no book');
        bookRef.current = book;
        await book.ready;
        if (!active) return;
        const [navigation, meta] = await Promise.all([
          book.loaded.navigation,
          book.loaded.metadata,
        ]);
        const tocItems: TocItem[] = navigation.toc
          ? navigation.toc.map((item: NavItem) => ({ label: item.label, href: item.href }))
          : [];
        setToc(tocItems);
        tocRef.current = tocItems;

        // Initialize PrefetchManager with spine items (either build shape —
        // `book.sections` in the ESM build, `book.spine` in dist; GOAP-295).
        const spineItems: SpineItem[] = [];
        for (const item of collectSpineSections<{ href?: string }>(book)) {
          if (item.href) {
            spineItems.push({ href: item.href });
          }
        }
        if (spineItems.length > 0) {
          const prefetchManager = new PrefetchManager();
          prefetchManager.setSpine(spineItems);
          prefetchManagerRef.current = prefetchManager;
        }

        const bookDirection: PageDirection =
          book.packaging?.direction === 'rtl'
            ? 'rtl'
            : book.packaging?.direction === 'ltr'
              ? 'ltr'
              : 'default';
        directionRef.current = bookDirection;
        setBookDirection(bookDirection);
        const presentation = await resolveBookPresentation(book, meta);
        const { bookInfo, fixedLayout, fixedLayoutSpread, fixedLayoutViewport } = presentation;
        if (fixedLayout) {
          fixedLayoutRef.current = true;
          setIsFixedLayout(true);
        }
        setMetadata(bookInfo);

        const effectiveSpread = resolveEffectiveSpread(
          fixedLayout,
          fixedLayoutSpread,
          bookDirection,
        );

        const rendition = book.renderTo(viewer, {
          width: '100%',
          height: '100%',
          spread: effectiveSpread,
          sandbox: ['allow-same-origin'],
          defaultDirection: bookDirection === 'default' ? undefined : bookDirection,
        });
        renditionRef.current = rendition;

        // Security: Mandatory sanitization of all EPUB content
        const { hook: baseSanitizer } = createEpubSanitizerHook();
        rendition.hooks.content.register(baseSanitizer);
        // Fetch-level egress guard backstop: strict CSP so the browser refuses
        // external subresource fetches even if a URL evades the sanitizer.
        rendition.hooks.content.register(createExternalUrlGuardHook().hook);

        if (fixedLayout) {
          const contentHooks = createFixedLayoutContentHooks(fixedLayoutViewport);
          if (fixedLayoutViewport) {
            rendition.hooks.content.register(contentHooks.applyViewportMeta);
          }
          rendition.hooks.content.register(contentHooks.lockOverflow);
          // Apply the user-chosen zoom to every fresh content document.
          // The current zoom is read from `zoomRef` (kept fresh by the effect
          // above) so changes propagate via the spread re-display.
          rendition.hooks.content.register(createFixedLayoutZoomHook(zoomRef));
        }

        applyThemesRef.current(rendition);

        const adapter = createEpubAnnotationAdapter(rendition);
        adapterRef.current = adapter;

        applyDirectionAndWritingMode(
          rendition,
          readerDirection !== 'default' ? readerDirection : bookDirection,
          readerWritingMode,
        );
        const initialProgressCfi = progressCfiRef.current;
        const displayCfi = parseableCfi(initialProgressCfi);
        if (initialProgressCfi && !displayCfi) {
          logClientEvent({
            level: 'warn',
            event: 'reader.progress_cfi_invalid',
            traceId: createTraceId(),
            spanId: createSpanId(),
            metadata: { bookId },
          });
        }
        try {
          await rendition.display(displayCfi);
        } catch (error) {
          // A parseable CFI can still dangle after the book file changes
          // (content replaced): epub.js rejects asynchronously. Never blank
          // the reader on it — fall back to the first section and record why.
          logClientEvent({
            level: 'warn',
            event: 'reader.display_fallback',
            traceId: createTraceId(),
            spanId: createSpanId(),
            error:
              error instanceof Error
                ? { name: error.name, message: error.message }
                : { name: 'Error', message: String(error) },
          });
          await rendition.display();
        }
        if (!active) return;

        const initialLocation = rendition.location;
        if (initialLocation?.start) {
          const startHref = initialLocation.start.href ?? null;
          currentChapterRef.current = startHref;
          setCurrentChapter(startHref);
          // Trigger prefetch for initial chapter
          void prefetchManagerRef.current?.onChapterChange(startHref ?? '');
        }

        // Record time-to-first-display for client telemetry. Falls back to a
        // no-op when the Performance API is unavailable (SSR / older browsers).
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

        adapter.scheduleRender(
          currentChapterRef.current,
          highlightsRef.current,
          commentsRef.current,
          onNavigateToAnnotationRef.current,
        );

        rendition.on(
          'relocated',
          createRelocatedSetup({
            bookId,
            sessionToken,
            rendition,
            setProgress,
            setCurrentChapter,
            toc: tocRef.current,
            currentChapterRef,
            highlightsRef,
            commentsRef,
            onNavigateToAnnotationRef,
            adapter,
            prefetchManager: prefetchManagerRef,
            progressFlushRef,
            setChapter,
            markPageRead,
          }),
        );

        rendition.on('displayed', () => {
          adapter.scheduleRender(
            currentChapterRef.current,
            highlightsRef.current,
            commentsRef.current,
            onNavigateToAnnotationRef.current,
          );
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        // Cleanup (unmount, dependency change) destroys the loader and rejects
        // the in-flight load: that is a cancellation, not an init failure.
        if (!active) {
          logClientEvent({
            level: 'info',
            event: 'reader.epub_init_aborted',
            traceId: createTraceId(),
            spanId: createSpanId(),
            error: { name: error.name, message: error.message },
            metadata: { bookId },
          });
          return;
        }
        logClientEvent({
          level: 'error',
          event: 'reader.epub_init_failed',
          traceId: createTraceId(),
          spanId: createSpanId(),
          error: { name: error.name, message: error.message, stack: error.stack },
          metadata: { bookId },
        });
        setError(t('reader.loadError'));
      }
    };

    void initEpub();

    return () => {
      active = false;
      if (adapterRef.current) {
        adapterRef.current.clearAnnotations();
        adapterRef.current.cancelScheduledRender();
      }
      prefetchManagerRef.current?.destroy();
      renditionRef.current?.destroy();
      // GOAP-224 B6: flush the debounced progress save before teardown so the
      // final reading position reaches the server / offline queue even if the
      // 500ms window never elapsed.
      void progressFlushRef.current?.();
      progressFlushRef.current = null;
      loaderRef.current?.destroy();
      loaderRef.current = null;
    };
  }, [
    epubUrl,
    viewerRef,
    sessionToken,
    bookId,
    setCurrentChapter,
    setError,
    setProgress,
    setBookDirection,
    setIsFixedLayout,
    highlightsRef,
    commentsRef,
    onNavigateToAnnotation,
    readerDirection,
    readerWritingMode,
    t,
    markPageRead,
    setChapter,
  ]);

  // Re-apply themes on preference changes (system dark-mode handled below).
  useEffect(() => {
    if (renditionRef.current) applyThemesRef.current(renditionRef.current);
  }, [resolvedTheme, readerFontSize, readerLineHeight, readerFontFamily]);

  useEffect(() => {
    if (!renditionRef.current) return;
    const dir = readerDirection !== 'default' ? readerDirection : directionRef.current;
    applyDirectionAndWritingMode(renditionRef.current, dir, readerWritingMode);
  }, [readerDirection, readerWritingMode]);

  // Apply user-chosen spread mode to the live rendition via mutable layout.settings.
  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition || !fixedLayoutRef.current) return;
    const renditionWithLayout = rendition as EpubRenditionInternals;
    const layoutSettings = renditionWithLayout.layout?.settings;
    if (layoutSettings) {
      layoutSettings.spread = readerSpread;
    }
    const currentCfi = rendition.location?.start?.cfi;
    if (currentCfi) {
      void rendition.display(currentCfi);
    }
  }, [readerSpread]);

  // Apply user-chosen zoom by injecting transform:scale() on content documents.
  useEffect(() => {
    if (!fixedLayoutRef.current) return;
    const rendition = renditionRef.current;
    if (!rendition) return;
    const contentsList = (rendition as EpubRenditionInternals)._contents;
    if (!Array.isArray(contentsList)) return;
    const reducedMotion = getPrefersReducedMotion();
    const transition = reducedMotion ? 'none' : 'transform 0.18s ease-out';
    const scale = zoomRef.current.toFixed(2);
    contentsList.forEach((contents) => {
      const doc = contents.document;
      if (!doc?.documentElement) return;
      applyFixedLayoutZoomStyle(doc, scale, transition);
    });
  }, [readerZoom]);

  useEffect(() => {
    if (readerTheme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (renditionRef.current) applyThemesRef.current(renditionRef.current);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [readerTheme]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const rendition = renditionRef.current;
      if (!rendition) return;

      const isRtl =
        directionRef.current === 'rtl' ||
        (directionRef.current === 'default' && document.documentElement.dir === 'rtl');
      const nextPage = isRtl ? 'ArrowLeft' : 'ArrowRight';
      const prevPage = isRtl ? 'ArrowRight' : 'ArrowLeft';

      if (e.key === nextPage) {
        e.preventDefault();
        void rendition.next();
      } else if (e.key === prevPage) {
        e.preventDefault();
        void rendition.prev();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Observe performance marks and report p50/p95/p99 on unmount.
  useEffect(() => {
    const observer = observePerformance((entry) => {
      if (entry.entryType === 'measure') {
        logClientEvent({
          level: 'info',
          traceId: createTraceId(),
          spanId: createSpanId(),
          event: entry.name,
          metadata: { durationMs: Math.round(entry.duration) },
        });
      }
    });
    return () => {
      reportPerformanceMetrics('reader:load', (m) => {
        logClientEvent({
          level: 'info',
          traceId: createTraceId(),
          spanId: createSpanId(),
          event: 'reader:perf_summary',
          metadata: { p50: m.p50, p95: m.p95, p99: m.p99, count: m.count },
        });
      });
      observer?.disconnect();
    };
  }, []);

  return {
    bookRef,
    renditionRef,
    currentChapterRef,
    adapterRef,
    toc,
    resolvedTheme,
    metadata,
  };
}

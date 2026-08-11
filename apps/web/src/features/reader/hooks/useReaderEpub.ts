import { useEffect, useRef, useState } from 'react';
import type { Book, Rendition, NavItem, Contents } from '@intity/epub-js';
import type { PageDirection, ReaderZoom } from '../../../stores';
import {
  createEpubLoader,
  parseAccessibilityFromOpf,
  parseFixedLayoutFromOpf,
  createEpubSanitizerHook,
} from '@do-epub-studio/reader-core';
import { createSpanId, createTraceId } from '@do-epub-studio/shared';
import { logClientEvent, createPerformanceMark, measurePerformance, observePerformance, reportPerformanceMetrics } from '../../../lib/client-logger';
import { getPrefersReducedMotion } from '../../../lib/reduced-motion';
import {
  useAuthStore,
  useReaderStore,
  usePreferencesStore,
} from '../../../stores';
import { useTranslation } from '../../../hooks/useTranslation';
import { createEpubAnnotationAdapter, type AnnotationAdapter, type HighlightRecord, type CommentRecord } from '@do-epub-studio/reader-core';
import { applyFixedLayoutZoomStyle, createFixedLayoutContentHooks, createFixedLayoutZoomHook, createRelocatedSetup, createThemeApplier, isSystemDark } from './useReaderEpub.helpers';
import { applyDirectionAndWritingMode, type TocItem, type BookInfo } from '../lib/epub-init';
import { PrefetchManager, type SpineItem } from '../../../lib/prefetch-manager';

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

  const applyThemesRef = useRef<(rendition: Rendition) => void>(() => { /* noop */ });
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
        const [navigation, meta] = await Promise.all([book.loaded.navigation, book.loaded.metadata]);
        const tocItems: TocItem[] = navigation.toc
          ? navigation.toc.map((item: NavItem) => ({ label: item.label, href: item.href }))
          : [];
        setToc(tocItems);
        tocRef.current = tocItems;

        // Initialize PrefetchManager with spine items
        const spineLike = (book as unknown as { spine?: { each: (cb: (item: SpineItem & { href: string }) => void) => void } }).spine;
        if (spineLike) {
          const spineItems: SpineItem[] = [];
          spineLike.each((item) => {
            if (item.href) {
              spineItems.push({ href: item.href });
            }
          });
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
        let fixedLayout = false;
        let fixedLayoutSpread: string | undefined;
        let fixedLayoutViewport: string | undefined;
        try {
          const metaMap = meta as Map<string, string>;
          const bookInfo: BookInfo = {
            title: metaMap.get('title') ?? '',
            creator: metaMap.get('creator'),
            publisher: metaMap.get('publisher'),
            language: metaMap.get('language'),
            description: metaMap.get('description'),
          };
          const pkgMeta = book.packaging?.metadata as Map<string, string> | undefined;
          if (pkgMeta?.get('layout') === 'pre-paginated') {
            fixedLayout = true;
            fixedLayoutSpread = pkgMeta.get('spread') ?? undefined;
            fixedLayoutViewport = pkgMeta.get('viewport') ?? undefined;
          }
          try {
            const containerMeta = book.container as unknown as { fullPath: string };
            const opfPath = containerMeta.fullPath;
            if (opfPath && book.archive) {
              const opfXml = await book.archive.getText('/' + opfPath);
              if (opfXml) {
                const fl = parseFixedLayoutFromOpf(opfXml);
                if (fl && !fixedLayout) {
                  fixedLayout = fl.layout === 'pre-paginated';
                  fixedLayoutSpread = fixedLayoutSpread ?? fl.spread;
                  fixedLayoutViewport = fixedLayoutViewport ?? fl.viewport;
                }
                bookInfo.accessibility = parseAccessibilityFromOpf(opfXml);
              }
            }
          } catch {
            // accessibility metadata is optional
          }
          if (fixedLayout) {
            fixedLayoutRef.current = true;
            setIsFixedLayout(true);
          }

          setMetadata(bookInfo);
        } catch {
          // book metadata is optional
        }

        const effectiveSpread = fixedLayout
          ? fixedLayoutSpread === 'none'
            ? 'none'
            : fixedLayoutSpread === 'both'
              ? 'both'
              : fixedLayoutSpread === 'landscape'
                ? 'landscape'
                : bookDirection === 'rtl'
                  ? 'right'
                  : 'auto'
          : bookDirection === 'rtl'
            ? 'right'
            : 'auto';

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
        await rendition.display(progressCfi);
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
        logClientEvent({
          level: 'error',
          event: 'reader.epub_init_failed',
          traceId: createTraceId(),
          spanId: createSpanId(),
          error: { name: error.name, message: error.message, stack: error.stack },
          metadata: { bookId },
        });
        // GOAP-224 A9: the component may have unmounted while initEpub was
        // awaiting (cleanup sets `active = false` and destroys the loader,
        // which rejects the in-flight load). Only surface the error to the
        // reader store while this effect is still active.
        if (active) setError(t('reader.loadError'));
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
    progressCfi,
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
    const renditionWithLayout = rendition as unknown as {
      layout?: { settings?: { spread?: string } };
    };
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
    const renditionWithContents = rendition as unknown as { _contents?: Contents[] };
    const contentsList = renditionWithContents._contents;
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
        logClientEvent({ level: 'info', traceId: createTraceId(), spanId: createSpanId(),
          event: entry.name, metadata: { durationMs: Math.round(entry.duration) } });
      }
    });
    return () => {
      reportPerformanceMetrics('reader:load', (m) => {
        logClientEvent({ level: 'info', traceId: createTraceId(), spanId: createSpanId(),
          event: 'reader:perf_summary', metadata: m as unknown as Record<string, unknown> });
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

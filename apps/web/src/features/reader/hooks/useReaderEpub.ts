import { useEffect, useRef, useState } from 'react';
import ePub from '@intity/epub-js';
import type { Book, Rendition, NavItem, Contents } from '@intity/epub-js';
import type { PageDirection, WritingMode } from '../../../stores';
import {
  parseAccessibilityFromOpf,
  parseFixedLayoutFromOpf,
  createEpubSanitizerHook,
} from '@do-epub-studio/reader-core';
import { createSpanId, createTraceId } from '@do-epub-studio/shared';
import { logClientEvent } from '../../../lib/client-logger';
import {
  useAuthStore,
  useReaderStore,
  usePreferencesStore,
  FONT_SIZES,
  LINE_HEIGHTS,
} from '../../../stores';
import { useTranslation } from '../../../hooks/useTranslation';
import { createEpubAnnotationAdapter, type AnnotationAdapter, type HighlightRecord, type CommentRecord } from '@do-epub-studio/reader-core';
import { loadProgress, createRelocatedHandler } from './useEpubProgress';

interface TocItem {
  label: string;
  href: string;
  subitems?: TocItem[];
}

interface BookInfo {
  title: string;
  creator?: string;
  publisher?: string;
  language?: string;
  description?: string;
  accessibility?: {
    summary?: string;
    features: string[];
    hazards: string[];
    controls: string[];
    api?: string;
    conformsTo?: string;
    certifiedBy?: string;
    certifierCredential?: string;
    certifierReport?: string;
  };
}

function applyDirectionAndWritingMode(
  rendition: Rendition,
  direction: PageDirection,
  writingMode: WritingMode,
): void {
  const dir = direction === 'default' ? document.documentElement.dir || 'ltr' : direction;
  rendition.hooks.content.register((contents: Contents) => {
    if (contents.document?.documentElement) {
      contents.document.documentElement.setAttribute('dir', dir);
    }
    contents.direction(dir);
    if (writingMode !== 'horizontal-tb') {
      contents.css('writing-mode', writingMode, true);
    }
  });
}

export function useReaderEpub(
  epubUrl: string | null,
  viewerRef: React.RefObject<HTMLDivElement | null>,
  rootRef: React.RefObject<HTMLDivElement | null>,
  highlightsRef: React.MutableRefObject<HighlightRecord[]>,
  commentsRef: React.MutableRefObject<CommentRecord[]>,
  onNavigateToAnnotation: (chapterRef: string, cfiRange?: string) => void | Promise<void>,
) {
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const bookId = useAuthStore((s) => s.bookId);
  const setCurrentChapter = useReaderStore((s) => s.setCurrentChapter);
  const setError = useReaderStore((s) => s.setError);
  const setProgress = useReaderStore((s) => s.setProgress);
  const setBookDirection = useReaderStore((s) => s.setBookDirection);
  const setIsFixedLayout = useReaderStore((s) => s.setIsFixedLayout);
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
  const onNavigateToAnnotationRef = useRef(onNavigateToAnnotation);
  onNavigateToAnnotationRef.current = onNavigateToAnnotation;
  const directionRef = useRef<PageDirection>('default');
  const fixedLayoutRef = useRef(false);

  const [toc, setToc] = useState<TocItem[]>([]);
  const [metadata, setMetadata] = useState<BookInfo | null>(null);

  const isSystemDark = () => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  const resolvedTheme =
    readerTheme === 'system' ? (isSystemDark() ? 'dark' : 'light') : readerTheme;

  const applyThemesRef = useRef<(rendition: Rendition) => void>(() => { /* noop */ });
  applyThemesRef.current = (rendition: Rendition) => {
    const container = rootRef.current;
    if (!container) return;
    const style = getComputedStyle(container);
    const bg = style.getPropertyValue('--color-background').trim();
    const fg = style.getPropertyValue('--color-foreground').trim();
    const effectiveTheme =
      readerTheme === 'system' ? (isSystemDark() ? 'dark' : 'light') : readerTheme;
    const imgFilter =
      effectiveTheme === 'dark'
        ? 'invert(1) hue-rotate(180deg)'
        : effectiveTheme === 'sepia'
          ? 'sepia(1)'
          : 'none';
    const bodyStyles: Record<string, string> = {
      background: bg,
      color: fg,
    };
    if (!fixedLayoutRef.current) {
      bodyStyles['font-size'] = FONT_SIZES[readerFontSize];
      bodyStyles['line-height'] = LINE_HEIGHTS[readerLineHeight];
      bodyStyles['font-family'] =
        readerFontFamily === 'serif'
          ? 'serif'
          : readerFontFamily === 'sans-serif'
            ? 'sans-serif'
            : 'monospace';
    }
    rendition.themes.registerRules('reader-theme', {
      body: bodyStyles,
      img: { filter: imgFilter },
    });
    rendition.themes.select('reader-theme');
  };

  useEffect(() => {
    if (!epubUrl || !viewerRef.current) return;
    let active = true;
    const viewer = viewerRef.current;

    const initEpub = async () => {
      try {
        const book = ePub(epubUrl);
        bookRef.current = book;
        await book.ready;
        if (!active) return;

        const navigation = await book.loaded.navigation;
        const tocItems: TocItem[] = navigation.toc
          ? navigation.toc.map((item: NavItem) => ({ label: item.label, href: item.href }))
          : [];
        setToc(tocItems);
        tocRef.current = tocItems;

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
          const meta = await book.loaded.metadata;
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
        rendition.hooks.content.register(createEpubSanitizerHook());

        if (fixedLayout) {
          if (fixedLayoutViewport) {
            const viewportValue = fixedLayoutViewport;
            rendition.hooks.content.register((contents: Contents) => {
              const doc = contents.document;
              if (doc) {
                let existing = doc.querySelector('meta[name="viewport"]');
                if (!existing) {
                  existing = doc.createElement('meta');
                  existing.setAttribute('name', 'viewport');
                  doc.head?.appendChild(existing);
                }
                existing.setAttribute('content', viewportValue);
              }
            });
          }
          rendition.hooks.content.register((contents: Contents) => {
            const doc = contents.document;
            if (doc?.documentElement) {
              doc.documentElement.style.setProperty('overflow', 'hidden', 'important');
            }
          });
        }

        applyThemesRef.current(rendition);

        const adapter = createEpubAnnotationAdapter(rendition);
        adapterRef.current = adapter;

        applyDirectionAndWritingMode(
          rendition,
          readerDirection !== 'default' ? readerDirection : bookDirection,
          readerWritingMode,
        );
        await rendition.display();
        if (!active) return;

        const initialLocation = rendition.location;
        if (initialLocation?.start) {
          const startHref = initialLocation.start.href ?? null;
          currentChapterRef.current = startHref;
          setCurrentChapter(startHref);
        }

        adapter.renderHighlights(currentChapterRef.current, highlightsRef.current);
        adapter.renderCommentMarkers(
          currentChapterRef.current,
          commentsRef.current,
          onNavigateToAnnotationRef.current,
        );

        if (sessionToken && bookId) {
          await loadProgress(rendition, bookId, sessionToken);
        }

        rendition.on(
          'relocated',
          (() => {
            if (!sessionToken || !bookId) return () => { /* noop */ };
            const renderAnnotations = () => {
              adapter.renderHighlights(currentChapterRef.current, highlightsRef.current);
              adapter.renderCommentMarkers(
                currentChapterRef.current,
                commentsRef.current,
                onNavigateToAnnotationRef.current,
              );
            };
            return createRelocatedHandler(
              bookId,
              sessionToken,
              setProgress,
              setCurrentChapter,
              tocRef.current,
              currentChapterRef,
              renderAnnotations,
            );
          })(),
        );

        rendition.on('displayed', () => {
          adapter.renderHighlights(currentChapterRef.current, highlightsRef.current);
          adapter.renderCommentMarkers(
            currentChapterRef.current,
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
        setError(t('reader.loadError'));
      }
    };

    void initEpub();

    return () => {
      active = false;
      if (adapterRef.current) {
        adapterRef.current.clearAnnotations();
      }
      renditionRef.current?.destroy();
      bookRef.current?.destroy();
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
  ]);

  useEffect(() => {
    if (renditionRef.current) applyThemesRef.current(renditionRef.current);
  });

  useEffect(() => {
    if (!renditionRef.current) return;
    const dir = readerDirection !== 'default' ? readerDirection : directionRef.current;
    applyDirectionAndWritingMode(renditionRef.current, dir, readerWritingMode);
  }, [readerDirection, readerWritingMode]);

  useEffect(() => {
    if (readerTheme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (renditionRef.current) applyThemesRef.current(renditionRef.current);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  });

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
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
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

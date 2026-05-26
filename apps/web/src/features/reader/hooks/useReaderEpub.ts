import { useEffect, useRef, useState, useCallback } from 'react';
import ePub from '@intity/epub-js';
import type { Book, Rendition, NavItem, Contents } from '@intity/epub-js';
import type { PageDirection, WritingMode } from '../../../stores';
import { parseAccessibilityFromOpf } from '@do-epub-studio/reader-core';
import {
  useAuthStore,
  useReaderStore,
  usePreferencesStore,
  FONT_SIZES,
  LINE_HEIGHTS,
} from '../../../stores';
import { useTranslation } from '../../../hooks/useTranslation';
import { apiRequest } from '../../../lib/api';
import { saveProgress, queueSync, getProgress, generateMutationId } from '../../../lib/offline';

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
  renderHighlightsRef: React.MutableRefObject<((r: Rendition, ch: string | null) => void) | null>,
  renderCommentMarkersRef: React.MutableRefObject<
    ((r: Rendition, ch: string | null) => void) | null
  >,
) {
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const bookId = useAuthStore((s) => s.bookId);
  const setCurrentChapter = useReaderStore((s) => s.setCurrentChapter);
  const setError = useReaderStore((s) => s.setError);
  const setProgress = useReaderStore((s) => s.setProgress);
  const setBookDirection = useReaderStore((s) => s.setBookDirection);
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
  const directionRef = useRef<PageDirection>('default');

  const [toc, setToc] = useState<TocItem[]>([]);
  const [metadata, setMetadata] = useState<BookInfo | null>(null);

  const isSystemDark = useCallback(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }, []);

  const resolvedTheme =
    readerTheme === 'system' ? (isSystemDark() ? 'dark' : 'light') : readerTheme;

  const applyThemes = useCallback(
    (rendition: Rendition) => {
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
      rendition.themes.registerRules('reader-theme', {
        body: {
          background: bg,
          color: fg,
          'font-size': FONT_SIZES[readerFontSize],
          'line-height': LINE_HEIGHTS[readerLineHeight],
          'font-family':
            readerFontFamily === 'serif'
              ? 'serif'
              : readerFontFamily === 'sans-serif'
                ? 'sans-serif'
                : 'monospace',
        },
        img: { filter: imgFilter },
      });
      rendition.themes.select('reader-theme');
    },
    [readerTheme, readerFontSize, readerFontFamily, readerLineHeight, isSystemDark, rootRef],
  );

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

        const bookDirection: PageDirection = book.packaging?.direction === 'rtl'
          ? 'rtl'
          : book.packaging?.direction === 'ltr'
            ? 'ltr'
            : 'default';
        directionRef.current = bookDirection;
        setBookDirection(bookDirection);

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

          try {
            const containerMeta = book.container as unknown as { fullPath: string };
            const opfPath = containerMeta.fullPath;
            if (opfPath && book.archive) {
              const opfXml = await book.archive.getText('/' + opfPath);
              if (opfXml) {
                bookInfo.accessibility = parseAccessibilityFromOpf(opfXml);
              }
            }
          } catch {
            // accessibility metadata is optional
          }
          setMetadata(bookInfo);
        } catch {
          // book metadata is optional
        }

        const rendition = book.renderTo(viewer, {
          width: '100%',
          height: '100%',
          spread: bookDirection === 'rtl' ? 'right' : 'auto',
          sandbox: ['allow-same-origin', 'allow-scripts'],
          defaultDirection: bookDirection === 'default' ? undefined : bookDirection,
        });
        renditionRef.current = rendition;
        applyThemes(rendition);
        applyDirectionAndWritingMode(rendition, readerDirection !== 'default' ? readerDirection : bookDirection, readerWritingMode);
        await rendition.display();
        if (!active) return;

        const initialLocation = rendition.location;
        if (initialLocation?.start) {
          const startHref = initialLocation.start.href ?? null;
          currentChapterRef.current = startHref;
          setCurrentChapter(startHref);
        }
        renderHighlightsRef.current?.(rendition, currentChapterRef.current);
        renderCommentMarkersRef.current?.(rendition, currentChapterRef.current);

        if (sessionToken && bookId) {
          try {
            let cfi: string | undefined;

            if (navigator.onLine) {
              const progressData = await apiRequest<{ locator: unknown; progressPercent: number }>(
                `/api/books/${bookId}/progress`,
                { method: 'GET', token: sessionToken },
              );
              cfi = (progressData.locator as { cfi?: string } | null)?.cfi;
            } else {
              const cached = await getProgress(bookId);
              if (cached?.cfi) cfi = cached.cfi;
            }

            if (cfi) await rendition.display(cfi);
          } catch (e) {
            console.warn('Failed to load progress from API', e);
            try {
              const cached = await getProgress(bookId);
              if (cached?.cfi) await rendition.display(cached.cfi);
            } catch (dbErr) {
              console.warn('Failed to load progress from cache', dbErr);
            }
          }
        }

        rendition.on(
          'relocated',
          async (location: { start: { cfi: string; progress: number; href: string } }) => {
            const { cfi, progress: progressPercent, href } = location.start;
            setProgress({ locator: { cfi }, progressPercent, updatedAt: new Date().toISOString() });

            const tocItem = tocRef.current.find((item) => item.href === href);
            if (tocItem) {
              currentChapterRef.current = tocItem.href;
              setCurrentChapter(tocItem.href);
            }

            renderHighlightsRef.current?.(rendition, currentChapterRef.current);
            renderCommentMarkersRef.current?.(rendition, currentChapterRef.current);

            if (sessionToken && bookId) {
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
                  console.warn('Failed to save progress online, queuing offline', e);
                  await queueOffline();
                }
              } else {
                await queueOffline();
              }
            }
          },
        );

        rendition.on('displayed', () => {
          renderHighlightsRef.current?.(rendition, currentChapterRef.current);
          renderCommentMarkersRef.current?.(rendition, currentChapterRef.current);
        });
      } catch (err) {
        console.error('EPUB init error:', err);
        setError(t('reader.loadError'));
      }
    };

    void initEpub();

    return () => {
      active = false;
      const r = renditionRef.current;
      if (r) {
        const existing = r.annotations as unknown as Iterable<
          [string, { cfiRange: string; type: string }]
        >;
        for (const [, annotation] of existing) {
          r.annotations.remove(annotation.cfiRange, annotation.type);
        }
      }
      renditionRef.current?.destroy();
      bookRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applyThemes only needed for initial setup; preference changes handled by dedicated effect
  }, [
    epubUrl,
    viewerRef,
    sessionToken,
    bookId,
    setCurrentChapter,
    setError,
    setProgress,
    setBookDirection,
    renderHighlightsRef,
    renderCommentMarkersRef,
    readerDirection,
    readerWritingMode,
    t,
  ]);

  useEffect(() => {
    if (renditionRef.current) applyThemes(renditionRef.current);
  }, [applyThemes]);

  useEffect(() => {
    if (!renditionRef.current) return;
    const dir = readerDirection !== 'default' ? readerDirection : directionRef.current;
    applyDirectionAndWritingMode(renditionRef.current, dir, readerWritingMode);
  }, [readerDirection, readerWritingMode]);

  useEffect(() => {
    if (readerTheme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (renditionRef.current) applyThemes(renditionRef.current);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [applyThemes, readerTheme]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const rendition = renditionRef.current;
      if (!rendition) return;

      const isRtl = directionRef.current === 'rtl'
        || (directionRef.current === 'default' && document.documentElement.dir === 'rtl');
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
    toc,
    resolvedTheme,
    metadata,
  };
}

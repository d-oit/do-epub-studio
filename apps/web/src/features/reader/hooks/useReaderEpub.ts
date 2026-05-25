import { useEffect, useRef, useState, useCallback } from 'react';
import ePub, { Book, Rendition, NavItem } from '@intity/epub-js';
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
  const readerTheme = usePreferencesStore((s) => s.reader.theme);
  const readerFontSize = usePreferencesStore((s) => s.reader.fontSize);
  const readerFontFamily = usePreferencesStore((s) => s.reader.fontFamily);
  const readerLineHeight = usePreferencesStore((s) => s.reader.lineHeight);
  const { t } = useTranslation();

  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const currentChapterRef = useRef<string | null>(null);
  const tocRef = useRef<TocItem[]>([]);

  const [toc, setToc] = useState<TocItem[]>([]);

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

        const rendition = book.renderTo(viewer, {
          width: '100%',
          height: '100%',
          spread: 'auto',
          sandbox: ['allow-same-origin'],
        });
        renditionRef.current = rendition;
        applyThemes(rendition);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applyThemes only needed for initial setup; preference changes handled by dedicated effect at line 235
  }, [
    epubUrl,
    viewerRef,
    sessionToken,
    bookId,
    setCurrentChapter,
    setError,
    setProgress,
    renderHighlightsRef,
    renderCommentMarkersRef,
    t,
  ]);

  useEffect(() => {
    if (renditionRef.current) applyThemes(renditionRef.current);
  }, [applyThemes]);

  useEffect(() => {
    if (readerTheme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (renditionRef.current) applyThemes(renditionRef.current);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [applyThemes, readerTheme]);

  return {
    bookRef,
    renditionRef,
    currentChapterRef,
    toc,
    resolvedTheme,
  };
}

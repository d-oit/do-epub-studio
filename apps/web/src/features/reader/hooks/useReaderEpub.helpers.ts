import type { MutableRefObject } from 'react';
import type { Rendition, Contents } from '@intity/epub-js';
import type {
  AnnotationAdapter,
  HighlightRecord,
  CommentRecord,
} from '@do-epub-studio/reader-core';
import {
  FONT_SIZES,
  LINE_HEIGHTS,
  type Theme,
  type FontSize,
  type ReaderZoom,
  type ReadingProgress,
} from '../../../stores';
import type { FontFamily } from '../../../stores/preferences';
import type { TocItem } from '../lib/epub-init';
import type { PrefetchManager } from '../../../lib/prefetch-manager';
import { createRelocatedHandler } from './useEpubProgress';
import { countWords } from '../../../lib/offline/reading-insights';
import { getPrefersReducedMotion } from '../../../lib/reduced-motion';

export type OnNavigateToAnnotation = (
  chapterRef: string,
  cfiRange?: string,
) => void | Promise<void>;

type SetProgress = (progress: ReadingProgress) => void;
type SetCurrentChapter = (chapter: string | null) => void;

export const isSystemDark = () => {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

/**
 * Builds the reader-theme applier: reads CSS custom properties off the viewer
 * container and registers matching body/img rules on the rendition. Font size,
 * line-height and family are only applied to reflowable (non-fixed-layout)
 * content.
 */
export function createThemeApplier({
  rootRef,
  readerTheme,
  fixedLayoutRef,
  readerFontSize,
  readerLineHeight,
  readerFontFamily,
}: {
  rootRef: MutableRefObject<HTMLDivElement | null>;
  readerTheme: Theme;
  fixedLayoutRef: MutableRefObject<boolean>;
  readerFontSize: FontSize;
  readerLineHeight: number;
  readerFontFamily: FontFamily;
}): (rendition: Rendition) => void {
  return (rendition: Rendition) => {
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
}

/**
 * Factory for the fixed-layout zoom content hook. For every fresh content
 * document it injects a `transform: scale()` stylesheet — the current zoom is
 * read from `zoomRef` (kept fresh by the reader hook's effect) so changes
 * propagate via the spread re-display.
 */
export function createFixedLayoutZoomHook(
  zoomRef: MutableRefObject<ReaderZoom>,
): (contents: Contents) => void {
  return (contents: Contents) => {
    const doc = contents.document;
    if (!doc?.documentElement) return;
    const reducedMotion = getPrefersReducedMotion();
    const transition = reducedMotion ? 'none' : 'transform 0.18s ease-out';
    const scale = zoomRef.current.toFixed(2);
    let styleEl = doc.getElementById('__fl_zoom_style__');
    if (!(styleEl instanceof HTMLStyleElement)) {
      styleEl = doc.createElement('style');
      styleEl.id = '__fl_zoom_style__';
      doc.head?.appendChild(styleEl);
    }
    styleEl.textContent =
      `html { transform: scale(${scale}); transform-origin: top center; ` +
      `transition: ${transition}; }`;
  };
}

/**
 * Builds the 'relocated' handler for a rendition: updates local progress state,
 * re-renders annotations, computes the reading-speed word count, triggers the
 * next-chapter prefetch and marks the page as read. Also wires the debounced
 * progress flush into `progressFlushRef` (GOAP-224 B6) so the final position
 * is not lost on unmount.
 */
export function createRelocatedSetup({
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
  prefetchManager,
  progressFlushRef,
  setChapter,
  markPageRead,
}: {
  bookId: string | null;
  sessionToken: string | null;
  rendition: Rendition;
  setProgress: SetProgress;
  setCurrentChapter: SetCurrentChapter;
  toc: TocItem[];
  currentChapterRef: MutableRefObject<string | null>;
  highlightsRef: MutableRefObject<HighlightRecord[]>;
  commentsRef: MutableRefObject<CommentRecord[]>;
  onNavigateToAnnotationRef: MutableRefObject<OnNavigateToAnnotation>;
  adapter: AnnotationAdapter;
  prefetchManager: MutableRefObject<PrefetchManager | null>;
  progressFlushRef: MutableRefObject<(() => Promise<void>) | null>;
  setChapter?: (href: string | null, wordCount?: number) => void;
  markPageRead?: () => void;
}) {
  if (!sessionToken || !bookId) return () => { /* noop */ };
  const renderAnnotations = () => {
    adapter.scheduleRender(
      currentChapterRef.current,
      highlightsRef.current,
      commentsRef.current,
      onNavigateToAnnotationRef.current,
    );
  };
  const relocatedHandler = createRelocatedHandler(
    bookId,
    sessionToken,
    setProgress,
    setCurrentChapter,
    toc,
    currentChapterRef,
    () => {
      renderAnnotations();
      if (setChapter) {
        // Rough word count of the rendered section for the reading-speed estimate.
        const renderedText = rendition
          .getContents()
          .map((c) => c.document?.body?.innerText ?? '')
          .join(' ');
        setChapter(currentChapterRef.current, countWords(renderedText));
      }
      // Trigger prefetch for next chapter
      void prefetchManager.current?.onChapterChange(currentChapterRef.current ?? '');
    },
    () => markPageRead?.(),
  );
  // GOAP-224 B6: the online progress PUT is debounced; call
  // flush() on unmount so the final position is not lost.
  progressFlushRef.current = relocatedHandler.flush;
  return relocatedHandler.onRelocated;
}

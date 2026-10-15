import { useEffect, useRef } from 'react';
import type { Book, Rendition } from '@intity/epub-js';
import type { PageDirection, ReadingProgress } from '../../../stores';
import type { HighlightRecord, CommentRecord, AnnotationAdapter } from '@do-epub-studio/reader-core';
import { useAuthStore, useReaderStore } from '../../../stores';
import { collectSpineItems, createRelocatedSetup, type OnNavigateToAnnotation } from './useReaderEpub.helpers';
import type { TocItem } from '../lib/epub-init';
import { PrefetchManager } from '../../../lib/prefetch-manager';

export interface UseEpubNavigationOptions {
  rendition: Rendition | null;
  book: Book | null;
  toc: TocItem[];
  bookDirection: PageDirection;
  highlightsRef: React.MutableRefObject<HighlightRecord[]>;
  commentsRef: React.MutableRefObject<CommentRecord[]>;
  onNavigateToAnnotationRef: React.MutableRefObject<OnNavigateToAnnotation>;
  adapterRef: React.MutableRefObject<AnnotationAdapter | null>;
  markPageRead?: () => void;
  setChapter?: (href: string | null, wordCount?: number) => void;
}

export interface UseEpubNavigationResult {
  currentChapterRef: React.MutableRefObject<string | null>;
  prefetchManagerRef: React.MutableRefObject<PrefetchManager | null>;
  progressFlushRef: React.MutableRefObject<(() => Promise<void>) | null>;
}

export function useEpubNavigation({
  rendition,
  book,
  toc,
  bookDirection,
  highlightsRef,
  commentsRef,
  onNavigateToAnnotationRef,
  adapterRef,
  markPageRead,
  setChapter,
}: UseEpubNavigationOptions): UseEpubNavigationResult {
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const bookId = useAuthStore((s) => s.bookId);
  const setCurrentChapter = useReaderStore((s) => s.setCurrentChapter);
  const setProgress = (progress: ReadingProgress) => useReaderStore.getState().setProgress(progress);

  const currentChapterRef = useRef<string | null>(null);
  const prefetchManagerRef = useRef<PrefetchManager | null>(null);
  const progressFlushRef = useRef<(() => Promise<void>) | null>(null);

  // Initialize PrefetchManager when book changes
  useEffect(() => {
    if (!book) return;
    const spineItems = collectSpineItems(book);
    if (spineItems.length > 0) {
      const prefetchManager = new PrefetchManager();
      prefetchManager.setSpine(spineItems);
      prefetchManagerRef.current = prefetchManager;
    }
    return () => {
      prefetchManagerRef.current?.destroy();
      prefetchManagerRef.current = null;
    };
  }, [book]);

  // Set initial chapter and register relocated listener when rendition is available
  useEffect(() => {
    if (!rendition || !adapterRef.current) return;

    const initialLocation = rendition.location;
    if (initialLocation?.start) {
      const startHref = initialLocation.start.href ?? null;
      currentChapterRef.current = startHref;
      setCurrentChapter(startHref);
      void prefetchManagerRef.current?.onChapterChange(startHref ?? '');
    }

    const adapter = adapterRef.current;

    rendition.on(
      'relocated',
      createRelocatedSetup({
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
        setChapter,
        markPageRead,
      }),
    );

    return () => {
      // Flush progress on unmount / change
      void progressFlushRef.current?.();
      progressFlushRef.current = null;
    };
  }, [
    rendition,
    bookId,
    sessionToken,
    setCurrentChapter,
    toc,
    highlightsRef,
    commentsRef,
    onNavigateToAnnotationRef,
    adapterRef,
    setChapter,
    markPageRead,
  ]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!rendition) return;

      const isRtl =
        bookDirection === 'rtl' ||
        (bookDirection === 'default' && document.documentElement.dir === 'rtl');
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
  }, [rendition, bookDirection]);

  return {
    currentChapterRef,
    prefetchManagerRef,
    progressFlushRef,
  };
}

import { useRef } from 'react';
import type { Book, Rendition } from '@intity/epub-js';
import type { AnnotationAdapter, HighlightRecord, CommentRecord } from '@do-epub-studio/reader-core';
import type { BookInfo } from '../lib/epub-init';
import { useEpubLoader } from './useEpubLoader';
import { useEpubRendition } from './useEpubRendition';
import { useEpubAnnotationBridge } from './useEpubAnnotationBridge';
import { useEpubNavigation } from './useEpubNavigation';

export interface UseReaderEpubResult {
  bookRef: React.MutableRefObject<Book | null>;
  renditionRef: React.MutableRefObject<Rendition | null>;
  currentChapterRef: React.MutableRefObject<string | null>;
  adapterRef: React.MutableRefObject<AnnotationAdapter | null>;
  toc: ReturnType<typeof useEpubLoader>['toc'];
  resolvedTheme: ReturnType<typeof useEpubRendition>['resolvedTheme'];
  metadata: BookInfo | null;
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
): UseReaderEpubResult {
  const onNavigateToAnnotationRef = useRef(onNavigateToAnnotation);
  onNavigateToAnnotationRef.current = onNavigateToAnnotation;
  const currentChapterRef = useRef<string | null>(null);

  const loader = useEpubLoader(epubUrl);
  const rendition = useEpubRendition({
    book: loader.book,
    viewerRef,
    rootRef,
    bookDirection: loader.bookDirection,
    isFixedLayout: loader.isFixedLayout,
    fixedLayoutViewport: loader.fixedLayoutViewport,
    fixedLayoutSpread: loader.fixedLayoutSpread,
    initialProgressCfi: progressCfi,
  });

  const { adapterRef } = useEpubAnnotationBridge({
    rendition: rendition.rendition,
    highlightsRef,
    commentsRef,
    currentChapterRef,
    onNavigateToAnnotationRef,
  });

  useEpubNavigation({
    rendition: rendition.rendition,
    book: loader.book,
    toc: loader.toc,
    bookDirection: loader.bookDirection,
    highlightsRef,
    commentsRef,
    onNavigateToAnnotationRef,
    adapterRef,
    markPageRead,
    setChapter,
  });

  return {
    bookRef: loader.bookRef,
    renditionRef: rendition.renditionRef,
    currentChapterRef,
    adapterRef,
    toc: loader.toc,
    resolvedTheme: rendition.resolvedTheme,
    metadata: loader.metadata,
  };
}

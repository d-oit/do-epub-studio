import { useRef, useMemo } from 'react';
import type { Rendition } from '@intity/epub-js';
import type {
  AnnotationAdapter,
  HighlightRecord,
  CommentRecord,
} from '@do-epub-studio/reader-core';
import type { ReaderZoom } from '../../../stores';
import { useAuthStore, usePreferencesStore } from '../../../stores';
import { useTranslation } from '../../../hooks/useTranslation';
import { isSystemDark } from './useReaderEpub.helpers';
import { useEpubLoader } from './useEpubLoader';
import { useEpubRendition } from './useEpubRendition';
import { useEpubAnnotationBridge } from './useEpubAnnotationBridge';
import { useEpubNavigation } from './useEpubNavigation';

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
  const readerTheme = usePreferencesStore((s) => s.reader.theme);
  const { t } = useTranslation();
  const renditionRef = useRef<Rendition | null>(null);
  const currentChapterRef = useRef<string | null>(null);
  const adapterRef = useRef<AnnotationAdapter | null>(null);
  const progressFlushRef = useRef<(() => Promise<void>) | null>(null);
  const onNavigateToAnnotationRef = useRef(onNavigateToAnnotation);
  onNavigateToAnnotationRef.current = onNavigateToAnnotation;
  const zoomRef = useRef<ReaderZoom>(1);

  const { bookRef, loadedEpub, toc, metadata, directionRef, fixedLayoutRef, prefetchManagerRef } =
    useEpubLoader({ epubUrl, bookId, t });

  const rendition = useEpubRendition({
    bookId,
    loadedEpub,
    viewerRef,
    rootRef,
    renditionRef,
    adapterRef,
    fixedLayoutRef,
    zoomRef,
    progressFlushRef,
    t,
  });

  const scheduleAnnotations = useEpubAnnotationBridge({
    rendition,
    adapterRef,
    currentChapterRef,
    highlightsRef,
    commentsRef,
    onNavigateToAnnotationRef,
  });

  useEpubNavigation({
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
  });

  const resolvedTheme = useMemo(
    () => (readerTheme === 'system' ? (isSystemDark() ? 'dark' : 'light') : readerTheme),
    [readerTheme],
  );

  return { bookRef, renditionRef, currentChapterRef, adapterRef, toc, resolvedTheme, metadata };
}

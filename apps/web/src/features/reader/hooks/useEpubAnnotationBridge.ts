import { useCallback, useEffect, useRef } from 'react';
import type { Rendition } from '@intity/epub-js';
import type { MutableRefObject } from 'react';
import type {
  AnnotationAdapter,
  HighlightRecord,
  CommentRecord,
} from '@do-epub-studio/reader-core';
import type { AnnotationNavigation } from './useEpubNavigation';

interface AnnotationBridgeOptions {
  rendition: Rendition | null;
  adapterRef: MutableRefObject<AnnotationAdapter | null>;
  currentChapterRef: MutableRefObject<string | null>;
  highlightsRef: MutableRefObject<HighlightRecord[]>;
  commentsRef: MutableRefObject<CommentRecord[]>;
  onNavigateToAnnotationRef: MutableRefObject<AnnotationNavigation>;
}

export function useEpubAnnotationBridge({
  rendition,
  adapterRef,
  currentChapterRef,
  highlightsRef,
  commentsRef,
  onNavigateToAnnotationRef,
}: AnnotationBridgeOptions): () => void {
  const callbacks = useRef({
    rendition,
    adapterRef,
    currentChapterRef,
    highlightsRef,
    commentsRef,
    onNavigateToAnnotationRef,
  });
  callbacks.current = {
    rendition,
    adapterRef,
    currentChapterRef,
    highlightsRef,
    commentsRef,
    onNavigateToAnnotationRef,
  };

  const scheduleAnnotations = useCallback(() => {
    const current = callbacks.current;
    const chapterHref = current.rendition?.location?.start?.href;
    if (chapterHref) current.currentChapterRef.current = chapterHref;
    current.adapterRef.current?.scheduleRender(
      current.currentChapterRef.current,
      current.highlightsRef.current,
      current.commentsRef.current,
      current.onNavigateToAnnotationRef.current,
    );
  }, []);

  useEffect(() => {
    if (!rendition || !adapterRef.current) return;
    rendition.on('displayed', scheduleAnnotations);
    return () => {
      rendition.off('displayed', scheduleAnnotations);
    };
  }, [rendition, adapterRef, scheduleAnnotations]);

  return scheduleAnnotations;
}

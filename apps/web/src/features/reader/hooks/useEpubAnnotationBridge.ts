import { useEffect, useRef } from 'react';
import type { Rendition } from '@intity/epub-js';
import {
  createEpubAnnotationAdapter,
  type AnnotationAdapter,
  type HighlightRecord,
  type CommentRecord,
} from '@do-epub-studio/reader-core';
import type { OnNavigateToAnnotation } from './useReaderEpub.helpers';

export interface UseEpubAnnotationBridgeOptions {
  rendition: Rendition | null;
  highlightsRef: React.MutableRefObject<HighlightRecord[]>;
  commentsRef: React.MutableRefObject<CommentRecord[]>;
  currentChapterRef: React.MutableRefObject<string | null>;
  onNavigateToAnnotationRef: React.MutableRefObject<OnNavigateToAnnotation>;
}

export interface UseEpubAnnotationBridgeResult {
  adapterRef: React.MutableRefObject<AnnotationAdapter | null>;
}

export function useEpubAnnotationBridge({
  rendition,
  highlightsRef,
  commentsRef,
  currentChapterRef,
  onNavigateToAnnotationRef,
}: UseEpubAnnotationBridgeOptions): UseEpubAnnotationBridgeResult {
  const adapterRef = useRef<AnnotationAdapter | null>(null);

  useEffect(() => {
    if (!rendition) {
      adapterRef.current = null;
      return;
    }

    const adapter = createEpubAnnotationAdapter(rendition);
    adapterRef.current = adapter;

    adapter.scheduleRender(
      currentChapterRef.current,
      highlightsRef.current,
      commentsRef.current,
      onNavigateToAnnotationRef.current,
    );

    const onDisplayed = () => {
      adapter.scheduleRender(
        currentChapterRef.current,
        highlightsRef.current,
        commentsRef.current,
        onNavigateToAnnotationRef.current,
      );
    };

    rendition.on('displayed', onDisplayed);

    return () => {
      adapter.clearAnnotations();
      adapter.cancelScheduledRender();
      adapterRef.current = null;
    };
  }, [rendition, highlightsRef, commentsRef, currentChapterRef, onNavigateToAnnotationRef]);

  return { adapterRef };
}

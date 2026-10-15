/* eslint-disable react-compiler/react-compiler */
import { useEffect, useRef, useState } from 'react';
import type { Rendition } from '@intity/epub-js';
import type { MutableRefObject, RefObject } from 'react';
import type { PageDirection, ReaderZoom } from '../../../stores';
import type { EpubRenditionInternals } from '../lib/epub-internals';
import { createEpubAnnotationAdapter, type AnnotationAdapter } from '@do-epub-studio/reader-core';
import { createSpanId, createTraceId } from '@do-epub-studio/shared';
import {
  logClientEvent,
  observePerformance,
  reportPerformanceMetrics,
} from '../../../lib/client-logger';
import { getPrefersReducedMotion } from '../../../lib/reduced-motion';
import { usePreferencesStore, useReaderStore } from '../../../stores';
import {
  applyFixedLayoutZoomStyle,
  createThemeApplier,
  registerRenditionContentHooks,
} from './useReaderEpub.helpers';
import { applyDirectionAndWritingMode } from '../lib/epub-init';
import { resolveEffectiveSpread } from '../lib/epub-presentation';
import type { LoadedEpub } from './useEpubLoader';
import type { TFunction as TranslationFunction } from '../../../hooks/useTranslation';

interface EpubRenditionOptions {
  bookId: string | null;
  loadedEpub: LoadedEpub | null;
  viewerRef: RefObject<HTMLDivElement | null>;
  rootRef: RefObject<HTMLDivElement | null>;
  renditionRef: MutableRefObject<Rendition | null>;
  adapterRef: MutableRefObject<AnnotationAdapter | null>;
  fixedLayoutRef: MutableRefObject<boolean>;
  zoomRef: MutableRefObject<ReaderZoom>;
  progressFlushRef: MutableRefObject<(() => Promise<void>) | null>;
  t: TranslationFunction;
}

export function useEpubRendition({
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
}: EpubRenditionOptions): Rendition | null {
  const [rendition, setRendition] = useState<Rendition | null>(null);
  const setError = useReaderStore((state) => state.setError);
  const readerTheme = usePreferencesStore((state) => state.reader.theme);
  const readerFontSize = usePreferencesStore((state) => state.reader.fontSize);
  const readerFontFamily = usePreferencesStore((state) => state.reader.fontFamily);
  const readerLineHeight = usePreferencesStore((state) => state.reader.lineHeight);
  const readerDirection = usePreferencesStore((state) => state.reader.direction);
  const readerWritingMode = usePreferencesStore((state) => state.reader.writingMode);
  const readerSpread = useReaderStore((state) => state.readerSpread);
  const readerZoom = useReaderStore((state) => state.readerZoom);
  const translationRef = useRef(t);
  translationRef.current = t;
  zoomRef.current = readerZoom;
  const applyThemeRef = useRef<(current: Rendition) => void>(() => {});
  applyThemeRef.current = createThemeApplier({
    rootRef,
    readerTheme,
    fixedLayoutRef,
    readerFontSize,
    readerLineHeight,
    readerFontFamily,
  });

  useEffect(() => {
    setRendition(null);
    if (!loadedEpub) return;
    const viewer = viewerRef.current;
    if (!viewer) return;

    let active = true;
    let createdRendition: Rendition | null = null;
    let createdAdapter: AnnotationAdapter | null = null;
    try {
      const { book, direction, presentation } = loadedEpub;
      createdRendition = book.renderTo(viewer, {
        width: '100%',
        height: '100%',
        spread: resolveEffectiveSpread(
          presentation.fixedLayout,
          presentation.fixedLayoutSpread,
          direction,
        ),
        sandbox: ['allow-same-origin'],
        defaultDirection: direction === 'default' ? undefined : direction,
      });
      registerRenditionContentHooks(createdRendition, {
        fixedLayout: presentation.fixedLayout,
        fixedLayoutViewport: presentation.fixedLayoutViewport,
        zoomRef,
      });
      renditionRef.current = createdRendition;
      createdAdapter = createEpubAnnotationAdapter(createdRendition);
      adapterRef.current = createdAdapter;
      setRendition(createdRendition);
    } catch (caught) {
      const error = caught instanceof Error ? caught : new Error(String(caught));
      if (!active) return;
      logClientEvent({
        level: 'error',
        event: 'reader.epub_init_failed',
        traceId: createTraceId(),
        spanId: createSpanId(),
        error: { name: error.name, message: error.message, stack: error.stack },
        metadata: { bookId },
      });
      setError(translationRef.current('reader.loadError'));
    }

    return () => {
      active = false;
      if (createdAdapter) {
        createdAdapter.clearAnnotations();
        createdAdapter.cancelScheduledRender();
        if (adapterRef.current === createdAdapter) adapterRef.current = null;
      }
      void progressFlushRef.current?.();
      progressFlushRef.current = null;
      if (createdRendition) {
        createdRendition.destroy();
        if (renditionRef.current === createdRendition) renditionRef.current = null;
      }
    };
  }, [
    loadedEpub,
    viewerRef,
    renditionRef,
    adapterRef,
    fixedLayoutRef,
    zoomRef,
    progressFlushRef,
    setError,
    bookId,
  ]);

  useEffect(() => {
    if (rendition) applyThemeRef.current(rendition);
  }, [rendition, readerTheme, readerFontSize, readerFontFamily, readerLineHeight]);

  useEffect(() => {
    if (!rendition || !loadedEpub) return;
    const direction: PageDirection =
      readerDirection !== 'default' ? readerDirection : loadedEpub.direction;
    applyDirectionAndWritingMode(rendition, direction, readerWritingMode);
  }, [rendition, loadedEpub, readerDirection, readerWritingMode]);

  useEffect(() => {
    if (!rendition || !fixedLayoutRef.current) return;
    const layout = (rendition as EpubRenditionInternals).layout?.settings;
    if (layout) layout.spread = readerSpread;
    const cfi = rendition.location?.start?.cfi;
    if (cfi) void rendition.display(cfi);
  }, [readerSpread, rendition, fixedLayoutRef]);

  useEffect(() => {
    if (!rendition || !fixedLayoutRef.current) return;
    const contents = (rendition as EpubRenditionInternals)._contents;
    if (!Array.isArray(contents)) return;
    const transition = getPrefersReducedMotion() ? 'none' : 'transform 0.18s ease-out';
    contents.forEach((item) => {
      if (item.document?.documentElement) {
        applyFixedLayoutZoomStyle(item.document, zoomRef.current.toFixed(2), transition);
      }
    });
  }, [readerZoom, rendition, fixedLayoutRef, zoomRef]);

  useEffect(() => {
    if (readerTheme !== 'system' || !rendition) return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => {
      if (rendition) applyThemeRef.current(rendition);
    };
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [readerTheme, rendition]);

  useEffect(() => {
    const observer = observePerformance((entry) => {
      if (entry.entryType === 'measure') {
        logClientEvent({
          level: 'info',
          traceId: createTraceId(),
          spanId: createSpanId(),
          event: entry.name,
          metadata: { durationMs: Math.round(entry.duration) },
        });
      }
    });
    return () => {
      reportPerformanceMetrics('reader:load', (metrics) =>
        logClientEvent({
          level: 'info',
          traceId: createTraceId(),
          spanId: createSpanId(),
          event: 'reader:perf_summary',
          metadata: { p50: metrics.p50, p95: metrics.p95, p99: metrics.p99, count: metrics.count },
        }),
      );
      observer?.disconnect();
    };
  }, []);

  return rendition;
}

import { useEffect, useRef, useState } from 'react';
import type { Contents, Rendition } from '@intity/epub-js';
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
import { applyDirection } from '../lib/epub-init';
import { resolveEffectiveSpread } from '../lib/epub-presentation';
import type { LoadedEpub } from './useEpubLoader';

/** Characters per generated location point: fine enough for a percentage bar. */
const LOCATION_CHARS_PER_POINT = 150;
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

function registerIntraPublicationCfiLinks(rendition: Rendition): void {
  rendition.hooks.content.register((contents: Contents) => {
    const contentDocument = contents.document;
    if (!contentDocument) return;

    const handleClick = (event: MouseEvent): void => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target as Element | null;
      if (!target || typeof target.closest !== 'function') return;
      const link = target.closest('a[href]');
      if (!link || link.hasAttribute('download')) return;
      const targetWindow = link.getAttribute('target');
      if (targetWindow && targetWindow !== '_self') return;

      const href = link.getAttribute('href');
      const hashIndex = href?.indexOf('#') ?? -1;
      if (href === null || hashIndex <= 0) return;
      const resource = href.slice(0, hashIndex);
      const slashIndex = resource.indexOf('/');
      const colonIndex = resource.indexOf(':');
      if (
        resource.startsWith('/') ||
        resource.startsWith('\\') ||
        resource.includes('\\') ||
        resource.includes('?') ||
        (colonIndex >= 0 && (slashIndex < 0 || colonIndex < slashIndex))
      ) {
        return;
      }

      let cfi: string;
      try {
        cfi = decodeURIComponent(href.slice(hashIndex + 1));
      } catch {
        return;
      }
      if (cfi.length > 2048 || !cfi.startsWith('epubcfi(') || !cfi.endsWith(')')) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      void rendition.display(cfi).catch((caught: unknown) => {
        const error = caught instanceof Error ? caught : new Error(String(caught));
        logClientEvent({
          level: 'warn',
          event: 'reader.cfi_link_navigation_failed',
          traceId: createTraceId(),
          spanId: createSpanId(),
          error: { name: error.name, message: error.message },
          metadata: { cfiLength: cfi.length },
        });
      });
    };

    contentDocument.addEventListener('click', handleClick, true);
  });
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
    readerWritingMode,
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
      registerIntraPublicationCfiLinks(createdRendition);
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
        try {
          createdRendition.destroy();
        } catch {
          // epub.js rendition.destroy() can throw if internal hooks/views are already cleared
        }
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

  // Percentage-based progress (reader header, library "in progress" label)
  // requires `book.locations`; without it every relocation reports
  // `percentage: undefined` and the stored value stays 0%. Generate after the
  // first paint so opening a book is not blocked, then re-report the current
  // position so the percentage lands immediately.
  useEffect(() => {
    if (!loadedEpub || loadedEpub.presentation.fixedLayout) return;
    const { book } = loadedEpub;
    if (book.locations.size > 0) return;
    let cancelled = false;
    void book.locations
      .generate(LOCATION_CHARS_PER_POINT)
      .then(() => {
        if (cancelled) return;
        logClientEvent({
          level: 'info',
          traceId: createTraceId(),
          spanId: createSpanId(),
          event: 'reader.locations_ready',
          metadata: { bookId, count: book.locations.size },
        });
        // The engine types mark `reportLocation` private, though it is the
        // documented way to re-emit the current relocation.
        const current = renditionRef.current as unknown as {
          reportLocation?: () => Promise<void>;
        } | null;
        void current?.reportLocation?.();
      })
      .catch((caught: unknown) => {
        const error = caught instanceof Error ? caught : new Error(String(caught));
        logClientEvent({
          level: 'warn',
          traceId: createTraceId(),
          spanId: createSpanId(),
          event: 'reader.locations_failed',
          error: { name: error.name, message: error.message },
          metadata: { bookId },
        });
      });
    return () => {
      cancelled = true;
    };
  }, [loadedEpub, bookId, renditionRef]);

  useEffect(() => {
    if (!rendition) return;
    applyThemeRef.current(rendition);
    // The first section can render before this effect registers the theme
    // (the engine's inject hook then had nothing to append), so saved
    // preferences were ignored until the reader changed one. Re-apply once the
    // first content exists.
    if (rendition.getContents().length > 0) return;
    const applyOnFirstContent = () => {
      if (rendition.getContents().length === 0) return;
      applyThemeRef.current(rendition);
      rendition.off('rendered', applyOnFirstContent);
    };
    rendition.on('rendered', applyOnFirstContent);
    return () => {
      rendition.off('rendered', applyOnFirstContent);
    };
  }, [
    rendition,
    readerTheme,
    readerFontSize,
    readerFontFamily,
    readerLineHeight,
    readerWritingMode,
  ]);

  useEffect(() => {
    if (!rendition || !loadedEpub) return;
    const direction: PageDirection =
      readerDirection !== 'default' ? readerDirection : loadedEpub.direction;
    applyDirection(rendition, direction);
  }, [rendition, loadedEpub, readerDirection, readerWritingMode]);
  /* eslint-disable react-hooks/immutability -- epubjs mutable rendition layout settings */
  useEffect(() => {
    if (!rendition || !fixedLayoutRef.current) return;
    const layout = (rendition as EpubRenditionInternals).layout?.settings;
    if (layout) layout.spread = readerSpread;
    const cfi = rendition.location?.start?.cfi;
    if (cfi) void rendition.display(cfi);
  }, [readerSpread, rendition, fixedLayoutRef]);
  /* eslint-enable react-hooks/immutability */

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

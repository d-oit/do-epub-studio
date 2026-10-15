import { useEffect, useRef, useState } from 'react';
import type { Book, Rendition } from '@intity/epub-js';
import type { EpubRenditionInternals } from '../lib/epub-internals';
import type { PageDirection, ReaderZoom } from '../../../stores';
import { createSpanId, createTraceId } from '@do-epub-studio/shared';
import {
  logClientEvent,
  createPerformanceMark,
  measurePerformance,
} from '../../../lib/client-logger';
import { getPrefersReducedMotion } from '../../../lib/reduced-motion';
import { useAuthStore, useReaderStore, usePreferencesStore } from '../../../stores';
import {
  applyFixedLayoutZoomStyle,
  createThemeApplier,
  isSystemDark,
  parseableCfi,
  registerRenditionContentHooks,
} from './useReaderEpub.helpers';
import { applyDirectionAndWritingMode } from '../lib/epub-init';
import { resolveEffectiveSpread } from '../lib/epub-presentation';

export interface UseEpubRenditionOptions {
  book: Book | null;
  viewerRef: React.RefObject<HTMLDivElement | null>;
  rootRef: React.RefObject<HTMLDivElement | null>;
  bookDirection: PageDirection;
  isFixedLayout: boolean;
  fixedLayoutViewport?: string | null;
  fixedLayoutSpread?: string;
  initialProgressCfi?: string;
}

export interface UseEpubRenditionResult {
  rendition: Rendition | null;
  renditionRef: React.MutableRefObject<Rendition | null>;
  resolvedTheme: 'light' | 'dark' | 'sepia';
  fixedLayoutRef: React.MutableRefObject<boolean>;
  zoomRef: React.MutableRefObject<ReaderZoom>;
  applyThemesRef: React.MutableRefObject<(rendition: Rendition) => void>;
}

export function useEpubRendition({
  book,
  viewerRef,
  rootRef,
  bookDirection,
  isFixedLayout,
  fixedLayoutViewport,
  fixedLayoutSpread,
  initialProgressCfi,
}: UseEpubRenditionOptions): UseEpubRenditionResult {
  const bookId = useAuthStore((s) => s.bookId);
  const readerSpread = useReaderStore((s) => s.readerSpread);
  const readerZoom = useReaderStore((s) => s.readerZoom);
  const readerTheme = usePreferencesStore((s) => s.reader.theme);
  const readerFontSize = usePreferencesStore((s) => s.reader.fontSize);
  const readerFontFamily = usePreferencesStore((s) => s.reader.fontFamily);
  const readerLineHeight = usePreferencesStore((s) => s.reader.lineHeight);
  const readerDirection = usePreferencesStore((s) => s.reader.direction);
  const readerWritingMode = usePreferencesStore((s) => s.reader.writingMode);

  const [rendition, setRendition] = useState<Rendition | null>(null);
  const renditionRef = useRef<Rendition | null>(null);

  const fixedLayoutRef = useRef(isFixedLayout);
  fixedLayoutRef.current = isFixedLayout;

  const zoomRef = useRef<ReaderZoom>(readerZoom);
  zoomRef.current = readerZoom;

  const progressCfiRef = useRef(initialProgressCfi);
  progressCfiRef.current = initialProgressCfi;

  const resolvedTheme =
    readerTheme === 'system' ? (isSystemDark() ? 'dark' : 'light') : readerTheme;

  const applyThemesRef = useRef<(renditionInstance: Rendition) => void>(() => {
    /* noop */
  });
  applyThemesRef.current = createThemeApplier({
    rootRef,
    readerTheme,
    fixedLayoutRef,
    readerFontSize,
    readerLineHeight,
    readerFontFamily,
  });

  useEffect(() => {
    if (!book || !viewerRef.current) {
      setRendition(null);
      renditionRef.current = null;
      return;
    }

    let active = true;
    const viewer = viewerRef.current;

    const initRendition = async () => {
      const effectiveSpread = resolveEffectiveSpread(
        isFixedLayout,
        fixedLayoutSpread,
        bookDirection,
      );

      const createdRendition = book.renderTo(viewer, {
        width: '100%',
        height: '100%',
        spread: effectiveSpread,
        sandbox: ['allow-same-origin'],
        defaultDirection: bookDirection === 'default' ? undefined : bookDirection,
      });

      if (!active) {
        createdRendition.destroy();
        return;
      }

      renditionRef.current = createdRendition;

      registerRenditionContentHooks(createdRendition, {
        fixedLayout: isFixedLayout,
        fixedLayoutViewport,
        zoomRef,
      });

      applyThemesRef.current(createdRendition);

      applyDirectionAndWritingMode(
        createdRendition,
        readerDirection !== 'default' ? readerDirection : bookDirection,
        readerWritingMode,
      );

      const startCfi = progressCfiRef.current;
      const displayCfi = parseableCfi(startCfi);
      if (startCfi && !displayCfi) {
        logClientEvent({
          level: 'warn',
          event: 'reader.progress_cfi_invalid',
          traceId: createTraceId(),
          spanId: createSpanId(),
          metadata: { bookId },
        });
      }

      try {
        await createdRendition.display(displayCfi);
      } catch (error) {
        logClientEvent({
          level: 'warn',
          event: 'reader.display_fallback',
          traceId: createTraceId(),
          spanId: createSpanId(),
          error:
            error instanceof Error
              ? { name: error.name, message: error.message }
              : { name: 'Error', message: String(error) },
        });
        await createdRendition.display();
      }

      if (!active) return;

      // Record time-to-first-display telemetry mark
      createPerformanceMark('reader:load-end');
      const loadMs = measurePerformance('reader:load', 'reader:load-start', 'reader:load-end');
      if (loadMs !== undefined) {
        logClientEvent({
          level: 'info',
          traceId: createTraceId(),
          spanId: createSpanId(),
          event: 'reader:load',
          metadata: { durationMs: Math.round(loadMs) },
        });
      }

      setRendition(createdRendition);
    };

    void initRendition();

    return () => {
      active = false;
      renditionRef.current?.destroy();
      renditionRef.current = null;
      setRendition(null);
    };
  }, [
    book,
    viewerRef,
    bookDirection,
    isFixedLayout,
    fixedLayoutViewport,
    fixedLayoutSpread,
    readerDirection,
    readerWritingMode,
    bookId,
  ]);

  // Re-apply themes on preference changes
  useEffect(() => {
    if (renditionRef.current) applyThemesRef.current(renditionRef.current);
  }, [resolvedTheme, readerFontSize, readerLineHeight, readerFontFamily]);

  // Sync direction & writing mode
  useEffect(() => {
    if (!renditionRef.current) return;
    const dir = readerDirection !== 'default' ? readerDirection : bookDirection;
    applyDirectionAndWritingMode(renditionRef.current, dir, readerWritingMode);
  }, [readerDirection, readerWritingMode, bookDirection]);

  // Sync spread mode
  useEffect(() => {
    const activeRendition = renditionRef.current;
    if (!activeRendition || !fixedLayoutRef.current) return;
    const renditionWithLayout = activeRendition as EpubRenditionInternals;
    const layoutSettings = renditionWithLayout.layout?.settings;
    if (layoutSettings) {
      layoutSettings.spread = readerSpread;
    }
    const currentCfi = activeRendition.location?.start?.cfi;
    if (currentCfi) {
      void activeRendition.display(currentCfi);
    }
  }, [readerSpread]);

  // Sync zoom styling
  useEffect(() => {
    if (!fixedLayoutRef.current) return;
    const activeRendition = renditionRef.current;
    if (!activeRendition) return;
    const contentsList = (activeRendition as EpubRenditionInternals)._contents;
    if (!Array.isArray(contentsList)) return;
    const reducedMotion = getPrefersReducedMotion();
    const transition = reducedMotion ? 'none' : 'transform 0.18s ease-out';
    const scale = zoomRef.current.toFixed(2);
    contentsList.forEach((contents) => {
      const doc = contents.document;
      if (!doc?.documentElement) return;
      applyFixedLayoutZoomStyle(doc, scale, transition);
    });
  }, [readerZoom]);

  // System dark-mode listener
  useEffect(() => {
    if (readerTheme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (renditionRef.current) applyThemesRef.current(renditionRef.current);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [readerTheme]);

  return {
    rendition,
    renditionRef,
    resolvedTheme,
    fixedLayoutRef,
    zoomRef,
    applyThemesRef,
  };
}

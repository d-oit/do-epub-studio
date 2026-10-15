import { useEffect, useRef, useState } from 'react';
import type { Book, NavItem } from '@intity/epub-js';
import type { PageDirection } from '../../../stores';
import { createEpubLoader } from '@do-epub-studio/reader-core';
import { createSpanId, createTraceId } from '@do-epub-studio/shared';
import {
  logClientEvent,
  createPerformanceMark,
  observePerformance,
  reportPerformanceMetrics,
} from '../../../lib/client-logger';
import { useAuthStore, useReaderStore } from '../../../stores';
import { useTranslation } from '../../../hooks/useTranslation';
import { resolveBookDirection } from './useReaderEpub.helpers';
import { type TocItem, type BookInfo } from '../lib/epub-init';
import { resolveBookPresentation } from '../lib/epub-presentation';

export interface UseEpubLoaderResult {
  book: Book | null;
  bookRef: React.MutableRefObject<Book | null>;
  loaderRef: React.MutableRefObject<ReturnType<typeof createEpubLoader> | null>;
  toc: TocItem[];
  tocRef: React.MutableRefObject<TocItem[]>;
  metadata: BookInfo | null;
  bookDirection: PageDirection;
  isFixedLayout: boolean;
  fixedLayoutViewport?: string | null;
  fixedLayoutSpread?: string;
  isLoading: boolean;
}

export function useEpubLoader(epubUrl: string | null): UseEpubLoaderResult {
  const bookId = useAuthStore((s) => s.bookId);
  const setError = useReaderStore((s) => s.setError);
  const setBookDirection = useReaderStore((s) => s.setBookDirection);
  const setIsFixedLayout = useReaderStore((s) => s.setIsFixedLayout);
  const { t } = useTranslation();

  const [book, setBook] = useState<Book | null>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [metadata, setMetadata] = useState<BookInfo | null>(null);
  const [bookDirection, setDirectionState] = useState<PageDirection>('default');
  const [isFixedLayout, setIsFixedLayoutState] = useState<boolean>(false);
  const [fixedLayoutViewport, setFixedLayoutViewport] = useState<string | null | undefined>(undefined);
  const [fixedLayoutSpread, setFixedLayoutSpread] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const bookRef = useRef<Book | null>(null);
  const loaderRef = useRef<ReturnType<typeof createEpubLoader> | null>(null);
  const tocRef = useRef<TocItem[]>([]);

  useEffect(() => {
    if (!epubUrl) {
      setBook(null);
      bookRef.current = null;
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);

    const loadEpub = async () => {
      createPerformanceMark('reader:load-start');
      try {
        const loader = createEpubLoader();
        loaderRef.current = loader;
        await loader.load(epubUrl);
        const loadedBook = loader.getBook();
        if (!loadedBook) throw new Error('EPUB load returned no book');

        bookRef.current = loadedBook;
        await loadedBook.ready;
        if (!active) return;

        const [navigation, meta] = await Promise.all([
          loadedBook.loaded.navigation,
          loadedBook.loaded.metadata,
        ]);

        const tocItems: TocItem[] = navigation.toc
          ? navigation.toc.map((item: NavItem) => ({ label: item.label, href: item.href }))
          : [];
        setToc(tocItems);
        tocRef.current = tocItems;

        const resolvedDirection: PageDirection = resolveBookDirection(loadedBook);
        setDirectionState(resolvedDirection);
        setBookDirection(resolvedDirection);

        const presentation = await resolveBookPresentation(loadedBook, meta);
        const { bookInfo, fixedLayout, fixedLayoutSpread: resolvedSpread, fixedLayoutViewport: resolvedViewport } = presentation;

        if (fixedLayout) {
          setIsFixedLayoutState(true);
          setIsFixedLayout(true);
        } else {
          setIsFixedLayoutState(false);
        }

        setFixedLayoutViewport(resolvedViewport);
        setFixedLayoutSpread(resolvedSpread);
        setMetadata(bookInfo);

        setBook(loadedBook);
        setIsLoading(false);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        if (!active) {
          logClientEvent({
            level: 'info',
            event: 'reader.epub_init_aborted',
            traceId: createTraceId(),
            spanId: createSpanId(),
            error: { name: error.name, message: error.message },
            metadata: { bookId },
          });
          return;
        }

        logClientEvent({
          level: 'error',
          event: 'reader.epub_init_failed',
          traceId: createTraceId(),
          spanId: createSpanId(),
          error: { name: error.name, message: error.message, stack: error.stack },
          metadata: { bookId },
        });
        setError(t('reader.loadError'));
        setIsLoading(false);
      }
    };

    void loadEpub();

    return () => {
      active = false;
      loaderRef.current?.destroy();
      loaderRef.current = null;
      bookRef.current = null;
      setBook(null);
    };
  }, [epubUrl, bookId, setBookDirection, setIsFixedLayout, setError, t]);

  // Observe performance marks and report p50/p95/p99 on unmount.
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
      reportPerformanceMetrics('reader:load', (m) => {
        logClientEvent({
          level: 'info',
          traceId: createTraceId(),
          spanId: createSpanId(),
          event: 'reader:perf_summary',
          metadata: { p50: m.p50, p95: m.p95, p99: m.p99, count: m.count },
        });
      });
      observer?.disconnect();
    };
  }, []);

  return {
    book,
    bookRef,
    loaderRef,
    toc,
    tocRef,
    metadata,
    bookDirection,
    isFixedLayout,
    fixedLayoutViewport,
    fixedLayoutSpread,
    isLoading,
  };
}

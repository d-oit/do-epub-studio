import { useEffect, useRef, useState } from 'react';
import type { Book, NavItem } from '@intity/epub-js';
import { createEpubLoader } from '@do-epub-studio/reader-core';
import { createSpanId, createTraceId } from '@do-epub-studio/shared';
import { createPerformanceMark, logClientEvent } from '../../../lib/client-logger';
import { useReaderStore } from '../../../stores';
import type { PageDirection } from '../../../stores';
import type { TFunction as TranslationFunction } from '../../../hooks/useTranslation';
import { PrefetchManager } from '../../../lib/prefetch-manager';
import { collectSpineItems, resolveBookDirection } from './useReaderEpub.helpers';
import { resolveBookPresentation, type BookPresentation } from '../lib/epub-presentation';
import type { BookInfo, TocItem } from '../lib/epub-init';

export interface EpubLoader {
  load(url: string): Promise<void>;
  destroy(): void;
  getBook(): Book | null;
}

export interface LoadedEpub {
  book: Book;
  direction: PageDirection;
  presentation: BookPresentation;
  toc: TocItem[];
}

interface EpubLoaderOptions {
  epubUrl: string | null;
  bookId: string | null;
  t: TranslationFunction;
}

export function useEpubLoader({ epubUrl, bookId, t }: EpubLoaderOptions) {
  const setError = useReaderStore((state) => state.setError);
  const setBookDirection = useReaderStore((state) => state.setBookDirection);
  const setIsFixedLayout = useReaderStore((state) => state.setIsFixedLayout);
  const bookRef = useRef<Book | null>(null);
  const loaderRef = useRef<EpubLoader | null>(null);
  const directionRef = useRef<PageDirection>('default');
  const fixedLayoutRef = useRef(false);
  const prefetchManagerRef = useRef<PrefetchManager | null>(null);
  const translationRef = useRef(t);
  translationRef.current = t;
  const [loadedEpub, setLoadedEpub] = useState<LoadedEpub | null>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [metadata, setMetadata] = useState<BookInfo | null>(null);

  useEffect(() => {
    let active = true;
    setLoadedEpub(null);
    setToc([]);
    setMetadata(null);
    bookRef.current = null;
    directionRef.current = 'default';
    fixedLayoutRef.current = false;
    setBookDirection('default');
    setIsFixedLayout(false);

    if (!epubUrl)
      return () => {
        active = false;
      };

    createPerformanceMark('reader:load-start');
    const loader = createEpubLoader();
    loaderRef.current = loader;

    const load = async (): Promise<void> => {
      try {
        await loader.load(epubUrl);
        const book = loader.getBook();
        if (!book) throw new Error('EPUB load returned no book');
        bookRef.current = book;
        await book.ready;
        if (!active) return;

        const [navigation, rawMetadata] = await Promise.all([
          book.loaded.navigation,
          book.loaded.metadata,
        ]);
        const nextToc = navigation.toc
          ? navigation.toc.map((item: NavItem) => ({ label: item.label, href: item.href }))
          : [];
        const direction = resolveBookDirection(book);
        const presentation = await resolveBookPresentation(book, rawMetadata);
        if (!active) return;

        const spineItems = collectSpineItems(book);
        if (spineItems.length > 0) {
          const manager = new PrefetchManager();
          manager.setSpine(spineItems);
          prefetchManagerRef.current = manager;
        }

        directionRef.current = direction;
        fixedLayoutRef.current = presentation.fixedLayout;
        setBookDirection(direction);
        setIsFixedLayout(presentation.fixedLayout);
        setToc(nextToc);
        setMetadata(presentation.bookInfo);
        setLoadedEpub({ book, direction, presentation, toc: nextToc });
      } catch (caught) {
        const error = caught instanceof Error ? caught : new Error(String(caught));
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
        setError(translationRef.current('reader.loadError'));
      }
    };

    void load();
    return () => {
      active = false;
      prefetchManagerRef.current?.destroy();
      prefetchManagerRef.current = null;
      loader.destroy();
      if (loaderRef.current === loader) loaderRef.current = null;
      bookRef.current = null;
    };
  }, [epubUrl, bookId, setBookDirection, setError, setIsFixedLayout]);

  return {
    bookRef,
    loaderRef,
    loadedEpub,
    toc,
    metadata,
    directionRef,
    fixedLayoutRef,
    prefetchManagerRef,
  };
}

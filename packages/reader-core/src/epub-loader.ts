import ePub, { Book, Rendition, Location } from 'epubjs';
import type { SpineItem as EpubSpineItem } from 'epubjs/types/section';
import type {
  TocItem,
  SpineItem,
  BookMetadata,
  ProgressPosition,
} from './epub-types';

// Minimal telemetry helpers (mirrors packages/shared/src/telemetry)
function generateTraceId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

function generateSpanId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().split('-')[0] ?? Math.random().toString(36).slice(2, 10);
  }
  return Math.random().toString(36).slice(2, 12);
}

function formatError(error: unknown): { message: string; name: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { name: 'Error', message: String(error) };
}

type EventCallback = (data: unknown) => void;

export interface EpubRenditionHandle {
  display(target?: string): Promise<void>;
  prev(): Promise<void>;
  next(): Promise<void>;
  on(event: string, callback: EventCallback): void;
  off(event: string, callback: EventCallback): void;
  getContents(): unknown[];
}

export interface EpubLoader {
  load(url: string): Promise<void>;
  createRendition(container: HTMLElement): EpubRenditionHandle;
  destroy(): void;
  getMetadata(): BookMetadata;
  getToc(): TocItem[];
  getSpineItems(): SpineItem[];
  getProgress(): ProgressPosition | null;
  setProgress(cfi: string): Promise<void>;
  on(event: string, callback: EventCallback): void;
  off(event: string, callback: EventCallback): void;
  rendition: EpubRenditionHandle | null;
}

interface EpubLoaderOptions {
  onEvent?: (event: string, data: unknown) => void;
}

export function createEpubLoader(options?: EpubLoaderOptions): EpubLoader {
  let book: Book | null = null;
  let rendition: Rendition | null = null;
  let renditionHandle: EpubRenditionHandle | null = null;
  let toc: TocItem[] = [];
  let spineItems: SpineItem[] = [];
  let metadata: BookMetadata = { title: '' };
  let currentProgress: ProgressPosition | null = null;
  const eventListeners = new Map<string, Set<EventCallback>>();
  let destroyed = false;

  function emit(event: string, data: unknown): void {
    options?.onEvent?.(event, data);
    const listeners = eventListeners.get(event);
    if (listeners) {
      for (const cb of listeners) {
        cb(data);
      }
    }
  }

  function parseToc(
    navigationToc: Array<{
      label: string;
      href: string;
      subitems?: Array<{ label: string; href: string }>;
    }>,
  ): TocItem[] {
    return navigationToc.map((item, index) => ({
      id: item.href ?? `toc-${index}`,
      label: item.label,
      href: item.href,
      subitems: item.subitems?.map((sub) => ({
        id: sub.href ?? `toc-${index}-${sub.label}`,
        label: sub.label,
        href: sub.href,
      })),
    }));
  }

  async function parseSpineFromBook(): Promise<SpineItem[]> {
    const spineItems = await book!.loaded.spine;
    return spineItems.map((item: EpubSpineItem, index: number) => ({
      index: item.index ?? index,
      href: item.href ?? '',
      properties: item.properties?.join(' '),
    }));
  }

  async function load(url: string): Promise<void> {
    if (destroyed) {
      throw new Error('EpubLoader has been destroyed');
    }

    const traceId = generateTraceId();
    const spanId = generateSpanId();

    try {
      book = ePub(url);
      await book.opened;

      const nav = await book.loaded.navigation;
      if (nav?.toc) {
        toc = parseToc(
          nav.toc,
        );
      }

      spineItems = await parseSpineFromBook();

      const meta = await book.loaded.metadata;
      metadata = {
        title: meta.title ?? '',
        creator: meta.creator,
        language: meta.language,
        publisher: meta.publisher,
        description: meta.description,
      };
    } catch (error) {
      const formatted = formatError(error);
      console.error(
        `[epub-loader][trace:${traceId}][span:${spanId}] Failed to load EPUB: ${formatted.message}`,
      );
      throw new Error(`Failed to load EPUB: ${formatted.message}`);
    }
  }

  function createRenditionHandle(container: HTMLElement): EpubRenditionHandle {
    if (!book) {
      throw new Error('Book not loaded. Call load() first.');
    }
    if (rendition) {
      // Reuse existing rendition if already created
      return renditionHandle!;
    }

    rendition = book.renderTo(container, {
      width: '100%',
      height: '100%',
      spread: 'auto',
    });

    // Bridge rendition events to the loader's event system
    rendition.on('relocated', (location: Location) => {
      const progress: ProgressPosition = {
        cfi: location.start.cfi,
        percentage: location.start.percentage,
        displayed: {
          index: location.start.displayed?.page ?? 0,
          href: location.start.href,
        },
      };
      currentProgress = progress;
      emit('relocated', progress);
    });

    rendition.on('displayed', () => {
      emit('displayed', null);
    });

    rendition.on('attached', (data: unknown) => {
      emit('attached', data);
    });

    rendition.on('started', () => {
      emit('started', null);
    });

    renditionHandle = {
      async display(target?: string): Promise<void> {
        if (!rendition) {
          throw new Error('Rendition not initialized');
        }
        await rendition.display(target);
      },
      async prev(): Promise<void> {
        if (!rendition) {
          throw new Error('Rendition not initialized');
        }
        await rendition.prev();
      },
      async next(): Promise<void> {
        if (!rendition) {
          throw new Error('Rendition not initialized');
        }
        await rendition.next();
      },
      on(event: string, callback: EventCallback): void {
        if (!rendition) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- epubjs event callbacks have varying signatures
        rendition.on(event, callback as any);
      },
      off(event: string, callback: EventCallback): void {
        if (!rendition) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- epubjs event callbacks have varying signatures
        rendition.off(event, callback as any);
      },
      getContents(): unknown[] {
        if (!rendition) return [];
        try {
          const contents = rendition.getContents();
          // getContents() returns a single Contents object or undefined
          return contents ? [contents] : [];
        } catch {
          return [];
        }
      },
    };

    return renditionHandle;
  }

  return {
    load,
    createRendition: createRenditionHandle,
    destroy(): void {
      destroyed = true;
      try {
        rendition?.destroy();
      } catch {
        // Best-effort cleanup; rendition may already be destroyed
      }
      try {
        book?.destroy();
      } catch {
        // Best-effort cleanup; book may already be destroyed
      }
      rendition = null;
      renditionHandle = null;
      book = null;
      eventListeners.clear();
    },
    getMetadata(): BookMetadata {
      return { ...metadata };
    },
    getToc(): TocItem[] {
      return [...toc];
    },
    getSpineItems(): SpineItem[] {
      return [...spineItems];
    },
    getProgress(): ProgressPosition | null {
      return currentProgress ? { ...currentProgress } : null;
    },
    async setProgress(cfi: string): Promise<void> {
      if (!rendition) {
        throw new Error('Rendition not created. Call createRendition() first.');
      }
      await rendition.display(cfi);
    },
    on(event: string, callback: EventCallback): void {
      if (!eventListeners.has(event)) {
        eventListeners.set(event, new Set());
      }
      eventListeners.get(event)!.add(callback);
    },
    off(event: string, callback: EventCallback): void {
      eventListeners.get(event)?.delete(callback);
    },
    get rendition(): EpubRenditionHandle | null {
      return renditionHandle;
    },
  };
}

export function extractCfi(text: string): string | null {
  const match = /epubcfi\(\/[^)]+\)/.exec(text);
  return match?.[0] ?? null;
}

export function isValidCfi(cfi: string): boolean {
  return /^epubcfi\(\/\d+(?:\[\S+\])?(?:\/[^)]+)*\)$/.test(cfi);
}

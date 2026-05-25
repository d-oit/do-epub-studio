import ePub from '@intity/epub-js';
import type { Book, Rendition, Location, Contents } from '@intity/epub-js';
import type { SpineItem as EpubSpineItem } from '@intity/epub-js/types/section';
import type {
  TocItem,
  SpineItem,
  BookMetadata,
  ProgressPosition,
} from './epub-types';
import { createTraceId, createSpanId, serializeError, testBounded } from '@do-epub-studio/shared';
import { sanitizeEpubDocument } from './sanitizer';
import { validateArchive } from './archive-validator';

type EventCallback = (data: unknown) => void;

export interface EpubRenditionHandle {
  display(target?: string): Promise<void>;
  prev(): Promise<void>;
  next(): Promise<void>;
  on(event: string, callback: EventCallback): void;
  off(event: string, callback: EventCallback): void;
  getContents(): Contents[];
  registerContentHook(fn: (contents: Contents) => void): void;
  registerRenderHook(fn: (contents: Contents) => void): void;
}

export interface EpubLoader {
  load(url: string | Uint8Array): Promise<void>;
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
  flow?: 'paginated' | 'scrolled' | 'scrolled-doc';
  manager?: 'default' | 'continuous';
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

  function getSpineIterable(spine: unknown): EpubSpineItem[] {
    if (!spine) return [];
    if (Array.isArray(spine)) return spine as EpubSpineItem[];
    if (typeof (spine as Iterable<EpubSpineItem>)[Symbol.iterator] === 'function') {
      return Array.from(spine as Iterable<EpubSpineItem>);
    }
    return [];
  }

  async function parseSpineFromBook(): Promise<SpineItem[]> {
    if (!book) return [];
    const spine = await book.loaded.spine;
    const spineItems: SpineItem[] = [];
    let index = 0;
    for (const item of getSpineIterable(spine)) {
      spineItems.push({
        index: item.index ?? index,
        href: item.href ?? '',
        properties: item.properties?.join(' '),
      });
      index++;
    }
    return spineItems;
  }

  async function load(url: string | Uint8Array): Promise<void> {
    if (destroyed) {
      throw new Error('EpubLoader has been destroyed');
    }

    const traceId = createTraceId();
    const spanId = createSpanId();

    try {
      let data: Uint8Array;
      if (typeof url === 'string') {
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to fetch EPUB: ${response.statusText}`);
          }
          const buffer = await response.arrayBuffer();
          data = new Uint8Array(buffer);
        } else {
          // For tests or other cases where it might not be a full URL,
          // we should still try to validate if it's treated as a local path or similar.
          // In the browser, fetch('test.epub') would usually work relative to current origin.
          // But Node.js fetch might fail if not absolute.
          // Since this is reader-core and might run in both, let's be careful.
          try {
            const response = await fetch(url);
            if (!response.ok) {
              throw new Error(`Failed to fetch EPUB: ${response.statusText}`);
            }
            const buffer = await response.arrayBuffer();
            data = new Uint8Array(buffer);
          } catch (e) {
            // Fallback for mock/test cases if they don't want to fetch
            // But we NEED data to validate.
            throw new Error(`Failed to fetch EPUB from ${url}`, { cause: e });
          }
        }
      } else {
        data = url;
      }

      await validateArchive(data);

      book = ePub(data.buffer as ArrayBuffer);
      await book.opened;

      // Register content sanitization hook
      book.sections.hooks.content.register((doc: Document) => {
        sanitizeEpubDocument(doc);
      });

      const nav = await book.loaded.navigation;
      if (nav?.toc) {
        toc = parseToc(
          nav.toc,
        );
      }

      spineItems = await parseSpineFromBook();

      const meta = await book.loaded.metadata;
      const metaMap = meta as Map<string, string>;
      metadata = {
        title: metaMap.get('title') ?? '',
        creator: metaMap.get('creator'),
        language: metaMap.get('language'),
        publisher: metaMap.get('publisher'),
        description: metaMap.get('description'),
      };
    } catch (error) {
      const formatted = serializeError(error);
      console.error(
        `[epub-loader][trace:${traceId}][span:${spanId}] Failed to load EPUB: ${formatted.message}`,
      );
      throw new Error(`Failed to load EPUB: ${formatted.message}`, { cause: error });
    }
  }

  function createRenditionHandle(container: HTMLElement): EpubRenditionHandle {
    if (!book) {
      throw new Error('Book not loaded. Call load() first.');
    }
    if (rendition) {
      // renditionHandle is guaranteed set here since rendition exists
      return renditionHandle as EpubRenditionHandle;
    }

    rendition = book.renderTo(container, {
      width: '100%',
      height: '100%',
      spread: 'auto',
      sandbox: ['allow-scripts'],
      flow: options?.flow,
      manager: options?.manager,
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
      getContents(): Contents[] {
        if (!rendition) return [];
        try {
          return rendition.getContents();
        } catch {
          return [];
        }
      },
      registerContentHook(fn: (contents: Contents) => void): void {
        if (!rendition) return;
        rendition.hooks.content.register(fn);
      },
      registerRenderHook(fn: (contents: Contents) => void): void {
        if (!rendition) return;
        rendition.hooks.render.register(fn);
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
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- listeners was just set guard above
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
  if (text.length > 2048) return null;
  const match = text.match(/epubcfi\([^)]{1,1024}\)/);
  return match?.[0] ?? null;
}

export function isValidCfi(cfi: string): boolean {
  const SIMPLE_CFI_RE = /^epubcfi\([^()]{1,1024}\)$/;
  return testBounded(SIMPLE_CFI_RE, cfi, 1024);
}

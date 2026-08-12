import ePub from '@intity/epub-js';
import type { Book, Rendition, Contents } from '@intity/epub-js';
// epub-js 0.3.97 dropped the named `SpineItem` export from types/section; the
// loader only needs the index/href/properties slice it reads off each item.
interface EpubSpineItem {
  index?: number;
  href?: string;
  properties?: string[];
}

// epub-js 0.3.97 typed `Location.start` as `{}`; keep the slice the loader reads
// (values come from the runtime relocation object; pins 0.3.96 behavior).
interface RenditionLocationLike {
  start?: {
    cfi?: string;
    percentage?: number;
    href?: string;
    displayed?: { page?: number };
  };
}
import type {
  TocItem,
  SpineItem,
  BookMetadata,
  ProgressPosition,
  PageDirection,
} from './epub-types';
import { createTraceId, createSpanId, serializeError, testBounded, withTimeout } from '@do-epub-studio/shared';
import { parseEpubInWorker, terminateParserWorker } from './epub-parser-worker';
import { createEpubSanitizerHook } from './sanitizer';

type EventCallback = (data: unknown) => void;

// @intity/epub-js 0.3.97 removed the public `on`/`off` typings from Rendition
// even though the runtime EventEmitter still supports them (typing
// regression); restore the event surface so the loader can bridge rendition
// events. Behavior is unchanged.
type RenditionWithEvents = Rendition & {
  on(event: string, listener: (...args: unknown[]) => void): void;
  off(event: string, listener: (...args: unknown[]) => void): void;
};

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
  getBook(): Book | null;
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
  /** Total timeout for the entire load pipeline (default: 30s) */
  loadTimeoutMs?: number;
}

export function createEpubLoader(options?: EpubLoaderOptions): EpubLoader {
  let book: Book | null = null;
  let rendition: RenditionWithEvents | null = null;
  let renditionHandle: EpubRenditionHandle | null = null;
  let toc: TocItem[] = [];
  let spineItems: SpineItem[] = [];
  let metadata: BookMetadata = { title: '' };
  let currentProgress: ProgressPosition | null = null;
  const eventListeners = new Map<string, Set<EventCallback>>();
  let destroyed = false;
  // Raw nav/meta/spine captured during load; parsed lazily on first getter use
  // so the production path (which only calls getBook) skips the duplicate work.
  let rawNav: { toc?: unknown } | null = null;
  let rawMeta: Map<string, string> | null = null;
  let rawSpine: unknown = null;
  let parsed = false;

  function emit(event: string, data: unknown): void {
    options?.onEvent?.(event, data);
    const listeners = eventListeners.get(event);
    if (listeners) {
      for (const cb of listeners) {
        cb(data);
      }
    }
  }

  const perf =
    typeof globalThis !== 'undefined' && typeof globalThis.performance !== 'undefined'
      ? globalThis.performance
      : undefined;

  function safeMark(name: string): void {
    try {
      perf?.mark?.(name);
    } catch {
      // performance.mark unavailable — telemetry is best-effort
    }
  }

  function safeMeasure(name: string, start: string, end: string): void {
    try {
      perf?.measure?.(name, start, end);
    } catch {
      // Performance measure unavailable — telemetry is best-effort
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

  function parseSpineFromRaw(spine: unknown): SpineItem[] {
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

  function resolveDirection(b: Book): PageDirection {
    switch (b.packaging?.direction) {
      case 'rtl':
        return 'rtl';
      case 'ltr':
        return 'ltr';
      default:
        return 'default';
    }
  }

  function resolveFixedLayout(pkgMeta: Map<string, string> | undefined): BookMetadata['fixedLayout'] {
    const layout = pkgMeta?.get('layout');
    if (!layout) return undefined;
    return {
      layout: layout === 'pre-paginated' ? ('pre-paginated' as const) : ('reflowable' as const),
      orientation: pkgMeta?.get('orientation') as 'auto' | 'landscape' | 'portrait' | undefined,
      spread: pkgMeta?.get('spread') as 'none' | 'auto' | 'both' | 'landscape' | undefined,
      viewport: pkgMeta?.get('viewport'),
    };
  }

  function ensureParsed(): void {
    if (parsed || !book) return;
    parsed = true;
    if (rawNav && 'toc' in rawNav && rawNav.toc) {
      toc = parseToc(rawNav.toc as Parameters<typeof parseToc>[0]);
    }
    if (rawSpine !== null && rawSpine !== undefined) {
      spineItems = parseSpineFromRaw(rawSpine);
    }
    if (!rawMeta) return;
    const pkgMeta = book.packaging?.metadata as Map<string, string> | undefined;
    metadata = {
      title: rawMeta.get('title') ?? '',
      creator: rawMeta.get('creator'),
      language: rawMeta.get('language'),
      publisher: rawMeta.get('publisher'),
      description: rawMeta.get('description'),
      direction: resolveDirection(book),
      fixedLayout: resolveFixedLayout(pkgMeta),
    };
  }

  async function load(url: string | Uint8Array): Promise<void> {
    if (destroyed) {
      throw new Error('EpubLoader has been destroyed');
    }

    const traceId = createTraceId();
    const spanId = createSpanId();
    const totalTimeout = options?.loadTimeoutMs ?? 30_000;

    try {
      await withTimeout(
        (signal) => loadInner(url, signal),
        { timeoutMs: totalTimeout, operation: 'epub-load', traceId },
      );
    } catch (error) {
      const formatted = serializeError(error);
      console.error(JSON.stringify({ level: 'error', event: 'epub-loader.error', traceId, spanId, error: formatted }));
      throw new Error(`Failed to load EPUB: ${formatted.message}`, { cause: error });
    }
  }

  async function loadInner(url: string | Uint8Array, signal?: AbortSignal): Promise<void> {
    safeMark('epub-fetch-start');
    const result = await parseEpubInWorker(url);
    // GOAP-224 A7: destroy() may have run while we were awaiting the worker
    // (e.g. reader unmount). Bail before touching any instance state so a
    // destroyed loader cannot keep mutating `book`/raws after teardown.
    if (destroyed) return;
    if (!result.valid || !result.data) {
      throw new Error(result.error ?? 'Failed to parse EPUB');
    }
    safeMark('epub-fetch-end');
    safeMeasure('epub-fetch', 'epub-fetch-start', 'epub-fetch-end');

    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    safeMark('epub-unzip-start');
    book = ePub(result.data);
    await book.opened;
    if (destroyed) return;
    safeMark('epub-unzip-end');
    safeMeasure('epub-unzip', 'epub-unzip-start', 'epub-unzip-end');

    // Fetch navigation and metadata/spine in parallel for big-EPUB speed
    // (plan 065). epub-js 0.3.97 removed `loaded.metadata`/`loaded.spine`;
    // metadata and spine now live on `loaded.packaging` (same Map shapes).
    const rawLoaded = book.loaded;
    if (!rawLoaded) {
      throw new Error('Book opened without loaded data');
    }
    const resolved = (await Promise.all([
      rawLoaded.packaging,
      rawLoaded.navigation,
    ])) as [unknown, unknown];
    const nav = resolved[1] as { toc?: unknown } | null;
    const packaging = resolved[0] as
      | { metadata?: Map<string, string>; spine?: unknown }
      | null
      | undefined;
    if (destroyed) return;

    rawNav = nav ?? null;
    rawMeta = packaging?.metadata ?? null;
    rawSpine = packaging?.spine ?? null;
  }

  function createRenditionHandle(container: HTMLElement): EpubRenditionHandle {
    if (!book) {
      throw new Error('Book not loaded. Call load() first.');
    }
    if (rendition) {
      // renditionHandle is guaranteed set here since rendition exists
      return renditionHandle as EpubRenditionHandle;
    }

    // The runtime rendition is an EventEmitter; the 0.3.97 typings dropped on/off
    // (see RenditionWithEvents) — cast at the single construction boundary.
    rendition = book.renderTo(container, {
      width: '100%',
      height: '100%',
      spread: 'auto',
      sandbox: ['allow-same-origin'],
      flow: options?.flow,
      manager: options?.manager,
    }) as RenditionWithEvents;

    // Security: ADR-035 Mandatory sanitization
    rendition.hooks.content.register(createEpubSanitizerHook().hook);

    // Bridge rendition events to the loader's event system
    rendition.on('relocated', (location: unknown) => {
      const start = (location as RenditionLocationLike).start ?? {};
      const progress: ProgressPosition = {
        cfi: start.cfi ?? '',
        percentage: start.percentage ?? 0,
        displayed: {
          index: start.displayed?.page ?? 0,
          href: start.href ?? '',
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
        rendition.on(event, callback);
      },
      off(event: string, callback: EventCallback): void {
        if (!rendition) return;
        rendition.off(event, callback);
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
      // GOAP-224 A6: the shared parser worker pool must not outlive this
      // loader. terminateParserWorker() is idempotent (guards on the pool) and
      // resets the module-level pool so the next loader gets a fresh worker.
      terminateParserWorker();
    },
    getMetadata(): BookMetadata {
      ensureParsed();
      return { ...metadata };
    },
    getBook(): Book | null {
      return book;
    },
    getToc(): TocItem[] {
      ensureParsed();
      return [...toc];
    },
    getSpineItems(): SpineItem[] {
      ensureParsed();
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

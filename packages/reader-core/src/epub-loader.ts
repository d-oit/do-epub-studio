import ePub from '@intity/epub-js';
import type { Book, Rendition, Location, Contents } from '@intity/epub-js';
import type {
  TocItem,
  SpineItem,
  BookMetadata,
  ProgressPosition,
  MediaOverlayManifest,
  RenditionItem,
} from './epub-types';
import type { BookContainerHost } from './rendition-container';
import {
  createTraceId,
  createSpanId,
  serializeError,
  testBounded,
  withTimeout,
} from '@do-epub-studio/shared';
import { parseLoadedEpubMetadata } from './epub-loader-metadata';
import { markLoaderPhase, measureLoaderPhase } from './epub-loader-performance';
import { parseEpubInWorker, terminateParserWorker } from './epub-parser-worker';
import {
  createEpubSanitizerHook,
  createExternalUrlGuardHook,
  type ExternalUrlPolicy,
} from './sanitizer';

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
  load(url: string | Uint8Array, options?: { rootfile?: string }): Promise<void>;
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
  getMediaOverlays(): Promise<MediaOverlayManifest>;
  getRenditions(): Promise<RenditionItem[]>;
  getActiveRendition(): RenditionItem | null;
  rendition: EpubRenditionHandle | null;
}

interface EpubLoaderOptions {
  onEvent?: (event: string, data: unknown) => void;
  flow?: 'paginated' | 'scrolled' | 'scrolled-doc';
  manager?: 'default' | 'continuous';
  /** Total timeout for the entire load pipeline (default: 30s) */
  loadTimeoutMs?: number;
  /**
   * External (absolute `http(s)`) URL policy for EPUB content. Defaults to
    rendition: null as { destroy: () => void } | null,
   * to permit specific trusted hosts (see `ExternalUrlPolicy`).
   */
  externalUrlPolicy?: ExternalUrlPolicy;
  rootfile?: string;
}

export function createEpubLoader(options?: EpubLoaderOptions): EpubLoader {
  let book: Book | null = null;
  let rendition: Rendition | null = null;
  let renditionHandle: EpubRenditionHandle | null = null;
  let toc: TocItem[] = [];
  let spineItems: SpineItem[] = [];
  let metadata: BookMetadata = { title: '' };
  let currentProgress: ProgressPosition | null = null;
  let mediaOverlayManifest: MediaOverlayManifest | null = null;
  const eventListeners = new Map<string, Set<EventCallback>>();
  let destroyed = false;
  let previousPageHideHandler: Window['onpagehide'] = null;
  let renditionPageHideHandler: Window['onpagehide'] = null;
  let pageHideCaptureComplete = false;
  // Raw nav/meta/spine captured during load; parsed lazily on first getter use
  let renditions: RenditionItem[] = [];
  let activeRendition: RenditionItem | null = null;
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

  function ensureParsed(): void {
    if (parsed || !book) return;
    parsed = true;
    const loaded = parseLoadedEpubMetadata({ book, rawNav, rawMeta, rawSpine });
    if (loaded.toc) toc = loaded.toc;
    if (loaded.spineItems) spineItems = loaded.spineItems;
    if (loaded.metadata) metadata = loaded.metadata;
  }

  async function load(
    url: string | Uint8Array,
    loadOptions?: { rootfile?: string },
  ): Promise<void> {
    if (destroyed) {
      throw new Error('EpubLoader has been destroyed');
    }

    const traceId = createTraceId();
    const spanId = createSpanId();
    const totalTimeout = options?.loadTimeoutMs ?? 30_000;

    try {
      await withTimeout((signal) => loadInner(url, signal, loadOptions), {
        timeoutMs: totalTimeout,
        operation: 'epub-load',
        traceId,
      });
    } catch (error) {
      const formatted = serializeError(error);
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'epub-loader.error',
          traceId,
          spanId,
          error: formatted,
        }),
      );
      throw new Error(`Failed to load EPUB: ${formatted.message}`, { cause: error });
    }
  }

  async function loadInner(
    url: string | Uint8Array,
    signal?: AbortSignal,
    loadOptions?: { rootfile?: string },
  ): Promise<void> {
    markLoaderPhase(perf, 'epub-fetch-start');
    const result = await parseEpubInWorker(url);
    // GOAP-224 A7: destroy() may have run while we were awaiting the worker
    // (e.g. reader unmount). Bail before touching any instance state so a
    // destroyed loader cannot keep mutating `book`/raws after teardown.
    if (destroyed) return;
    if (!result.valid || !result.data) {
      throw new Error(result.error ?? 'Failed to parse EPUB');
    }
    markLoaderPhase(perf, 'epub-fetch-end');
    measureLoaderPhase(perf, 'epub-fetch', 'epub-fetch-start', 'epub-fetch-end');

    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    markLoaderPhase(perf, 'epub-unzip-start');
    const requestedRootfile = loadOptions?.rootfile ?? options?.rootfile;
    if (requestedRootfile) {
      book = ePub();
      const { openBookWithRootfile } = await import('./rendition-container');
      await openBookWithRootfile(
        book as unknown as BookContainerHost,
        result.data,
        requestedRootfile,
      );
    } else {
      book = ePub(result.data);
    }
    await book.opened;
    if (destroyed) return;
    markLoaderPhase(perf, 'epub-unzip-end');
    measureLoaderPhase(perf, 'epub-unzip', 'epub-unzip-start', 'epub-unzip-end');

    const readArchiveText = async (p: string): Promise<string | null> => {
      const normalized = p.startsWith('/') ? p : `/${p}`;
      const res = await book?.archive?.getText(normalized);
      if (res != null) return res;
      return book?.archive?.getText(p.replace(/^\//, '')) ?? null;
    };

    try {
      const containerXml = await readArchiveText('META-INF/container.xml');
      if (containerXml) {
        const { resolveRenditions } = await import('./rendition-container');
        renditions = await resolveRenditions(containerXml, { getText: readArchiveText });
      }
    } catch {
      renditions = [];
    }

    if (requestedRootfile) {
      activeRendition =
        renditions.find((r) => r.fullPath === requestedRootfile || r.id === requestedRootfile) ??
        renditions[0] ??
        null;
    } else if (renditions.length > 0) {
      activeRendition = renditions[0] ?? null;
    }

    // Fetch navigation, spine, and metadata in parallel — they are
    // independent and already-resolved by the time `opened` fires.
    // Sequential awaits add 20-60ms each on large EPUBs (per plan 065).
    const loaded = book.loaded as typeof book.loaded & { sections?: Promise<unknown> };
    const [nav, meta, spine] = await Promise.all([
      loaded.navigation,
      loaded.metadata,
      loaded.spine ?? loaded.sections ?? Promise.resolve(null),
    ]);
    if (destroyed) return;

    rawNav = nav ?? null;
    rawMeta = meta ?? null;
    rawSpine = spine ?? null;
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
      sandbox: ['allow-same-origin'],
      flow: options?.flow,
      manager: options?.manager ?? 'default',
    });

    // Security: ADR-035 Mandatory sanitization + external-URL hardening.
    // Layer 1 strips disallowed external http(s) hrefs at content-ingestion;
    // Layer 2 (CSP) is the fetch-level egress guard backstop.
    rendition.hooks.content.register(
      createEpubSanitizerHook({ externalUrlPolicy: options?.externalUrlPolicy }).hook,
    );
    rendition.hooks.content.register(createExternalUrlGuardHook(options?.externalUrlPolicy).hook);

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
        const pageHideBeforeDisplay = typeof window === 'undefined' ? null : window.onpagehide;
        try {
          await rendition.display(target);
        } finally {
          if (!pageHideCaptureComplete && typeof window !== 'undefined') {
            const pageHideHandler = window.onpagehide;
            if (pageHideHandler && pageHideHandler !== pageHideBeforeDisplay) {
              previousPageHideHandler = pageHideBeforeDisplay;
              renditionPageHideHandler = pageHideHandler;
              pageHideCaptureComplete = true;
            }
          }
        }
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
      if (destroyed) return;
      destroyed = true;
      // EPUB.js stores the manager destroy method on window.onpagehide but
      // never removes it. Restore our previous handler before book cleanup.
      if (
        renditionPageHideHandler &&
        typeof window !== 'undefined' &&
        window.onpagehide === renditionPageHideHandler
      ) {
        window.onpagehide = previousPageHideHandler;
      }
      renditionPageHideHandler = null;
      previousPageHideHandler = null;
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
      mediaOverlayManifest = null;
      renditions = [];
      activeRendition = null;
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
      let listeners = eventListeners.get(event);
      if (!listeners) {
        listeners = new Set();
        eventListeners.set(event, listeners);
      }
      listeners.add(callback);
    },
    off(event: string, callback: EventCallback): void {
      eventListeners.get(event)?.delete(callback);
    },
    async getMediaOverlays(): Promise<MediaOverlayManifest> {
      if (mediaOverlayManifest) return mediaOverlayManifest;
      if (!book) return { sequencesByChapter: {}, totalDuration: 0, hasMediaOverlays: false };
      const { extractMediaOverlays } = await import('./media-overlay');
      mediaOverlayManifest = await extractMediaOverlays(book);
      return mediaOverlayManifest;
    },
    getRenditions(): Promise<RenditionItem[]> {
      return Promise.resolve([...renditions]);
    },
    getActiveRendition(): RenditionItem | null {
      return activeRendition;
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

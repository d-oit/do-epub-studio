import type { TocItem, SpineItem, BookMetadata, ProgressPosition } from './epub-types';

export interface EpubLoader {
  load(url: string): Promise<void>;
  destroy(): void;
  getMetadata(): BookMetadata;
  getToc(): TocItem[];
  getSpineItems(): SpineItem[];
  getProgress(): ProgressPosition | null;
  setProgress(cfi: string): void;
  on(event: string, callback: (data: unknown) => void): void;
  off(event: string, callback: (data: unknown) => void): void;
  rendition?: {
    display(target?: string): Promise<void>;
    prev(): void;
    next(): void;
    on(event: string, callback: (data: unknown) => void): void;
    getContents(): unknown[];
  };
}

export function createEpubLoader(): EpubLoader {
  return {
    load: () => Promise.reject(new Error('EpubLoader not implemented - requires epubjs runtime')),
    destroy: () => {
      /* no-op until EPUB runtime is wired */
    },
    getMetadata: () => ({ title: '' }),
    getToc: () => [],
    getSpineItems: () => [],
    getProgress: () => null,
    setProgress: () => {
      /* intentionally blank */
    },
    on: () => {
      /* event bridge injected by runtime */
    },
    off: () => {
      /* event bridge injected by runtime */
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

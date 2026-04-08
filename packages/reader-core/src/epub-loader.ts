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
    load: async () => {
      throw new Error('EpubLoader not implemented - requires epubjs runtime');
    },
    destroy: () => {},
    getMetadata: () => ({ title: '' }),
    getToc: () => [],
    getSpineItems: () => [],
    getProgress: () => null,
    setProgress: () => {},
    on: () => {},
    off: () => {},
  };
}

export function extractCfi(text: string): string | null {
  const match = text.match(/epubcfi\(\/[^)]+\)/);
  return match ? match[0] : null;
}

export function isValidCfi(cfi: string): boolean {
  return /^epubcfi\(\/\d+(?:\[\S+\])?(?:\/[^)]+)*\)$/.test(cfi);
}

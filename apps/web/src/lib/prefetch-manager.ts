/**
 * PrefetchManager - Selective prefetch for EPUB chapters
 * Prefetches next spine item at low priority after chapter idle.
 * Network-aware (skip 2G/save-data) and storage-quota-aware (<10% free).
 */

import { createTraceId } from '@do-epub-studio/shared';

interface SpineItem {
  href: string;
  idref?: string;
}

interface Connection {
  effectiveType?: string;
  saveData?: boolean;
  addEventListener?: (type: string, handler: () => void) => void;
  removeEventListener?: (type: string, handler: () => void) => void;
}

interface StorageEstimate {
  usage?: number;
  quota?: number;
}

interface PrefetchConfig {
  /** Delay in ms before prefetching after chapter idle (default: 500) */
  idleDelayMs?: number;
  /** Minimum free storage percentage to allow prefetch (default: 10) */
  minStorageFreePercent?: number;
  /** Network types to skip (default: ['slow-2g', '2g']) */
  skipNetworkTypes?: string[];
}

const DEFAULT_CONFIG: Required<PrefetchConfig> = {
  idleDelayMs: 500,
  minStorageFreePercent: 10,
  skipNetworkTypes: ['slow-2g', '2g'],
};

export class PrefetchManager {
  private spine: SpineItem[] = [];
  private currentIndex = -1;
  private prefetchLink: HTMLLinkElement | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private prefetchInFlight = false;
  private config: Required<PrefetchConfig>;
  private onPrefetch?: (url: string) => void;

  constructor(config: PrefetchConfig = {}, onPrefetch?: (url: string) => void) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.onPrefetch = onPrefetch;
  }

  private getConnection(): Connection | null {
    if (typeof navigator === 'undefined') return null;
    return (navigator as unknown as { connection?: Connection }).connection ?? null;
  }

  /**
   * Check if network conditions allow prefetching
   */
  private canPrefetchOnNetwork(): boolean {
    const connection = this.getConnection();
    if (!connection) return true;

    // Skip on save-data mode
    if (connection.saveData === true) {
      return false;
    }

    // Skip on slow networks
    const effectiveType = connection.effectiveType;
    if (effectiveType && this.config.skipNetworkTypes.includes(effectiveType)) {
      return false;
    }

    return true;
  }

  /**
   * Check if storage quota allows prefetching (<10% free)
   */
  private async canPrefetchOnStorage(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
      return true;
    }

    try {
      const estimate: StorageEstimate = await navigator.storage.estimate();
      if (estimate.usage === undefined || estimate.quota === undefined) {
        return true;
      }

      const freeBytes = estimate.quota - estimate.usage;
      const freePercent = (freeBytes / estimate.quota) * 100;

      return freePercent >= this.config.minStorageFreePercent;
    } catch {
      // On error, allow prefetch
      return true;
    }
  }

  /**
   * Set spine items for the book
   */
  setSpine(spine: SpineItem[]): void {
    this.spine = spine;
  }

  /**
   * Notify of chapter change - triggers prefetch after idle delay
   */
  onChapterChange(currentHref: string): void {
    // Find current index in spine
    const newIndex = this.spine.findIndex((item) => item.href === currentHref);
    if (newIndex === -1) return;

    this.currentIndex = newIndex;

    // Cancel any pending prefetch
    this.cancelPendingPrefetch();

    // Clear previous prefetch link
    this.clearPrefetchLink();

    // Check if we can prefetch
    if (!this.canPrefetchOnNetwork()) {
      return;
    }

    // Schedule prefetch after idle delay
    this.idleTimer = setTimeout(() => {
      void this.prefetchNext();
    }, this.config.idleDelayMs);
  }

  /**
   * Prefetch next spine item
   */
  private async prefetchNext(): Promise<void> {
    // Already prefetching or at end of spine
    if (this.prefetchInFlight || this.currentIndex >= this.spine.length - 1) {
      return;
    }

    // Check storage quota
    if (!await this.canPrefetchOnStorage()) {
      return;
    }

    const nextItem = this.spine[this.currentIndex + 1];
    if (!nextItem?.href) return;

    // Build full URL (relative to current origin)
    const prefetchUrl = this.buildPrefetchUrl(nextItem.href);
    if (!prefetchUrl) return;

    this.prefetchInFlight = true;

    try {
      // Use link prefetch with low priority
      this.prefetchLink = this.createPrefetchLink(prefetchUrl);

      // Notify callback
      this.onPrefetch?.(prefetchUrl);

      if (process.env.NODE_ENV !== 'production') {
        console.log(
          JSON.stringify({
            level: 'info',
            traceId: createTraceId(),
            event: 'prefetch.chapter',
            metadata: { url: prefetchUrl, index: this.currentIndex + 1 },
          }),
        );
      }
    } finally {
      this.prefetchInFlight = false;
    }
  }

  /**
   * Build absolute URL for prefetch
   */
  private buildPrefetchUrl(href: string): string | null {
    try {
      // If href is already absolute, return as-is
      if (href.startsWith('http://') || href.startsWith('https://')) {
        return href;
      }

      // Resolve relative to current location
      const base = window.location.origin;
      const path = href.startsWith('/') ? href : `/${href}`;
      return `${base}${path}`;
    } catch {
      return null;
    }
  }

  /**
   * Create link prefetch element with low priority
   */
  private createPrefetchLink(url: string): HTMLLinkElement {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    link.as = 'fetch';
    link.fetchPriority = 'low';
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
    return link;
  }

  /**
   * Clear prefetch link from DOM
   */
  private clearPrefetchLink(): void {
    if (this.prefetchLink) {
      this.prefetchLink.remove();
      this.prefetchLink = null;
    }
  }

  /**
   * Cancel pending prefetch timer
   */
  private cancelPendingPrefetch(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  /**
   * Get current state for testing
   */
  getState(): {
    currentIndex: number;
    spineLength: number;
    hasPendingPrefetch: boolean;
    hasPrefetchLink: boolean;
  } {
    return {
      currentIndex: this.currentIndex,
      spineLength: this.spine.length,
      hasPendingPrefetch: this.idleTimer !== null,
      hasPrefetchLink: this.prefetchLink !== null,
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.cancelPendingPrefetch();
    this.clearPrefetchLink();
    this.spine = [];
    this.currentIndex = -1;
  }
}

export type { SpineItem, PrefetchConfig };

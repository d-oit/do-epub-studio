/**
 * CacheStorage adapter (issue #1485).
 *
 * The download engine, eviction, and recovery operate on this small interface
 * instead of touching `caches` directly, so unit tests can inject an
 * in-memory implementation (jsdom has no CacheStorage).
 */

export interface CacheLike {
  put(request: Request | string, response: Response): Promise<void>;
  match(request: Request | string): Promise<Response | undefined>;
  delete(request: Request | string): Promise<boolean>;
  keys(): Promise<string[]>;
}

export interface CacheStorageLike {
  open(name: string): Promise<CacheLike>;
  keys(): Promise<string[]>;
  delete(name: string): Promise<boolean>;
}

export function getCacheStorage(): CacheStorageLike | null {
  const cachesGlobal = (globalThis as { caches?: unknown }).caches;
  if (!cachesGlobal || typeof cachesGlobal !== 'object') return null;
  return cachesGlobal as CacheStorageLike;
}

/** True for the browser's quota error (also surfaced by fake-indexeddb). */
export function isQuotaError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'QuotaExceededError') ||
    (typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      error.name === 'QuotaExceededError')
  );
}

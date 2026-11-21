
/**
 * Storage ownership tiers (issue #1485).
 *
 * - user: irreplaceable user-generated data (annotations, progress, sync
 *   queue, …). Never evicted, never touched by quota cleanup.
 * - book-package: verified offline book downloads (manifest metadata + the
 *   `dl/<bookId>` serving caches). Evicted only as a whole book via LRU.
 * - derived: render/work assets (cover/image caches, EPUB content caches,
 *   in-flight staging caches). Evictable at any time.
 * - transient: plain HTTP caches (API responses, external assets). Evictable
 *   at any time.
 */

export const TIER_USER = 'user';
export const TIER_BOOK_PACKAGE = 'book-package';
export const TIER_DERIVED = 'derived';
export const TIER_TRANSIENT = 'transient';

export type Tier = typeof TIER_USER | typeof TIER_BOOK_PACKAGE | typeof TIER_DERIVED | typeof TIER_TRANSIENT;

export const STAGING_CACHE_PREFIX = 'dl-staging/';
export const BOOK_PACKAGE_CACHE_PREFIX = 'dl/';

const TRANSIENT_CACHE_NAMES: Record<string, boolean> = {
  'external-assets': true,
  'api-responses': true,
};
const DERIVED_CACHE_NAMES: Record<string, boolean> = {
  images: true,
  'book-content': true,
  epub: true,
};
/** Workbox-owned caches (app shell) — never evicted. */
const PROTECTED_CACHE_PREFIXES = ['workbox-precache'] as const;



/**
 * Classify a CacheStorage name. Returns null for caches we must never evict
 * (precache/app shell, unknown names).
 */
export function tierOfCacheName(cacheName: string): Tier | null {
  if (PROTECTED_CACHE_PREFIXES.some((prefix) => cacheName.startsWith(prefix))) {
    return null;
  }
  if (cacheName.startsWith(BOOK_PACKAGE_CACHE_PREFIX)) {
    return TIER_BOOK_PACKAGE;
  }
  if (cacheName.startsWith(STAGING_CACHE_PREFIX)) {
    return TIER_DERIVED;
  }
  if (DERIVED_CACHE_NAMES[cacheName]) {
    return TIER_DERIVED;
  }
  if (TRANSIENT_CACHE_NAMES[cacheName]) {
    return TIER_TRANSIENT;
  }
  return null;
}

/** Cache name that serves a verified offline book. */
export function bookCacheName(bookId: string): string {
  return `${BOOK_PACKAGE_CACHE_PREFIX}${bookId}`;
}

/** Cache name a download attempt writes into before verification. */
export function stagingCacheName(bookId: string, attemptId: string): string {
  return `${STAGING_CACHE_PREFIX}${bookId}/${attemptId}`;
}

/** Parse `<bookId>` out of a staging cache name, or null. */
export function parseStagingCacheName(cacheName: string): string | null {
  if (!cacheName.startsWith(STAGING_CACHE_PREFIX)) return null;
  const rest = cacheName.slice(STAGING_CACHE_PREFIX.length);
  const slash = rest.indexOf('/');
  if (slash <= 0) return null;
  return rest.slice(0, slash);
}

/** Parse `<bookId>` out of a serving cache name, or null. */
export function parseBookCacheName(cacheName: string): string | null {
  if (!cacheName.startsWith(BOOK_PACKAGE_CACHE_PREFIX)) return null;
  const bookId = cacheName.slice(BOOK_PACKAGE_CACHE_PREFIX.length);
  return bookId.length > 0 ? bookId : null;
}

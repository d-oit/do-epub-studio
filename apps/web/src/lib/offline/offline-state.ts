import { getCacheStorage, type CacheStorageLike } from './cache';
import { getManifest, listManifestsByState } from './manifest-store';

/**
 * Read-side queries for offline readiness (issue #1485).
 *
 * `isBookOfflineReady` is the ONLY function the UI may rely on before showing
 * "available offline": it requires a complete manifest AND the presence of
 * every required resource in the serving cache. Recovery guarantees that a
 * complete manifest with missing/corrupt resources is quarantined, so this
 * presence check is authoritative.
 */

export interface OfflineStorageSummary {
  bookCount: number;
  readyCount: number;
  totalBytes: number;
}

export async function isBookOfflineReady(
  bookId: string,
  deps: { cacheStorage?: CacheStorageLike } = {},
): Promise<boolean> {
  const manifest = await getManifest(bookId);
  if (!manifest || manifest.state !== 'complete' || manifest.resources.length === 0) {
    return false;
  }
  const cacheStorage = deps.cacheStorage ?? getCacheStorage();
  if (!cacheStorage) return false;
  try {
    const cache = await cacheStorage.open(manifest.cacheName);
    const present = await Promise.all(
      manifest.resources.map(async (resource) => (await cache.match(resource.url)) !== undefined),
    );
    return present.every(Boolean);
  } catch {
    return false;
  }
}

/** Byte totals count only fully verified books, never partial downloads. */
export async function getOfflineStorageSummary(
  deps: { cacheStorage?: CacheStorageLike } = {},
): Promise<OfflineStorageSummary> {
  const empty: OfflineStorageSummary = { bookCount: 0, readyCount: 0, totalBytes: 0 };
  let manifests;
  try {
    manifests = await listManifestsByState('complete');
  } catch {
    // IDB unavailable or corrupt: report no offline books rather than crash
    // the settings panel.
    return empty;
  }
  let readyCount = 0;
  let totalBytes = 0;
  for (const manifest of manifests) {
    try {
      if (await isBookOfflineReady(manifest.bookId, deps)) {
        readyCount += 1;
        totalBytes += manifest.totalBytes;
      }
    } catch {
      // A broken resource check counts the book as not ready.
    }
  }
  return { bookCount: manifests.length, readyCount, totalBytes };
}

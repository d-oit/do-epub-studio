import { getCacheStorage, type CacheStorageLike } from './cache';
import {
  parseStagingCacheName,
  tierOfCacheName,
  TIER_BOOK_PACKAGE,
  TIER_DERIVED,
  TIER_TRANSIENT,
} from './ownership';
import { failDownload, listManifests, removeManifest } from './manifest-store';
import { getStorageEstimate } from './storage-policy';
import type { DownloadManifest } from './manifest-types';

/**
 * Quota-aware storage eviction (issue #1485).
 *
 * Rules:
 * - User data (annotations/progress/…) is never considered.
 * - Staging caches (incomplete downloads) are removed first; the referencing
 *   manifest is marked failed so a partial download can never be exposed as
 *   complete.
 * - Transient then derived caches are cleared wholesale.
 * - Complete book packages are evicted book-by-book in LRU order (oldest
 *   lastAccess first) — only after cheaper tiers are exhausted.
 */

export const EVICTION_THRESHOLD_RATIO = 0.85;
export const EVICTION_TARGET_RATIO = 0.7;

export interface EvictionResult {
  /** Estimated bytes freed (exact for books; counted cache clears otherwise). */
  freedBytes: number;
  evictedBooks: string[];
  removedCaches: string[];
  usageRatioAfter: number | null;
}

export interface EvictionDeps {
  cacheStorage?: CacheStorageLike;
  estimate?: () => Promise<{ usage: number; quota: number } | null>;
  manifests?: () => Promise<DownloadManifest[]>;
}

interface UsageSnapshot {
  usage: number;
  quota: number;
  ratio: number;
}

async function snapshotUsage(deps: EvictionDeps): Promise<UsageSnapshot | null> {
  const estimate = deps.estimate ?? getStorageEstimate;
  const est = await estimate();
  if (!est || est.quota <= 0) return null;
  return { usage: est.usage, quota: est.quota, ratio: est.usage / est.quota };
}

async function stampStagingFailed(cacheName: string): Promise<void> {
  const bookId = parseStagingCacheName(cacheName);
  if (!bookId) return;
  try {
    const manifests = await listManifests();
    const manifest = manifests.find((m) => m.bookId === bookId && m.stagingCacheName === cacheName);
    if (manifest && manifest.state === 'staging') {
      await failDownload(
        bookId,
        manifest.attemptId,
        'evicted',
        'Staging cache evicted under quota pressure',
      );
    }
  } catch {
    // IDB failure must not block eviction; recovery will reconcile.
  }
}

function cacheTierScore(cacheName: string): number {
  const tier = tierOfCacheName(cacheName);
  if (tier === TIER_DERIVED && cacheName.startsWith('dl-staging/')) return 0;
  if (tier === TIER_TRANSIENT) return 1;
  if (tier === TIER_DERIVED) return 2;
  if (tier === TIER_BOOK_PACKAGE) return 3;
  return 4;
}

/**
 * Remove evictable storage until `shouldContinue` returns false (or nothing
 * disposable is left). Returns what was removed.
 */
export async function evictWhile(
  shouldContinue: (ctx: { freedBytes: number; usageRatio: number | null }) => boolean,
  deps: EvictionDeps = {},
): Promise<EvictionResult> {
  const cacheStorage = deps.cacheStorage ?? getCacheStorage();
  const result: EvictionResult = {
    freedBytes: 0,
    evictedBooks: [],
    removedCaches: [],
    usageRatioAfter: null,
  };

  if (!cacheStorage) {
    return result;
  }

  const manifests = (deps.manifests ?? listManifests)();
  const [cacheNames, allManifests] = await Promise.all([cacheStorage.keys(), manifests]);

  // Non-book caches, cheapest (staging/transient/derived) first.
  const nonBookCaches = cacheNames
    .map((name) => ({ name, score: cacheTierScore(name) }))
    .filter((c) => c.score < 3)
    .sort((a, b) => a.score - b.score);

  // Book packages: complete manifests only, LRU by lastAccess.
  const completeBooks = allManifests
    .filter((m) => m.state === 'complete')
    .sort((a, b) => a.lastAccess - b.lastAccess);

  let usage = await snapshotUsage(deps);
  for (const { name } of nonBookCaches) {
    const ctx = { freedBytes: result.freedBytes, usageRatio: usage ? usage.ratio : null };
    if (!shouldContinue(ctx)) break;
    try {
      if (name.startsWith('dl-staging/')) {
        await stampStagingFailed(name);
      }
      await cacheStorage.delete(name);
      result.removedCaches.push(name);
    } catch {
      // Skip caches that fail to delete (in use); try the rest.
    }
    usage = await snapshotUsage(deps);
  }

  for (const manifest of completeBooks) {
    const ctx = { freedBytes: result.freedBytes, usageRatio: usage ? usage.ratio : null };
    if (!shouldContinue(ctx)) break;
    try {
      await cacheStorage.delete(manifest.cacheName);
      await removeManifest(manifest.bookId);
      result.evictedBooks.push(manifest.bookId);
      result.freedBytes += manifest.totalBytes;
      result.removedCaches.push(manifest.cacheName);
    } catch {
      // One failing book must not block the rest.
    }
    usage = await snapshotUsage(deps);
  }

  result.usageRatioAfter = usage ? usage.ratio : null;
  return result;
}

/**
 * Proactively make room for `bytesNeeded` before a download writes: evict
 * until projected usage (current + bytesNeeded) sits back under the threshold.
 * Best-effort — a real write may still fail with QuotaExceededError, which
 * the download engine treats as a rollback-triggering error.
 */
export async function prepareSpaceFor(
  bytesNeeded: number,
  deps: EvictionDeps = {},
): Promise<EvictionResult> {
  const usage = await snapshotUsage(deps);
  if (!usage) return { freedBytes: 0, evictedBooks: [], removedCaches: [], usageRatioAfter: null };

  const headroom = usage.quota * EVICTION_THRESHOLD_RATIO - (usage.usage + bytesNeeded);
  if (headroom >= 0) {
    return { freedBytes: 0, evictedBooks: [], removedCaches: [], usageRatioAfter: usage.ratio };
  }

  const needed = -headroom;
  const result = await evictWhile(({ freedBytes }) => freedBytes < needed, deps);
  const after = await snapshotUsage(deps);
  return { ...result, usageRatioAfter: after ? after.ratio : null };
}

/** Full eviction sweep used by the service worker's quota guard. */
export async function evictToThreshold(deps: EvictionDeps = {}): Promise<EvictionResult> {
  const usage = await snapshotUsage(deps);
  if (!usage) return { freedBytes: 0, evictedBooks: [], removedCaches: [], usageRatioAfter: null };
  return evictWhile((ctx) => (ctx.usageRatio ?? usage.ratio) > EVICTION_TARGET_RATIO, deps);
}

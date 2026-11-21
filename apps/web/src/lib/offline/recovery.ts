import { getCacheStorage, type CacheStorageLike } from './cache';
import {
  clearStagingReference,
  failDownload,
  listManifests,
  removeManifest,
  sweepInvalidManifests,
} from './manifest-store';
import { parseBookCacheName } from './ownership';
import { hashesEqual, verifyResponseBody } from './integrity';

/**
 * Deterministic recovery/reconciliation for offline storage (issue #1485).
 *
 * Runs at service-worker activation and app start. It converges every
 * interrupted state to a consistent one:
 * - staging manifests → marked failed; when CacheStorage is available the
 *   attempt's staging cache is deleted and the reference cleared (a partial
 *   book is never exposed as complete);
 * - orphan staging/serving caches → removed;
 * - unparseable manifest rows → removed and their serving cache quarantined;
 * - complete manifests whose resources are missing/corrupt → quarantined
 *   (manifest + serving cache removed) so the UI can never claim a book is
 *   offline-ready when its verified copy is gone.
 */

export interface RecoveryReport {
  scannedManifests: number;
  stagingMarkedFailed: string[];
  orphanStagingRemoved: string[];
  quarantinedBooks: string[];
  invalidRowsRemoved: string[];
  orphanBookCachesRemoved: string[];
  repairedStagingRefs: string[];
}

export interface RecoveryDeps {
  cacheStorage?: CacheStorageLike;
}

async function verifyManifestResources(
  cacheStorage: CacheStorageLike,
  manifest: { cacheName: string; resources: { url: string; bytes: number; sha256: string }[] },
): Promise<boolean> {
  let cache;
  try {
    cache = await cacheStorage.open(manifest.cacheName);
  } catch {
    return false;
  }
  const results = await Promise.all(
    manifest.resources.map(async (resource) => {
      const cached = await cache.match(resource.url);
      if (!cached) return false;
      const { sha256, bytes } = await verifyResponseBody(cached.clone());
      return bytes === resource.bytes && hashesEqual(sha256, resource.sha256);
    }),
  );
  return results.every(Boolean);
}

export async function recoverOfflineStorage(
  deps: RecoveryDeps = {},
): Promise<RecoveryReport> {
  const cacheStorage = deps.cacheStorage ?? getCacheStorage();
  const report: RecoveryReport = {
    scannedManifests: 0,
    stagingMarkedFailed: [],
    orphanStagingRemoved: [],
    quarantinedBooks: [],
    invalidRowsRemoved: [],
    orphanBookCachesRemoved: [],
    repairedStagingRefs: [],
  };

  const manifests = await listManifests();
  report.scannedManifests = manifests.length;

  // 1. Remove unparseable rows; their serving caches become orphans handled
  //    below by the orphan-serving-cache sweep.
  report.invalidRowsRemoved = await sweepInvalidManifests();

  // 2. Mark interrupted staging downloads failed (deterministic). When
  //    CacheStorage is available, also delete the attempt's staging cache and
  //    clear the reference so no staging namespace is left behind.
  for (const manifest of manifests) {
    if (manifest.state !== 'staging') continue;
    const marked = await failDownload(
      manifest.bookId,
      manifest.attemptId,
      'interrupted',
      'Download interrupted; marked failed by recovery',
    );
    if (!marked) continue;
    report.stagingMarkedFailed.push(manifest.bookId);
    if (cacheStorage && manifest.stagingCacheName) {
      try {
        await cacheStorage.delete(manifest.stagingCacheName);
        await clearStagingReference(manifest.bookId);
      } catch {
        // In use; reference stays so next recovery can retry.
      }
    }
  }

  if (!cacheStorage) {
    return report;
  }

  const cacheNames = await cacheStorage.keys();
  const stagingNames = new Set(
    manifests.flatMap((m) => (m.stagingCacheName ? [m.stagingCacheName] : [])),
  );
  const servingByBook = new Map<string, string>();

  for (const cacheName of cacheNames) {
    if (cacheName.startsWith('dl-staging/')) {
      if (!stagingNames.has(cacheName)) {
        try {
          await cacheStorage.delete(cacheName);
          report.orphanStagingRemoved.push(cacheName);
        } catch {
          // In use; retried on next recovery.
        }
      }
      continue;
    }
    const bookId = parseBookCacheName(cacheName);
    if (bookId) {
      servingByBook.set(bookId, cacheName);
    }
  }

  const retainedBookIds = new Set<string>();

  // 3. Verify every complete manifest. Missing/corrupt resources → quarantine
  //    (manifest + serving cache removed) so offline-ready is never claimed
  //    falsely. Valid ones get leftover staging caches cleaned.
  for (const manifest of manifests) {
    if (manifest.state !== 'complete') continue;
    const servingCache = servingByBook.get(manifest.bookId);
    if (!servingCache) {
      await removeManifest(manifest.bookId);
      report.quarantinedBooks.push(manifest.bookId);
      continue;
    }
    const verified = await verifyManifestResources(cacheStorage, manifest);
    if (!verified) {
      try {
        await cacheStorage.delete(servingCache);
      } catch {
        // Ignore delete failure; manifest removal alone already prevents a
        // false offline-ready claim.
      }
      await removeManifest(manifest.bookId);
      report.quarantinedBooks.push(manifest.bookId);
      continue;
    }
    retainedBookIds.add(manifest.bookId);

    if (manifest.stagingCacheName) {
      const staging = manifest.stagingCacheName;
      if (stagingNames.has(staging)) {
        try {
          await cacheStorage.delete(staging);
        } catch {
          // Ignore; reference cleanup still fixes the metadata.
        }
      }
      await clearStagingReference(manifest.bookId);
      report.repairedStagingRefs.push(manifest.bookId);
    }
  }

  // 4. Orphan serving caches: no complete, verified manifest references them.
  for (const [bookId, cacheName] of servingByBook) {
    if (cacheName && !retainedBookIds.has(bookId)) {
      try {
        await cacheStorage.delete(cacheName);
        report.orphanBookCachesRemoved.push(cacheName);
      } catch {
        // In use; retried on next recovery.
      }
    }
  }

  return report;
}

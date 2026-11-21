import { getCacheStorage, type CacheStorageLike } from './cache';
import { listManifestsByState, touchManifest } from './manifest-store';
import type { DownloadManifest } from './manifest-types';

/**
 * Manifest-aware serving for the service worker (issue #1485).
 *
 * The SW route for `/api/files/*` asks this module for a verified offline
 * copy BEFORE falling through to the network-first Workbox route. A book is
 * only served from CacheStorage when its manifest is complete and the
 * resource is present — i.e. exactly when `isBookOfflineReady` would claim
 * offline-readiness, so CacheStorage and IndexedDB cannot disagree.
 */

export interface ServingDeps {
  cacheStorage?: CacheStorageLike;
  manifests?: () => Promise<DownloadManifest[]>;
}

async function loadCompleteManifests(deps: ServingDeps): Promise<DownloadManifest[]> {
  if (deps.manifests) return deps.manifests();
  return listManifestsByState('complete');
}

/** Build a 206 partial response for a Range request over a cached body. */
async function sliceResponse(response: Response, rangeHeader: string): Promise<Response | undefined> {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return undefined;
  const startRaw = match[1];
  const endRaw = match[2];
  if (!startRaw && !endRaw) return undefined;

  const buffer = await response.arrayBuffer();
  const total = buffer.byteLength;
  const start = startRaw ? Number(startRaw) : 0;
  let end = endRaw ? Number(endRaw) : total - 1;
  if (Number.isNaN(start) || Number.isNaN(end) || start >= total || end < start) return undefined;
  end = Math.min(end, total - 1);
  const slice = buffer.slice(start, end + 1);
  return new Response(slice, {
    status: 206,
    headers: {
      'Content-Type': response.headers.get('content-type') ?? 'application/octet-stream',
      'Content-Length': String(slice.byteLength),
      'Content-Range': `bytes ${start}-${end}/${total}`,
    },
  });
}

/**
 * Find a verified offline copy of `request.url`. Returns undefined when the
 * URL is not part of any complete manifest (caller falls through to network).
 */
export async function serveBookResource(
  request: Request,
  deps: ServingDeps = {},
): Promise<Response | undefined> {
  const cacheStorage = deps.cacheStorage ?? getCacheStorage();
  if (!cacheStorage) return undefined;

  const manifests = await loadCompleteManifests(deps);
  const manifest = manifests.find((m) => m.resources.some((r) => r.url === request.url));
  if (!manifest) return undefined;

  try {
    const cache = await cacheStorage.open(manifest.cacheName);
    const cached = await cache.match(request.url);
    if (!cached) return undefined;

    const range = request.headers.get('range');
    if (range) {
      const partial = await sliceResponse(cached, range);
      if (partial) return partial;
    }
    void touchManifest(manifest.bookId);
    return cached;
  } catch {
    return undefined;
  }
}

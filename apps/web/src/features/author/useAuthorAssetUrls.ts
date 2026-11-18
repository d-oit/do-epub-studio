import { useEffect, useMemo, useRef, useState } from 'react';
import type { AuthorAssetMetadata } from '@do-epub-studio/shared';
import { fetchAuthorAsset } from '../../lib/api/author-assets';

interface CachedUrl {
  url: string;
  fingerprint: string;
  bookId: string;
  token: string | null;
}

function fingerprintOf(asset: AuthorAssetMetadata | undefined): string {
  return asset ? `${asset.id}:${asset.sha256}:${asset.mediaType}` : '';
}

/**
 * Resolves referenced author image ids to object URLs.
 *
 * Fetches only assets referenced by the parsed chapter. URLs stay stable while
 * the requested assets are unchanged, and are revoked when content, book,
 * session, or component lifetime changes. Returned URLs are checked against
 * current inputs during render, so old-book or removed-asset content cannot
 * flash before the effects reconcile the cache.
 */
export function useAuthorAssetUrls(
  bookId: string,
  assetIds: readonly string[],
  assets: readonly AuthorAssetMetadata[],
  token?: string | null,
): ReadonlyMap<string, string> {
  const cacheRef = useRef<Map<string, CachedUrl>>(new Map());
  const [cacheRevision, setCacheRevision] = useState(0);

  const assetById = useMemo(() => {
    const map = new Map<string, AuthorAssetMetadata>();
    for (const asset of assets) map.set(asset.id, asset);
    return map;
  }, [assets]);

  const requestedIds = useMemo(() => [...new Set(assetIds)].sort(), [assetIds]);

  useEffect(() => {
    const cache = cacheRef.current;
    return () => {
      for (const entry of cache.values()) URL.revokeObjectURL(entry.url);
      cache.clear();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const cache = cacheRef.current;
    const tokenKey = token ?? null;
    const requested = new Set(requestedIds);

    for (const [id, entry] of cache) {
      const asset = assetById.get(id);
      const stale =
        entry.bookId !== bookId ||
        entry.token !== tokenKey ||
        !requested.has(id) ||
        !asset ||
        entry.fingerprint !== fingerprintOf(asset);
      if (stale) {
        URL.revokeObjectURL(entry.url);
        cache.delete(id);
      }
    }

    const pending = requestedIds.filter((id) => assetById.has(id) && !cache.has(id));
    if (pending.length === 0) return;

    const controller = new AbortController();
    void Promise.allSettled(
      pending.map(async (id) => {
        const asset = assetById.get(id);
        if (!asset) throw new Error(`Author asset ${id} is referenced but unavailable`);
        const blob = await fetchAuthorAsset(bookId, asset, token, controller.signal);
        return { id, url: URL.createObjectURL(blob), fingerprint: fingerprintOf(asset) };
      }),
    ).then((results) => {
      let changed = false;
      for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        if (cancelled) {
          URL.revokeObjectURL(result.value.url);
          continue;
        }
        cache.set(result.value.id, {
          url: result.value.url,
          fingerprint: result.value.fingerprint,
          bookId,
          token: tokenKey,
        });
        changed = true;
      }
      if (!cancelled && changed) setCacheRevision((revision) => revision + 1);
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [assetById, bookId, requestedIds, token]);

  return useMemo(() => {
    // cacheRevision is a cache-mutation signal: cacheRef below is mutated
    // without a state write, so this read is what schedules the recompute.
    void cacheRevision;
    const visibleUrls = new Map<string, string>();
    const currentToken = token ?? null;
    for (const id of requestedIds) {
      const asset = assetById.get(id);
      const entry = cacheRef.current.get(id);
      if (
        asset &&
        entry &&
        entry.bookId === bookId &&
        entry.token === currentToken &&
        entry.fingerprint === fingerprintOf(asset)
      ) {
        visibleUrls.set(id, entry.url);
      }
    }
    return visibleUrls;
  }, [assetById, bookId, cacheRevision, requestedIds, token]);
}

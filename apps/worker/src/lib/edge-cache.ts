/**
 * Edge cache helpers for read-mostly public endpoints.
 *
 * Cloudflare's `caches.default` is a per-colo cache that survives
 * Worker deployments and is shared across all origins in the zone. For
 * public, read-mostly routes (catalog, public book metadata) we
 * short-circuit the request before hitting Turso.
 *
 * Reference: ADR-112 (stream upload + edge cache).
 */

// Bumped on book content changes so stale edge-cache entries are
// automatically missed. The upload-complete endpoint calls bumpCacheVersion().
//
// Limitation: this is per-isolate state. Cloudflare Workers may run multiple
// isolates per colo, so only the isolate that processed the upload will see
// the bumped version. Other isolates will serve stale cache until their
// max-age/s-maxage TTL expires. This is a best-effort invalidation; the TTL
// (60s max-age, 300s s-maxage) bounds staleness for other isolates.
// For cross-isolate invalidation, a Durable Object or KV-backed version
// counter would be needed (future enhancement).
let CACHE_VERSION = 'v1';

/** Increment the cache version to invalidate all edge-cached entries (best-effort, per-isolate). */
export function bumpCacheVersion(): void {
  CACHE_VERSION = `v${Date.now()}`;
}

const FORWARDED_HEADERS = ['Accept-Language', 'Accept'] as const;

export interface EdgeCacheOptions {
  /** Cache-Control header applied to the stored and returned response. */
  cacheControl: string;
  /** Optional override of the cache key prefix (default: edge-cache:CACHE_VERSION). */
  keyPrefix?: string;
}

export interface CacheLookup<T> {
  hit: boolean;
  response: Response;
  /** Caller-supplied handler that produces a fresh response on miss. */
  refresh: () => Promise<T>;
  /** When `hit` is true, this is the decoded cached payload. */
  cached?: T;
}

/**
 * Look up a request in `caches.default` and return the stored response
 * when present. The cache key is derived from the original URL and the
 * subset of headers that affect content negotiation (Accept-Language,
 * Accept).
 */
export function buildCacheKey(request: Request, prefix = `edge-cache:${CACHE_VERSION}`): Request {
  const url = new URL(request.url);
  const keyUrl = new URL(url.toString());
  // Sort query params for stable keys regardless of client order.
  keyUrl.searchParams.sort();
  const filtered = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value) filtered.set(name, value);
  }
  const key = `${prefix}:${keyUrl.toString()}`;
  return new Request(key, {
    method: 'GET',
    headers: filtered,
  });
}

interface EdgeCacheStorage {
  readonly default?: Cache;
}

export interface EdgeCacheContext {
  waitUntil: (promise: Promise<unknown>) => void;
}

/**
 * Short-circuit a request via `caches.default`. On hit, return the
 * stored Response with a `x-cache: HIT` header appended. On miss, call
 * `handler`, wrap the response in `Cache-Control` (if not already set),
 * and write it to the cache in the background via `ctx.waitUntil`.
 */
export async function withEdgeCache(
  request: Request,
  handler: () => Promise<Response>,
  options: EdgeCacheOptions,
  ctx: EdgeCacheContext,
): Promise<Response> {
  const cache = (globalThis as { caches?: EdgeCacheStorage }).caches;
  const cacheKey = buildCacheKey(request, options.keyPrefix);

  if (cache?.default) {
    const hit = await cache.default.match(cacheKey);
    if (hit) {
      // Preserve the original Cache-Control from the cached response and
      // add a HIT marker for observability.
      const headers = new Headers(hit.headers);
      if (!headers.has('Cache-Control')) {
        headers.set('Cache-Control', options.cacheControl);
      }
      headers.set('x-cache', 'HIT');
      return new Response(hit.body, {
        status: hit.status,
        statusText: hit.statusText,
        headers,
      });
    }
  }

  const response = await handler();
  // Only cache fully-OK JSON responses. Streaming or auth-dependent
  // responses are skipped.
  if (
    response.status === 200 &&
    cache?.default &&
    response.body != null &&
    !response.headers.has('Cache-Control')
  ) {
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', options.cacheControl);
    const toCache = new Response(response.clone().body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
    ctx.waitUntil(cache.default.put(cacheKey, toCache).catch(() => undefined));
  }
  if (response.status === 200) {
    const headers = new Headers(response.headers);
    if (!headers.has('Cache-Control')) {
      headers.set('Cache-Control', options.cacheControl);
    }
    headers.set('x-cache', 'MISS');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
  return response;
}

/** Default public-cache directive for read-mostly endpoints. */
export const PUBLIC_CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400';

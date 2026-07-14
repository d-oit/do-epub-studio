import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildCacheKey,
  withEdgeCache,
  PUBLIC_CACHE_CONTROL,
} from '../lib/edge-cache';
import {
  makeEnv,
  makePassThroughContext,
  mockQueryAll,
} from './fixtures';
import { app } from '../app';

interface MockCache {
  store: Map<string, Response>;
  put: ReturnType<typeof vi.fn>;
  match: ReturnType<typeof vi.fn>;
}

function installMockCache(): MockCache {
  const store = new Map<string, Response>();
  const match = vi.fn((key: Request | string): Promise<Response | null> => {
    const url = typeof key === 'string' ? key : key.url;
    return Promise.resolve(store.get(url) ?? null);
  });
  const put = vi.fn((key: Request, response: Response): Promise<void> => {
    const cloned = response.clone();
    store.set(key.url, cloned);
    return Promise.resolve();
  });
  const cache = { default: { match, put } };
  (globalThis as unknown as { caches: typeof cache }).caches = cache;
  return { store, put, match };
}

describe('edge-cache helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    delete (globalThis as unknown as { caches?: unknown }).caches;
  });

  describe('buildCacheKey', () => {
    it('builds a stable key for the same URL', () => {
      const request = new Request('https://example.com/api/catalog?q=a&limit=10', {
        headers: { 'Accept-Language': 'en' },
      });
      const k1 = buildCacheKey(request);
      const k2 = buildCacheKey(request);
      expect(k1.url).toBe(k2.url);
      expect(k1.url).toContain('edge-cache:v1');
    });

    it('orders query params for stability', () => {
      const r1 = new Request('https://example.com/api/catalog?a=1&b=2');
      const r2 = new Request('https://example.com/api/catalog?b=2&a=1');
      expect(buildCacheKey(r1).url).toBe(buildCacheKey(r2).url);
    });

    it('forwards Accept-Language into the key headers', () => {
      const request = new Request('https://example.com/api/catalog', {
        headers: { 'Accept-Language': 'fr-FR' },
      });
      const key = buildCacheKey(request);
      expect(key.headers.get('Accept-Language')).toBe('fr-FR');
    });

    it('forwards Accept into the key headers', () => {
      const request = new Request('https://example.com/api/catalog', {
        headers: { Accept: 'application/json' },
      });
      const key = buildCacheKey(request);
      expect(key.headers.get('Accept')).toBe('application/json');
    });
  });

  describe('withEdgeCache', () => {
    it('returns MISS on first call and HIT on second', async () => {
      const cache = installMockCache();
      const handler = vi.fn(
        (): Promise<Response> =>
          Promise.resolve(
            new Response(JSON.stringify({ ok: true, data: { items: [], total: 0 } }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          ),
      );
      const ctx = { waitUntil: vi.fn() };
      const request = new Request('https://example.com/api/catalog');

      const first = await withEdgeCache(request, handler, { cacheControl: PUBLIC_CACHE_CONTROL }, ctx);
      expect(first.status).toBe(200);
      expect(first.headers.get('x-cache')).toBe('MISS');
      expect(first.headers.get('Cache-Control')).toBe(PUBLIC_CACHE_CONTROL);
      expect(handler).toHaveBeenCalledTimes(1);

      const second = await withEdgeCache(request, handler, { cacheControl: PUBLIC_CACHE_CONTROL }, ctx);
      expect(second.headers.get('x-cache')).toBe('HIT');
      expect(handler).toHaveBeenCalledTimes(1);

      // The cache should have been written once (via waitUntil).
      expect(cache.put).toHaveBeenCalled();
      expect(cache.store.size).toBe(1);
    });

    it('does not cache non-200 responses', async () => {
      const cache = installMockCache();
      const handler = vi.fn(
        (): Promise<Response> => Promise.resolve(new Response('boom', { status: 500 })),
      );
      const ctx = { waitUntil: vi.fn() };
      const request = new Request('https://example.com/api/catalog');

      const res = await withEdgeCache(request, handler, { cacheControl: PUBLIC_CACHE_CONTROL }, ctx);
      expect(res.status).toBe(500);
      expect(cache.put).not.toHaveBeenCalled();
    });

    it('no-ops when caches.default is unavailable', async () => {
      // No installMockCache — caches may be the worker-pool default.
      // Either way, the handler must always run.
      const handler = vi.fn(
        (): Promise<Response> => Promise.resolve(new Response('{}', { status: 200 })),
      );
      const ctx = { waitUntil: vi.fn() };
      const request = new Request('https://example.com/api/catalog');
      const res = await withEdgeCache(request, handler, { cacheControl: PUBLIC_CACHE_CONTROL }, ctx);
      expect(res.status).toBe(200);
      // x-cache may be MISS or absent depending on the test pool; both
      // are acceptable as long as the handler ran.
      expect(handler).toHaveBeenCalled();
    });
  });
});

describe('Catalog Routes cache integration', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    delete (globalThis as unknown as { caches?: unknown }).caches;
  });

  it('emits Cache-Control: public, max-age=60 on a catalog request', async () => {
    installMockCache();
    mockQueryAll.mockResolvedValueOnce([{ cnt: 0 }]).mockResolvedValueOnce([]);

    const res = await app.fetch(
      new Request('http://localhost/api/catalog'),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    const cacheControl = res.headers.get('Cache-Control') ?? '';
    expect(cacheControl).toContain('public');
    expect(cacheControl).toContain('max-age=60');
    expect(cacheControl).toContain('s-maxage=300');
    expect(cacheControl).toContain('stale-while-revalidate=86400');
    expect(res.headers.get('x-cache')).toBe('MISS');
  });

  it('serves the second identical catalog request from cache without querying Turso', async () => {
    installMockCache();
    mockQueryAll.mockResolvedValueOnce([{ cnt: 1 }]).mockResolvedValueOnce([
      {
        id: 'book-1',
        slug: 'book-1',
        title: 'Cached Book',
        author_name: 'Author',
        description: null,
        language: 'en',
        cover_image_url: null,
        published_at: '2024-01-01T00:00:00Z',
      },
    ]);

    const first = await app.fetch(
      new Request('http://localhost/api/catalog?q=hello'),
      env,
      makePassThroughContext(),
    );
    expect(first.status).toBe(200);
    expect(first.headers.get('x-cache')).toBe('MISS');
    expect(mockQueryAll).toHaveBeenCalledTimes(2);

    const second = await app.fetch(
      new Request('http://localhost/api/catalog?q=hello'),
      env,
      makePassThroughContext(),
    );
    expect(second.status).toBe(200);
    expect(second.headers.get('x-cache')).toBe('HIT');
    // mockQueryAll should NOT have been called again — the second
    // response was served from the edge cache.
    expect(mockQueryAll).toHaveBeenCalledTimes(2);
  });
});

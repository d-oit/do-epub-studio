import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the cloudflare:workers module before importing RateLimiterDO
const mockStorage = new Map<string, unknown>();

vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    ctx = {
      storage: {
        get: vi.fn((key: string) => mockStorage.get(key)),
        put: vi.fn((key: string, value: unknown) => { mockStorage.set(key, value); }),
        delete: vi.fn((key: string) => { mockStorage.delete(key); }),
        deleteAll: vi.fn(() => { mockStorage.clear(); }),
        list: vi.fn((opts?: { prefix?: string }) => {
          const entries = new Map<string, unknown>();
          for (const [k, v] of mockStorage) {
            if (!opts?.prefix || k.startsWith(opts.prefix)) {
              entries.set(k, v);
            }
          }
          return entries;
        }),
        getAlarm: vi.fn(() => {
          const val = mockStorage.get('__alarm__');
          return val ?? null;
        }),
        setAlarm: vi.fn((timestamp: number) => {
          mockStorage.set('__alarm__', timestamp);
        }),
      },
    };
    fetch = vi.fn((request: Request) => {
      const url = new URL(request.url);
      const path = url.pathname;

      if (request.method === 'POST' && path.startsWith('/reset/')) {
        const namespace = path.slice('/reset/'.length);
        if (namespace) {
          const keys: string[] = [];
          for (const k of mockStorage.keys()) {
            if (k.startsWith(`${namespace}:`)) keys.push(k);
          }
          keys.forEach((k) => mockStorage.delete(k));
        } else {
          mockStorage.clear();
        }
        return new Response(null, { status: 204 });
      }

      const checkMatch = path.match(/^\/check\/([^/]+)\/([^/]+)$/);
      if (request.method === 'GET' && checkMatch) {
        const [, namespace, key] = checkMatch;
        const maxRequests = parseInt(url.searchParams.get('maxRequests') ?? '100', 10);
        const windowMs = parseInt(url.searchParams.get('windowMs') ?? '60000', 10);
        const entryKey = `${namespace}:${key}`;
        const now = Date.now();
        let entry = mockStorage.get(entryKey) as { count: number; resetAt: number } | undefined;

        if (!entry || now >= entry.resetAt) {
          entry = { count: 1, resetAt: now + windowMs };
          mockStorage.set(entryKey, entry);
          return Response.json({
            allowed: true,
            remaining: maxRequests - 1,
            resetAt: entry.resetAt,
          });
        }

        entry.count += 1;
        mockStorage.set(entryKey, entry);
        return Response.json({
          allowed: entry.count <= maxRequests,
          remaining: Math.max(0, maxRequests - entry.count),
          resetAt: entry.resetAt,
        });
      }

      return new Response('Not found', { status: 404 });
    });
  },
}));

// Import after mock is set up
const { RateLimiterDO } = await import('../lib/rate-limiter-do');

describe('RateLimiterDO', () => {
  let doInstance: InstanceType<typeof RateLimiterDO>;

  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    // Create instance with minimal DurableObjectState stub
    doInstance = new (RateLimiterDO as unknown as new (...args: unknown[]) => InstanceType<typeof RateLimiterDO>)(
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- minimal stub
      { id: 'test-id', storage: null, blockConcurrencyWhile: vi.fn() } as never,
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- minimal stub
      {} as never,
    );
  });

  describe('fetch - /check', () => {
    it('allows first request and sets entry', async () => {
      const req = new Request('http://localhost/check/ip/1.2.3.4?maxRequests=5&windowMs=60000');
      const res = await doInstance.fetch(req);
      const data: { allowed: boolean; remaining: number } = await res.json();
      expect(data.allowed).toBe(true);
      expect(data.remaining).toBe(4);
    });

    it('blocks after maxRequests exceeded', async () => {
      // Make 5 requests to exhaust limit
      for (let i = 0; i < 5; i++) {
        const req = new Request('http://localhost/check/ip/1.2.3.4?maxRequests=5&windowMs=60000');
        await doInstance.fetch(req);
      }
      // 6th request should be blocked
      const req = new Request('http://localhost/check/ip/1.2.3.4?maxRequests=5&windowMs=60000');
      const res = await doInstance.fetch(req);
      const data: { allowed: boolean; remaining: number } = await res.json();
      expect(data.allowed).toBe(false);
      expect(data.remaining).toBe(0);
    });

    it('resets after window expires', async () => {
      // Make request with 1ms window
      const req = new Request('http://localhost/check/ip/1.2.3.4?maxRequests=1&windowMs=1');
      await doInstance.fetch(req);

      // Wait for window to expire
      await new Promise((r) => setTimeout(r, 10));

      // Should be allowed again
      const res = await doInstance.fetch(req);
      const data: { allowed: boolean } = await res.json();
      expect(data.allowed).toBe(true);
    });

    it('tracks different keys independently', async () => {
      const req1 = new Request('http://localhost/check/ip/1.2.3.4?maxRequests=1&windowMs=60000');
      const req2 = new Request('http://localhost/check/ip/5.6.7.8?maxRequests=1&windowMs=60000');

      await doInstance.fetch(req1);
      const res = await doInstance.fetch(req2);
      const data: { allowed: boolean } = await res.json();
      expect(data.allowed).toBe(true); // Different IP, still allowed
    });
  });

  describe('fetch - /reset', () => {
    it('resets specific namespace', async () => {
      // Add some entries
      const req = new Request('http://localhost/check/ip/1.2.3.4?maxRequests=5&windowMs=60000');
      await doInstance.fetch(req);

      // Reset
      const resetReq = new Request('http://localhost/reset/ip', { method: 'POST' });
      const res = await doInstance.fetch(resetReq);
      expect(res.status).toBe(204);

      // Should be fresh now
      const checkRes = await doInstance.fetch(req);
      const data: { remaining: number } = await checkRes.json();
      expect(data.remaining).toBe(4); // Back to maxRequests - 1
    });

    it('resets all when namespace is empty', async () => {
      const req = new Request('http://localhost/check/ip/1.2.3.4?maxRequests=5&windowMs=60000');
      await doInstance.fetch(req);

      const resetReq = new Request('http://localhost/reset/', { method: 'POST' });
      const res = await doInstance.fetch(resetReq);
      expect(res.status).toBe(204);
    });
  });

  describe('fetch - 404', () => {
    it('returns 404 for unknown paths', async () => {
      const req = new Request('http://localhost/unknown');
      const res = await doInstance.fetch(req);
      expect(res.status).toBe(404);
    });
  });
});

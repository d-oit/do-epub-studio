import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { logClientEventMock } = vi.hoisted(() => ({ logClientEventMock: vi.fn() }));
const { logoutMock } = vi.hoisted(() => ({ logoutMock: vi.fn() }));
const authState = { sessionToken: null as string | null };

vi.mock('../client-logger', () => ({ logClientEvent: logClientEventMock }));
vi.mock('../../stores/locale', () => ({ getCurrentLocale: () => 'en' }));
vi.mock('../../stores/auth', () => ({
  useAuthStore: { getState: () => ({ logout: logoutMock, ...authState }) },
}));

import { apiRequest } from './core';

/**
 * fetch that rejects with the abort reason as soon as the signal fires.
 *
 * Built with the Promise constructor rather than `Promise.withResolvers`
 * because apps/web compiles against the ES2022 lib (lib es2024 is not enabled).
 */
const abortableFetch = () =>
  vi.fn((_url: string, init: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => {
        // Forward the reason's message and name: DOMException satisfies the
        // Error type for lint but is not an `instanceof Error` at runtime, so
        // `reason instanceof Error` would drop the real message.
        const reason: unknown = init.signal?.reason;
        const message = (reason as { message?: string } | undefined)?.message ?? 'Aborted';
        const name = (reason as { name?: string } | undefined)?.name ?? 'AbortError';
        reject(new DOMException(message, name));
      });
    });
  });

const events = () =>
  logClientEventMock.mock.calls.map(([entry]) => (entry as { event: string }).event);

describe('apiRequest abort handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('reports a caller cancellation as api.cancelled, never as a timeout', async () => {
    // Reader effects abort their in-flight requests on cleanup; that is not a
    // deadline expiry and must not be logged as one.
    vi.stubGlobal('fetch', abortableFetch());
    const controller = new AbortController();

    const pending = apiRequest('/api/books/book-1/file-url', { signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toThrow();
    expect(events()).toContain('api.cancelled');
    expect(events()).not.toContain('api.timeout');
  });

  it('reports an expired deadline as api.timeout and does not retry it', async () => {
    vi.useFakeTimers();
    const fetchMock = abortableFetch();
    vi.stubGlobal('fetch', fetchMock);

    const pending = apiRequest('/api/books/book-1/file-url', { timeoutMs: 50 });
    const rejection = expect(pending).rejects.toThrow(/Request timeout/);
    await vi.advanceTimersByTimeAsync(80);
    await rejection;

    expect(events()).toContain('api.timeout');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('apiRequest 401 handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.sessionToken = null;
  });

  const unauthorizedFetch = () => vi.fn(() => Promise.resolve(new Response('', { status: 401 })));

  it('logs out when the rejected request carries the current session token', async () => {
    vi.stubGlobal('fetch', unauthorizedFetch());
    authState.sessionToken = 'token-a';

    await expect(apiRequest('/api/books/book-1/highlights', { token: 'token-a' })).rejects.toThrow(
      /Session expired/,
    );
    expect(logoutMock).toHaveBeenCalledWith('expired');
  });

  it('keeps the newer session signed in when a stale request returns 401', async () => {
    vi.stubGlobal('fetch', unauthorizedFetch());
    authState.sessionToken = 'token-a';

    const pending = apiRequest('/api/books/book-a/highlights', { token: 'token-a' });
    // The reader signs in as someone else while A's replay is still in flight.
    authState.sessionToken = 'token-b';

    await expect(pending).rejects.toThrow(/Session expired/);
    expect(logoutMock).not.toHaveBeenCalled();
  });
});

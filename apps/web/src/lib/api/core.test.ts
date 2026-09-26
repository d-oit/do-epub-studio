import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { logClientEventMock } = vi.hoisted(() => ({ logClientEventMock: vi.fn() }));

vi.mock('../client-logger', () => ({ logClientEvent: logClientEventMock }));
vi.mock('../../stores/locale', () => ({ getCurrentLocale: () => 'en' }));
vi.mock('../../stores/auth', () => ({
  useAuthStore: { getState: () => ({ logout: vi.fn() }) },
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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '@/stores/auth';
import { requireSessionToken } from './session';
import { syncProgress } from './progress-conflict';
import { syncReadingInsight } from './sync-item';
import type { SyncQueueItem } from './db';

describe('requireSessionToken', () => {
  beforeEach(() => {
    useAuthStore.setState({ sessionToken: null });
  });

  it('returns the current session token', () => {
    useAuthStore.setState({ sessionToken: 'token-a' });
    expect(requireSessionToken()).toBe('token-a');
  });

  it('rejects with a 401 when no session is active', () => {
    expect(() => requireSessionToken()).toThrow('Session expired');
    try {
      requireSessionToken();
    } catch (error) {
      expect((error as Error & { status?: number }).status).toBe(401);
    }
  });
});

/**
 * Every worker route the offline replay engine writes to is protected by
 * `readerAuth`, which rejects a request without a bearer token. A replay that
 * omits the token therefore fails with 401 — and, for the raw `api.*` helpers
 * that never throw on a non-2xx status, the queued item would be dropped as
 * "synced" instead of retried.
 */
describe('offline replay authentication', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    useAuthStore.setState({ sessionToken: 'replay-token' });
  });

  function lastRequest(): { url: string; init: RequestInit } {
    const call = fetchMock.mock.calls.at(-1);
    if (!call) throw new Error('No request was sent');
    return { url: String(call[0]), init: (call[1] ?? {}) as RequestInit };
  }

  function insightItem(id: string, mutationId: string): SyncQueueItem {
    return {
      id,
      type: 'reading-insight',
      payload: {
        bookId: 'book-1',
        buckets: [{ date: '2026-10-20', activeMinutes: 5, activePages: 2 }],
        mutationId,
      },
      mutationId,
      createdAt: 1,
      attempts: 0,
    };
  }

  it('sends the bearer token when replaying a progress mutation', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { revision: 1 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await syncProgress({
      id: 'item-1',
      type: 'progress',
      payload: { bookId: 'book-1', cfi: 'cfi', percentage: 50, mutationId: 'm1' },
      mutationId: 'm1',
      createdAt: 1,
      attempts: 0,
    });

    const { init } = lastRequest();
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer replay-token');
  });

  it('sends the bearer token when replaying a reading-insight mutation', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 200 }));

    await syncReadingInsight(insightItem('item-2', 'm2'));

    const { init } = lastRequest();
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer replay-token');
  });

  it('treats a rejected insight replay as a failure instead of a success', async () => {
    // The raw api.* helper resolves for any HTTP status, so a 401 must be
    // turned into a throw — otherwise the queued item is dropped as synced.
    fetchMock.mockResolvedValue(new Response('', { status: 401 }));

    await expect(syncReadingInsight(insightItem('item-3', 'm3'))).rejects.toThrow(/status 401/);
  });

  it('refuses to replay without a session', async () => {
    useAuthStore.setState({ sessionToken: null });

    await expect(syncReadingInsight(insightItem('item-4', 'm4'))).rejects.toThrow(
      'Session expired',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the bearer token when reading the remote progress for a conflict', async () => {
    // The conflict read hits the `readerAuth`-protected progress route; without
    // the token the server answers 401 and the conflict can never be resolved
    // against the remote version.
    const { handleProgressConflict } = await import('./progress-conflict');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: { locator: { cfi: 'remote-cfi' }, progressPercent: 80, revision: 1 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await handleProgressConflict(
      {
        id: 'item-5',
        type: 'progress',
        payload: { bookId: 'book-1', cfi: 'local-cfi', percentage: 35, mutationId: 'm5' },
        mutationId: 'm5',
        createdAt: 1,
        attempts: 0,
      },
      'trace-id',
      'span-id',
    );

    const { init } = lastRequest();
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer replay-token');
  });

  it('sends the bearer token when validating a book permission', async () => {
    // `/api/access/validate` resolves the session from the bearer token, so
    // an unauthenticated check always answers 401 and the cached permission
    // is never refreshed from the server.
    const { validatePermission } = await import('./permissions');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: { grantId: 'grant-1', canComment: true, canDownloadOffline: true },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await validatePermission('book-1');

    const { url, init } = lastRequest();
    expect(url).toContain('/api/access/validate?bookId=book-1');
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer replay-token');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeEnv, makeAuthContext, makePassThroughContext, mockQueryAll, mockRequireAuth, parseBody } from './fixtures';
import { app } from '../app';
import { assertBookAccess } from '../lib/tenant-isolation';

vi.mock('../lib/tenant-isolation', () => ({ parseLocatorRow: vi.fn(), assertBookAccess: vi.fn() }));
const mockAssertBookAccess = assertBookAccess as ReturnType<typeof vi.fn>;

describe('Export Routes', () => {
  const env = makeEnv();
  beforeEach(() => { vi.clearAllMocks(); mockAssertBookAccess.mockResolvedValue(null); });

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await app.fetch(new Request('http://localhost/api/books/b1/export'), env, makePassThroughContext());
    expect(res.status).toBe(401);
  });

  it('returns markdown export with highlights', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    const highlightData = { id: 'h1', selected_text: 'Important', color: 'yellow', note: 'My note', chapter_ref: 'ch1', cfi_range: null, created_at: '2026-07-18' };
    mockQueryAll.mockResolvedValueOnce([highlightData]);
    mockQueryAll.mockResolvedValueOnce([]);
    mockQueryAll.mockResolvedValueOnce([]);
    const mockFirst = vi.fn().mockResolvedValue({ title: 'Test Book' });
    (env.DB as unknown as { first: ReturnType<typeof vi.fn> }).first = mockFirst;
    const res = await app.fetch(new Request('http://localhost/api/books/b1/export?format=markdown', { headers: { Authorization: 'Bearer valid' } }), env, makePassThroughContext());
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.data.format).toBe('markdown');
    expect(body.data.content).toContain('Important');
  });

  it('returns html export with proper structure', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryAll.mockResolvedValueOnce([]);
    mockQueryAll.mockResolvedValueOnce([]);
    mockQueryAll.mockResolvedValueOnce([]);
    const mockFirst = vi.fn().mockResolvedValue({ title: 'Test' });
    (env.DB as unknown as { first: ReturnType<typeof vi.fn> }).first = mockFirst;
    const res = await app.fetch(new Request('http://localhost/api/books/b1/export?format=html', { headers: { Authorization: 'Bearer valid' } }), env, makePassThroughContext());
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.data.format).toBe('html');
    expect(typeof body.data.content).toBe('string');
    expect((body.data.content as string).length).toBeGreaterThan(100);
  });

  it('runs the three export queries concurrently', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    const mockFirst = vi.fn().mockResolvedValue({ title: 'Test Book' });
    (env.DB as unknown as { first: ReturnType<typeof vi.fn> }).first = mockFirst;

    // Deferred promises let us observe that all three queries are started
    // before any result is consumed — the observable signal of Promise.all.
    const resolvers: Array<(v: unknown[]) => void> = [];
    mockQueryAll.mockImplementation(() => new Promise<unknown[]>((resolve) => {
      resolvers.push(resolve);
    }));

    const reqPromise = app.fetch(new Request('http://localhost/api/books/b1/export?format=markdown', {
      headers: { Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());

    // All three queryAll calls must be issued before any response is produced.
    await vi.waitFor(() => expect(mockQueryAll).toHaveBeenCalledTimes(3));

    resolvers[0]([{ id: 'h1', selected_text: 'Concurrent', color: 'yellow', note: null, chapter_ref: 'ch1', cfi_range: null, created_at: '2026-07-18' }]);
    resolvers[1]([]);
    resolvers[2]([]);

    const res = await reqPromise;
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    const content = body.data.content as string;
    expect(content).toContain('Concurrent');
  });

  it('returns 400 for invalid format', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    const res = await app.fetch(new Request('http://localhost/api/books/b1/export?format=invalid', { headers: { Authorization: 'Bearer valid' } }), env, makePassThroughContext());
    expect(res.status).toBe(400);
  });
});

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
    expect(body.data.content).toContain('<!DOCTYPE html>');
    expect(body.data.content).toContain('</html>');
  });

  it('returns 400 for invalid format', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    const res = await app.fetch(new Request('http://localhost/api/books/b1/export?format=invalid', { headers: { Authorization: 'Bearer valid' } }), env, makePassThroughContext());
    expect(res.status).toBe(400);
  });
});

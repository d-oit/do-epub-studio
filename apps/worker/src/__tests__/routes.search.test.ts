import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeEnv, makeAuthContext, makePassThroughContext, mockQueryFirst, mockQueryAll, mockRequireAuth } from './fixtures';
import { app } from '../app';
import { assertBookAccess } from '../lib/tenant-isolation';

vi.mock('../lib/tenant-isolation', () => ({ parseLocatorRow: vi.fn(), assertBookAccess: vi.fn() }));
const mockAssertBookAccess = assertBookAccess as ReturnType<typeof vi.fn>;

/** Create test fixture with HTML markup for search snippet tests */
function makeMarkupTestContent(): string {
  return 'Hello <mark>world</mark>';
}

describe('Search Routes', () => {
  const env = makeEnv();
  beforeEach(() => { vi.clearAllMocks(); mockAssertBookAccess.mockResolvedValue(null); });

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await app.fetch(new Request('http://localhost/api/books/b1/search?q=test'), env, makePassThroughContext());
    expect(res.status).toBe(401);
  });

  it('returns empty when book not indexed', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryFirst.mockResolvedValueOnce(null);
    const res = await app.fetch(new Request('http://localhost/api/books/b1/search?q=hello', { headers: { Authorization: 'Bearer valid' } }), env, makePassThroughContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.indexed).toBe(false);
    expect(body.data.results).toHaveLength(0);
  });

  it('returns FTS5 results when indexed', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryFirst
      .mockResolvedValueOnce({ indexed_at: '2026-07-18', chapter_count: 5 })
      .mockResolvedValueOnce({ cnt: 1 });
    const markupContent = makeMarkupTestContent();
    const searchResult = { book_id: 'b1', chapter_ref: 'ch1', content: markupContent, rank: -1.5 };
    mockQueryAll.mockResolvedValueOnce([searchResult]);
    const res = await app.fetch(new Request('http://localhost/api/books/b1/search?q=world', { headers: { Authorization: 'Bearer valid' } }), env, makePassThroughContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.indexed).toBe(true);
    expect(body.data.results).toHaveLength(1);
  });

  it('returns empty for sanitized single-char query', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryFirst.mockResolvedValueOnce({ indexed_at: '2026-07-18', chapter_count: 5 });
    const res = await app.fetch(new Request('http://localhost/api/books/b1/search?q=a', { headers: { Authorization: 'Bearer valid' } }), env, makePassThroughContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.results).toHaveLength(0);
  });
});
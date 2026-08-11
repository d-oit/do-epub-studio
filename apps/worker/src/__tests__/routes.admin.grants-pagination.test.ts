import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeEnv, makePassThroughContext, mockQueryAll, mockRequireAdminAuth } from './fixtures';
import { app } from '../app';

// Standalone grants pagination test (kept out of routes.admin.test.ts to avoid
// colliding with concurrent edits by other slices). Reuses fixtures' vi.mock
// scaffolding (db/client, admin middleware, audit, etc.) so it runs on its own.
describe('Admin Routes — GET /books/:id/grants pagination', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminAuth.mockResolvedValue({
      ok: true,
      context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
    });
  });

  function fetchGrants(query = '') {
    return app.fetch(
      new Request(`http://localhost/api/admin/books/book-1/grants${query}`, {
        headers: { Authorization: 'Bearer admin-token' },
      }),
      env,
      makePassThroughContext(),
    );
  }

  it('applies the default page limit when no query params are provided', async () => {
    mockQueryAll.mockResolvedValue([]);
    const res = await fetchGrants();
    expect(res.status).toBe(200);
    const sql = mockQueryAll.mock.calls[0][1] as string;
    expect(sql).toMatch(/LIMIT \? OFFSET \?/);
    expect(mockQueryAll.mock.calls[0][2] as unknown[]).toEqual(['book-1', 1000, 0]);
  });

  it('respects the limit param', async () => {
    mockQueryAll.mockResolvedValue([]);
    const res = await fetchGrants('?limit=25');
    expect(res.status).toBe(200);
    expect(mockQueryAll.mock.calls[0][2] as unknown[]).toEqual(['book-1', 25, 0]);
  });

  it('applies the offset param', async () => {
    mockQueryAll.mockResolvedValue([]);
    const res = await fetchGrants('?limit=10&offset=30');
    expect(res.status).toBe(200);
    expect(mockQueryAll.mock.calls[0][2] as unknown[]).toEqual(['book-1', 10, 30]);
  });

  it('rejects an over-large limit (clamped via schema validation)', async () => {
    const res = await fetchGrants('?limit=5000');
    expect(res.status).toBe(400);
    expect(mockQueryAll).not.toHaveBeenCalled();
  });

  it('rejects a negative limit', async () => {
    const res = await fetchGrants('?limit=-5');
    expect(res.status).toBe(400);
    expect(mockQueryAll).not.toHaveBeenCalled();
  });
});

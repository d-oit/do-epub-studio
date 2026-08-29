import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  makePassThroughContext,
  mockQueryAll,
  mockRequireAdminAuth,
} from './fixtures';
import { app } from '../app';

describe('Admin Routes — GET /api/admin/insights', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns aggregated book-level reading stats without individual emails', async () => {
    mockRequireAdminAuth.mockResolvedValue({
      ok: true,
      context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
    });

    mockQueryAll.mockResolvedValue([
      {
        book_id: 'book-1',
        total_active_minutes: 120,
        total_active_pages: 45,
        reader_count: 3,
        last_activity: '2026-08-09',
      },
      {
        book_id: 'book-2',
        total_active_minutes: 60,
        total_active_pages: 20,
        reader_count: 1,
        last_activity: '2026-08-07',
      },
    ]);

    const res = await app.fetch(
      new Request('http://localhost/api/admin/insights', {
        headers: { Authorization: 'Bearer admin-token' },
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    const body: {
      ok: boolean;
      data: Array<{
        bookId: string;
        totalActiveMinutes: number;
        readerCount: number;
      }>;
      pagination: { limit: number; offset: number };
    } = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].bookId).toBe('book-1');
    expect(body.data[0].totalActiveMinutes).toBe(120);
    expect(body.data[0].readerCount).toBe(3);
    // No user_email in response
    expect('userEmail' in body.data[0]).toBe(false);
    expect(body.pagination.limit).toBe(20);
    expect(body.pagination.offset).toBe(0);
  });

  it('respects limit and offset query params', async () => {
    mockRequireAdminAuth.mockResolvedValue({
      ok: true,
      context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
    });
    mockQueryAll.mockResolvedValue([]);

    const res = await app.fetch(
      new Request('http://localhost/api/admin/insights?limit=5&offset=10', {
        headers: { Authorization: 'Bearer admin-token' },
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    const body: { pagination: { limit: number; offset: number } } = await res.json();
    expect(body.pagination.limit).toBe(5);
    expect(body.pagination.offset).toBe(10);
  });

  it('returns 400 when limit exceeds 100', async () => {
    mockRequireAdminAuth.mockResolvedValue({
      ok: true,
      context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
    });

    const res = await app.fetch(
      new Request('http://localhost/api/admin/insights?limit=999', {
        headers: { Authorization: 'Bearer admin-token' },
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(400);
  });

  it('returns 401 without admin auth', async () => {
    mockRequireAdminAuth.mockResolvedValue({
      ok: false,
      error: 'Unauthorized',
      status: 401,
    });

    const res = await app.fetch(
      new Request('http://localhost/api/admin/insights'),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(401);
  });

  it('returns 400 for negative offset', async () => {
    mockRequireAdminAuth.mockResolvedValue({
      ok: true,
      context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
    });

    const res = await app.fetch(
      new Request('http://localhost/api/admin/insights?offset=-5', {
        headers: { Authorization: 'Bearer admin-token' },
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(400);
  });

  it('returns 400 when offset exceeds max limit', async () => {
    mockRequireAdminAuth.mockResolvedValue({
      ok: true,
      context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
    });

    const res = await app.fetch(
      new Request('http://localhost/api/admin/insights?offset=9999999', {
        headers: { Authorization: 'Bearer admin-token' },
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(400);
  });

  it('returns 400 for non-numeric params', async () => {
    mockRequireAdminAuth.mockResolvedValue({
      ok: true,
      context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
    });

    const res = await app.fetch(
      new Request('http://localhost/api/admin/insights?limit=abc&offset=abc', {
        headers: { Authorization: 'Bearer admin-token' },
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(400);
  });
});

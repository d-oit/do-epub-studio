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

  it('caps limit at 100', async () => {
    mockRequireAdminAuth.mockResolvedValue({
      ok: true,
      context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
    });
    mockQueryAll.mockResolvedValue([]);

    const res = await app.fetch(
      new Request('http://localhost/api/admin/insights?limit=999', {
        headers: { Authorization: 'Bearer admin-token' },
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    const body: { pagination: { limit: number } } = await res.json();
    expect(body.pagination.limit).toBe(100);
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

  it('clamps negative offset to 0', async () => {
    mockRequireAdminAuth.mockResolvedValue({
      ok: true,
      context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
    });
    mockQueryAll.mockResolvedValue([]);

    const res = await app.fetch(
      new Request('http://localhost/api/admin/insights?offset=-5', {
        headers: { Authorization: 'Bearer admin-token' },
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    const body: { pagination: { offset: number } } = await res.json();
    expect(body.pagination.offset).toBe(0);
  });

  it('integer-truncates float limit and offset', async () => {
    mockRequireAdminAuth.mockResolvedValue({
      ok: true,
      context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
    });
    mockQueryAll.mockResolvedValue([]);

    const res = await app.fetch(
      new Request('http://localhost/api/admin/insights?limit=1.9&offset=2.7', {
        headers: { Authorization: 'Bearer admin-token' },
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    const body: { pagination: { limit: number; offset: number } } = await res.json();
    expect(body.pagination.limit).toBe(1);
    expect(body.pagination.offset).toBe(2);
  });

  it('caps offset at MAX_OFFSET', async () => {
    mockRequireAdminAuth.mockResolvedValue({
      ok: true,
      context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
    });
    mockQueryAll.mockResolvedValue([]);

    const res = await app.fetch(
      new Request('http://localhost/api/admin/insights?offset=9999999', {
        headers: { Authorization: 'Bearer admin-token' },
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    const body: { pagination: { offset: number } } = await res.json();
    expect(body.pagination.offset).toBe(100_000);
  });

  // GOAP-224 B15/B19: non-numeric query params parse to NaN and must fall
  // back to the defaults instead of firing a bogus SQL LIMIT/OFFSET or 500.
  it('falls back to default limit/offset for non-numeric params (B15/B19)', async () => {
    mockRequireAdminAuth.mockResolvedValue({
      ok: true,
      context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
    });
    mockQueryAll.mockResolvedValue([]);

    const res = await app.fetch(
      new Request('http://localhost/api/admin/insights?limit=abc&offset=abc', {
        headers: { Authorization: 'Bearer admin-token' },
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    const body: { pagination: { limit: number; offset: number } } = await res.json();
    expect(body.pagination.limit).toBe(20);
    expect(body.pagination.offset).toBe(0);
  });

  it('falls back independently per NaN param (B19)', async () => {
    mockRequireAdminAuth.mockResolvedValue({
      ok: true,
      context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
    });
    mockQueryAll.mockResolvedValue([]);

    // limit NaN → 20; offset valid → respected.
    const resLimitNaN = await app.fetch(
      new Request('http://localhost/api/admin/insights?limit=not-a-number&offset=7', {
        headers: { Authorization: 'Bearer admin-token' },
      }),
      env,
      makePassThroughContext(),
    );
    expect(resLimitNaN.status).toBe(200);
    const bodyLimitNaN: { pagination: { limit: number; offset: number } } = await resLimitNaN.json();
    expect(bodyLimitNaN.pagination.limit).toBe(20);
    expect(bodyLimitNaN.pagination.offset).toBe(7);

    // offset NaN → 0; limit valid → respected.
    const resOffsetNaN = await app.fetch(
      new Request('http://localhost/api/admin/insights?limit=3&offset=nope', {
        headers: { Authorization: 'Bearer admin-token' },
      }),
      env,
      makePassThroughContext(),
    );
    expect(resOffsetNaN.status).toBe(200);
    const bodyOffsetNaN: { pagination: { limit: number; offset: number } } = await resOffsetNaN.json();
    expect(bodyOffsetNaN.pagination.limit).toBe(3);
    expect(bodyOffsetNaN.pagination.offset).toBe(0);
  });
});

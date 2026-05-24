import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../app';
import { makeEnv } from './fixtures';
import { requireAdminAuth } from '../auth/admin-middleware';

// Mock everything needed for integration tests
vi.mock('../auth/admin-middleware', () => ({
  requireAdminAuth: vi.fn(),
  createAdminSession: vi.fn(),
  revokeAdminSession: vi.fn(),
}));

vi.mock('../auth/middleware', () => ({
  requireAuth: vi.fn(),
}));

describe('API Validation Integration', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for admin auth
    vi.mocked(requireAdminAuth).mockResolvedValue({
      ok: true,
      context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
    } as any);
  });

  it('rejects invalid JSON in /api/access/request', async () => {
    const res = await app.fetch(
      new Request('http://localhost/api/access/request', {
        method: 'POST',
        body: JSON.stringify({ bookSlug: '', email: 'invalid-email' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      env,
    );

    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.success).toBe(false);
    expect(body.error.name).toBe('ZodError');
  });

  it('rejects missing fields in /api/admin/login', async () => {
    const res = await app.fetch(
      new Request('http://localhost/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@example.com' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      env,
    );

    expect(res.status).toBe(400);
  });

  it('rejects invalid visibility in /api/admin/books', async () => {
    const res = await app.fetch(
      new Request('http://localhost/api/admin/books', {
        method: 'POST',
        body: JSON.stringify({
          title: 'New Book',
          slug: 'new-book',
          visibility: 'invalid-status',
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin-token'
        },
      }),
      env,
    );

    expect(res.status).toBe(400);
  });
});

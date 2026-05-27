import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../app';
import { makeEnv } from './fixtures';
import * as adminMiddleware from '../auth/admin-middleware';
import { requireAuth } from '../auth/middleware';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type AdminMiddleware = typeof import('../auth/admin-middleware');

// Mock everything needed for integration tests
vi.mock('../auth/admin-middleware', async (importOriginal) => {
  const actual = await importOriginal<AdminMiddleware>();
  return {
    ...actual,
    requireAdminAuth: vi.fn(),
    createAdminSession: vi.fn(),
    revokeAdminSession: vi.fn(),
  };
});

vi.mock('../auth/middleware', () => ({
  requireAuth: vi.fn(),
}));

describe('API Validation Integration', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for admin auth
    vi.mocked(adminMiddleware.requireAdminAuth).mockResolvedValue({
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

  it('rejects invalid CSP report', async () => {
    const res = await app.fetch(
      new Request('http://localhost/api/csp-report', {
        method: 'POST',
        body: JSON.stringify({ 'csp-report': { 'document-uri': 'not-a-url' } }),
        headers: { 'Content-Type': 'application/json' },
      }),
      env,
    );

    expect(res.status).toBe(400);
  });

  it('rejects invalid input on protected route before authentication', async () => {
    // Mock requireAuth to return null (unauthorized)
    vi.mocked(requireAuth).mockResolvedValue(null);

    const res = await app.fetch(
      new Request('http://localhost/api/books/test-book/progress', {
        method: 'PUT',
        body: JSON.stringify({ progressPercent: 150 }), // Invalid percent (> 100)
        headers: { 'Content-Type': 'application/json' },
      }),
      env,
    );

    // Should be 400 (validation) not 401 (unauthorized) because validation happens first
    expect(res.status).toBe(400);
  });
});

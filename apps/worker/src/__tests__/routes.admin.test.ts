import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  mockQueryAll,
  mockExecute,
  mockCreateGrant,
} from './fixtures';
import { app } from '../app';

describe('Admin Routes', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/admin/books', () => {
    it('creates book and returns success', async () => {
      const { requireAdminAuth } = await import('../auth/admin-middleware');
      vi.mocked(requireAdminAuth).mockResolvedValue({
        ok: true,
        context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
      } as any);

      mockExecute.mockResolvedValue({} as any);

      const res = await app.fetch(new Request('http://localhost/api/admin/books', {
        method: 'POST',
        body: JSON.stringify({
          title: 'New Book',
          slug: 'new-book',
        }),
        headers: { 'Content-Type': 'application/json' },
      }), env);

      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.ok).toBe(true);
    });
  });

  describe('POST /api/admin/books/:id/grants', () => {
    it('creates grant and returns success', async () => {
      const { requireAdminAuth } = await import('../auth/admin-middleware');
      vi.mocked(requireAdminAuth).mockResolvedValue({
        ok: true,
        context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
      } as any);

      mockCreateGrant.mockResolvedValue('grant-1');

      const res = await app.fetch(new Request('http://localhost/api/admin/books/book-1/grants', {
        method: 'POST',
        body: JSON.stringify({
          bookId: '36069966-239f-431e-b83c-1d020d575791', // Valid UUID
          email: 'user@example.com',
          mode: 'private',
        }),
        headers: { 'Content-Type': 'application/json' },
      }), env);

      expect(res.status).toBe(201);
    });
  });

  describe('GET /api/admin/audit', () => {
    it('returns audit log entries', async () => {
      const { requireAdminAuth } = await import('../auth/admin-middleware');
      vi.mocked(requireAdminAuth).mockResolvedValue({
        ok: true,
        context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
      } as any);

      mockQueryAll
        .mockResolvedValueOnce([{ cnt: 1 }]) // count query
        .mockResolvedValueOnce([{ id: '1', actor_email: 'admin@ex.com', action: 'query' }]); // rows query

      const res = await app.fetch(new Request('http://localhost/api/admin/audit'), env);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.entries).toHaveLength(1);
    });
  });
});

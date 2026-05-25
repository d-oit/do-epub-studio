import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  mockQueryAll,
  mockQueryFirst,
  mockExecute,
  mockCreateGrant,
  mockCreateAdminSession,
  mockRevokeAdminSession,
  mockRequireAdminAuth,
} from './fixtures';
import { app } from '../app';

describe('Admin Routes', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/admin/login', () => {
    it('returns success on valid credentials', async () => {
      mockCreateAdminSession.mockResolvedValue({
        ok: true,
        token: 'admin-token',
        user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' },
        status: 200
      } as any);

      const res = await app.fetch(new Request('http://localhost/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@example.com', password: 'password' }),
        headers: { 'Content-Type': 'application/json' },
      }), env);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.token).toBe('admin-token');
    });

    it('returns 401 on invalid credentials', async () => {
      mockCreateAdminSession.mockResolvedValue({
        ok: false,
        error: 'Invalid credentials',
        status: 401
      } as any);

      const res = await app.fetch(new Request('http://localhost/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@example.com', password: 'wrong' }),
        headers: { 'Content-Type': 'application/json' },
      }), env);

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/admin/logout', () => {
    it('returns success', async () => {
      mockRevokeAdminSession.mockResolvedValue(undefined);
      const res = await app.fetch(new Request('http://localhost/api/admin/logout', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer token' },
      }), env);
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/admin/books', () => {
    it('creates book and returns success', async () => {
      mockRequireAdminAuth.mockResolvedValue({
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin-token'
        },
      }), env);

      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.ok).toBe(true);
    });
  });

  describe('PUT /api/admin/books/:id/upload', () => {
    it('uploads file to bucket', async () => {
      mockRequireAdminAuth.mockResolvedValue({
        ok: true,
        context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
      } as any);

      mockQueryFirst.mockResolvedValue({ id: 'book-1', slug: 'book-slug' });

      const res = await app.fetch(new Request('http://localhost/api/admin/books/book-1/upload', {
        method: 'PUT',
        body: 'epub-content',
        headers: {
          'Content-Type': 'application/epub+zip',
          'Content-Length': '12',
          'Authorization': 'Bearer admin-token'
        },
      }), env);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.storageKey).toBeDefined();
    });
  });

  describe('POST /api/admin/books/:id/upload-complete', () => {
    it('records file in database', async () => {
      mockRequireAdminAuth.mockResolvedValue({
        ok: true,
        context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
      } as any);

      mockExecute.mockResolvedValue({} as any);

      const res = await app.fetch(new Request('http://localhost/api/admin/books/book-1/upload-complete', {
        method: 'POST',
        body: JSON.stringify({
          storageKey: 'key',
          originalFilename: 'test.epub',
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin-token'
        },
      }), env);

      expect(res.status).toBe(201);
    });
  });

  describe('POST /api/admin/books/:id/grants', () => {
    it('creates grant and returns success', async () => {
      mockRequireAdminAuth.mockResolvedValue({
        ok: true,
        context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
      } as any);

      mockCreateGrant.mockResolvedValue('grant-1');

      const res = await app.fetch(new Request('http://localhost/api/admin/books/36069966-239f-431e-b83c-1d020d575791/grants', {
        method: 'POST',
        body: JSON.stringify({
          bookId: '36069966-239f-431e-b83c-1d020d575791',
          email: 'user@example.com',
          mode: 'private',
          commentsAllowed: true,
          offlineAllowed: true
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin-token'
        },
      }), env);

      expect(res.status).toBe(201);
    });
  });

  describe('GET /api/admin/books/:id/grants', () => {
    it('returns list of grants', async () => {
      mockRequireAdminAuth.mockResolvedValue({
        ok: true,
        context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
      } as any);

      mockQueryAll.mockResolvedValue([
        { id: 'grant-1', email: 'user@example.com', mode: 'private', allowed: 1 }
      ]);

      const res = await app.fetch(new Request('http://localhost/api/admin/books/book-1/grants', {
        headers: { 'Authorization': 'Bearer admin-token' }
      }), env);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data).toHaveLength(1);
    });
  });

  describe('PATCH /api/admin/grants/:id', () => {
    it('updates grant and returns success', async () => {
      mockRequireAdminAuth.mockResolvedValue({
        ok: true,
        context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
      } as any);

      mockExecute.mockResolvedValue({} as any);

      const res = await app.fetch(new Request('http://localhost/api/admin/grants/grant-1', {
        method: 'PATCH',
        body: JSON.stringify({ mode: 'public' }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin-token'
        },
      }), env);

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/admin/grants/:id/revoke', () => {
    it('revokes grant and returns success', async () => {
      mockRequireAdminAuth.mockResolvedValue({
        ok: true,
        context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
      } as any);

      mockExecute.mockResolvedValue({} as any);

      const res = await app.fetch(new Request('http://localhost/api/admin/grants/grant-1/revoke', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer admin-token' },
      }), env);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/admin/audit', () => {
    it('returns audit log entries with filters', async () => {
      mockRequireAdminAuth.mockResolvedValue({
        ok: true,
        context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
      } as any);

      mockQueryAll
        .mockResolvedValueOnce([{ cnt: 1 }]) // count query
        .mockResolvedValueOnce([{ id: '1', actor_email: 'admin@ex.com', action: 'query' }]); // rows query

      const res = await app.fetch(new Request('http://localhost/api/admin/audit?entityType=book&limit=10'), env);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.entries).toHaveLength(1);
    });
  });

  describe('GET /api/admin/audit-logs', () => {
    it('redirects to /api/admin/audit', async () => {
      const res = await app.fetch(new Request('http://localhost/api/admin/audit-logs'), env);
      expect(res.status).toBe(301);
      expect(res.headers.get('Location')).toContain('/api/admin/audit');
    });
  });
});

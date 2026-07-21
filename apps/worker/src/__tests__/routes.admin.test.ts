import { describe, it, expect, vi, beforeEach } from 'vitest';
import JSZip from 'jszip';
import {
  makeEnv,
  makePassThroughContext,
  mockQueryAll,
  mockQueryFirst,
  mockExecute,
  mockTransaction,
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
      }), env, makePassThroughContext());

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
      }), env, makePassThroughContext());

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/admin/logout', () => {
    it('returns success', async () => {
      mockRevokeAdminSession.mockResolvedValue(undefined);
      const res = await app.fetch(new Request('http://localhost/api/admin/logout', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer token' },
      }), env, makePassThroughContext());
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
      }), env, makePassThroughContext());

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

      const zip = new JSZip();
      zip.file('mimetype', 'application/epub+zip');
      zip.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
      zip.file('OEBPS/content.opf', '<?xml version="1.0"?><package version="3.0" xmlns="http://www.idpf.org/2007/opf"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Test</dc:title></metadata><manifest><item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/></manifest><spine></spine></package>');
      const epubBuffer = await zip.generateAsync({ type: 'arraybuffer' });

      const res = await app.fetch(new Request('http://localhost/api/admin/books/book-1/upload', {
        method: 'PUT',
        body: epubBuffer,
        headers: {
          'Content-Type': 'application/epub+zip',
          'Content-Length': String(epubBuffer.byteLength),
          'Authorization': 'Bearer admin-token'
        },
      }), env, makePassThroughContext());

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
      }), env, makePassThroughContext());

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
      }), env, makePassThroughContext());

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
      }), env, makePassThroughContext());

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

      mockTransaction.mockResolvedValue(undefined);

      const res = await app.fetch(new Request('http://localhost/api/admin/grants/grant-1', {
        method: 'PATCH',
        body: JSON.stringify({ mode: 'public' }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin-token'
        },
      }), env, makePassThroughContext());

      expect(res.status).toBe(200);
    });

    it('revokes active reader_sessions on grant update (TIER-1)', async () => {
      mockRequireAdminAuth.mockResolvedValue({
        ok: true,
        context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
      } as any);

      mockTransaction.mockResolvedValue(undefined);

      const res = await app.fetch(new Request('http://localhost/api/admin/grants/grant-1', {
        method: 'PATCH',
        body: JSON.stringify({ mode: 'reader_only', commentsAllowed: false }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin-token'
        },
      }), env, makePassThroughContext());

      expect(res.status).toBe(200);
      // TIER-1: must use transaction so UPDATE + session-revoke are atomic
      expect(mockTransaction).toHaveBeenCalled();
      const txArgs = mockTransaction.mock.calls[0]?.[1] as Array<{ sql: string }> | undefined;
      expect(txArgs).toBeDefined();
      // Verify the transaction includes both the UPDATE and the session-revocation
      const sqls = (txArgs ?? []).map((s) => s.sql).join('\n');
      expect(sqls).toContain('UPDATE book_access_grants');
      expect(sqls).toContain('UPDATE reader_sessions SET revoked_at');
    });
  });

  describe('POST /api/admin/grants/:id/revoke', () => {
    it('revokes grant and returns success', async () => {
      mockRequireAdminAuth.mockResolvedValue({
        ok: true,
        context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
      } as any);

      mockTransaction.mockResolvedValue(undefined);

      const res = await app.fetch(new Request('http://localhost/api/admin/grants/grant-1/revoke', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer admin-token' },
      }), env, makePassThroughContext());

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

      const res = await app.fetch(new Request('http://localhost/api/admin/audit?entityType=book&limit=10'), env, makePassThroughContext());
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.entries).toHaveLength(1);
    });
  });

  describe('DELETE /api/admin/books/:id — cascade delete', () => {
    it('soft-deletes book and cascades to all child tables + R2 objects', async () => {
      mockRequireAdminAuth.mockResolvedValue({
        ok: true,
        context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
      } as any);

      // Book exists and is not archived
      mockQueryFirst.mockResolvedValue({ id: 'book-1' });
      // R2 file objects to delete
      const mockBucketDelete = vi.fn().mockResolvedValue(undefined);
      (env as unknown as Record<string, unknown>).BOOKS_BUCKET = {
        ...env.BOOKS_BUCKET,
        delete: mockBucketDelete,
      };

      mockQueryAll.mockResolvedValue([
        { storage_key: 'books/book-1/file-a.epub' },
        { storage_key: 'books/book-1/file-b.epub' },
      ]);
      mockTransaction.mockResolvedValue(undefined);

      const res = await app.fetch(new Request('http://localhost/api/admin/books/book-1', {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer admin-token' },
      }), env, makePassThroughContext());

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.r2ObjectsDeleted).toBe(2);

      // Verify R2 delete called for each file
      expect(mockBucketDelete).toHaveBeenCalledTimes(2);
      expect(mockBucketDelete).toHaveBeenCalledWith('books/book-1/file-a.epub');
      expect(mockBucketDelete).toHaveBeenCalledWith('books/book-1/file-b.epub');

      // Verify transaction contains all 9 cascade statements
      expect(mockTransaction).toHaveBeenCalled();
      const txArgs = mockTransaction.mock.calls[0]?.[1] as Array<{ sql: string }> | undefined;
      expect(txArgs).toBeDefined();
      expect(txArgs).toHaveLength(9);
      const sqls = (txArgs ?? []).map((s) => s.sql).join('\n');
      expect(sqls).toContain('DELETE FROM reading_insights');
      expect(sqls).toContain('DELETE FROM reading_progress');
      expect(sqls).toContain('DELETE FROM bookmarks');
      expect(sqls).toContain('DELETE FROM highlights');
      expect(sqls).toContain('DELETE FROM comments');
      expect(sqls).toContain('DELETE FROM reader_sessions');
      expect(sqls).toContain('DELETE FROM book_access_grants');
      expect(sqls).toContain('DELETE FROM book_files');
      expect(sqls).toContain('UPDATE books SET archived_at');
    });

    it('returns 404 when book not found or already archived', async () => {
      mockRequireAdminAuth.mockResolvedValue({
        ok: true,
        context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
      } as any);

      mockQueryFirst.mockResolvedValue(null);

      const res = await app.fetch(new Request('http://localhost/api/admin/books/nonexistent', {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer admin-token' },
      }), env, makePassThroughContext());

      expect(res.status).toBe(404);
    });

    it('succeeds even when R2 delete fails', async () => {
      mockRequireAdminAuth.mockResolvedValue({
        ok: true,
        context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
      } as any);

      mockQueryFirst.mockResolvedValue({ id: 'book-1' });
      const mockBucketDelete = vi.fn().mockRejectedValue(new Error('R2 unavailable'));
      (env as unknown as Record<string, unknown>).BOOKS_BUCKET = {
        ...env.BOOKS_BUCKET,
        delete: mockBucketDelete,
      };

      mockQueryAll.mockResolvedValue([
        { storage_key: 'books/book-1/file-a.epub' },
      ]);
      mockTransaction.mockResolvedValue(undefined);

      const res = await app.fetch(new Request('http://localhost/api/admin/books/book-1', {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer admin-token' },
      }), env, makePassThroughContext());

      // DB cascade should still succeed even if R2 fails
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      // r2ObjectsDeleted reports attempted count, not success count
      expect(body.data.r2ObjectsDeleted).toBe(1);
      expect(mockTransaction).toHaveBeenCalled();
    });

    it('handles book with no files gracefully', async () => {
      mockRequireAdminAuth.mockResolvedValue({
        ok: true,
        context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
      } as any);

      mockQueryFirst.mockResolvedValue({ id: 'book-1' });
      const mockBucketDelete = vi.fn();
      (env as unknown as Record<string, unknown>).BOOKS_BUCKET = {
        ...env.BOOKS_BUCKET,
        delete: mockBucketDelete,
      };

      // No files for this book
      mockQueryAll.mockResolvedValue([]);
      mockTransaction.mockResolvedValue(undefined);

      const res = await app.fetch(new Request('http://localhost/api/admin/books/book-1', {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer admin-token' },
      }), env, makePassThroughContext());

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.r2ObjectsDeleted).toBe(0);
      expect(mockBucketDelete).not.toHaveBeenCalled();
      expect(mockTransaction).toHaveBeenCalled();
    });

    it('verifies correct argument binding for cascade statements', async () => {
      mockRequireAdminAuth.mockResolvedValue({
        ok: true,
        context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
      } as any);

      mockQueryFirst.mockResolvedValue({ id: 'book-1' });
      const mockBucketDelete = vi.fn().mockResolvedValue(undefined);
      (env as unknown as Record<string, unknown>).BOOKS_BUCKET = {
        ...env.BOOKS_BUCKET,
        delete: mockBucketDelete,
      };

      mockQueryAll.mockResolvedValue([
        { storage_key: 'books/book-1/file-a.epub' },
      ]);
      mockTransaction.mockResolvedValue(undefined);

      await app.fetch(new Request('http://localhost/api/admin/books/book-1', {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer admin-token' },
      }), env, makePassThroughContext());

      const txArgs = mockTransaction.mock.calls[0]?.[1] as Array<{ sql: string; args: unknown[] }> | undefined;
      expect(txArgs).toBeDefined();

      // Each DELETE statement should bind the book ID as first argument
      for (const stmt of txArgs ?? []) {
        if (stmt.sql.startsWith('DELETE FROM') || stmt.sql.startsWith('UPDATE books')) {
          expect(stmt.args?.[0]).toBe('book-1');
        }
      }
    });
  });

  describe('GET /api/admin/stats', () => {
    it('returns dashboard statistics', async () => {
      mockRequireAdminAuth.mockResolvedValue({
        ok: true,
        context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
      } as any);

      // The stats endpoint runs 4 parallel queryFirst calls + 1 queryFirst + 1 queryAll
      mockQueryFirst
        .mockResolvedValueOnce({ cnt: 5 })      // totalBooks
        .mockResolvedValueOnce({ cnt: 12 })      // activeGrants
        .mockResolvedValueOnce({ cnt: 3 })       // activeSessions
        .mockResolvedValueOnce({ cnt: 2 })       // archivedBooks
        .mockResolvedValueOnce({ total_bytes: 10485760 }); // storage (10 MB)

      mockQueryAll.mockResolvedValue([
        { action: 'created', cnt: 4 },
        { action: 'file_uploaded', cnt: 2 },
      ]);

      const res = await app.fetch(new Request('http://localhost/api/admin/stats', {
        headers: { 'Authorization': 'Bearer admin-token' },
      }), env, makePassThroughContext());

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.ok).toBe(true);
      expect(body.data.totalBooks).toBe(5);
      expect(body.data.activeGrants).toBe(12);
      expect(body.data.activeSessions).toBe(3);
      expect(body.data.archivedBooks).toBe(2);
      expect(body.data.storageBytes).toBe(10485760);
      expect(body.data.recentActivity).toHaveLength(2);
      expect(body.data.recentActivity[0].action).toBe('created');
      expect(body.data.recentActivity[0].count).toBe(4);
    });
  });

  describe('GET /api/admin/audit-logs', () => {
    it('returns 404 — redirect removed, frontend calls /audit directly', async () => {
      const res = await app.fetch(new Request('http://localhost/api/admin/audit-logs'), env, makePassThroughContext());
      expect(res.status).toBe(404);
    });
  });
});

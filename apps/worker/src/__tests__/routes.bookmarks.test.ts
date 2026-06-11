import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  makePassThroughContext,
  mockQueryAll,
  mockExecute,
  mockRequireAuth,
} from './fixtures';
import { app } from '../app';

describe('Bookmark Routes', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/books/:bookId/bookmarks', () => {
    it('returns 401 when unauthenticated', async () => {
      mockRequireAuth.mockResolvedValue(null);
      const res = await app.fetch(
        new Request('http://localhost/api/books/book-1/bookmarks'),
        env,
        makePassThroughContext() as unknown as ExecutionContext,
      );
      expect(res.status).toBe(401);
    });

    it('returns bookmarks when authenticated', async () => {
      mockRequireAuth.mockResolvedValue({ email: 'user@example.com', capabilities: { canBookmark: true } } as any);
      mockQueryAll.mockResolvedValue([
        { id: 'bm-1', book_id: 'book-1', user_email: 'user@example.com', locator_json: '{"cfi":"epubcfi(/6/4)"}', label: 'Chapter 1', created_at: '2025-01-01T00:00:00Z' },
      ]);

      const res = await app.fetch(
        new Request('http://localhost/api/books/book-1/bookmarks', { headers: { Authorization: 'Bearer valid' } }),
        env,
        makePassThroughContext() as unknown as ExecutionContext,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe('bm-1');
      expect(body.data[0].locator.cfi).toBe('epubcfi(/6/4)');
      expect(body.data[0].label).toBe('Chapter 1');
    });
  });

  describe('POST /api/books/:bookId/bookmarks', () => {
    it('creates bookmark and returns 201', async () => {
      mockRequireAuth.mockResolvedValue({ email: 'user@example.com', capabilities: { canBookmark: true } } as any);
      mockExecute.mockResolvedValue({} as any);

      const res = await app.fetch(
        new Request('http://localhost/api/books/book-1/bookmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid' },
          body: JSON.stringify({ locator: { cfi: 'epubcfi(/6/8)', selectedText: 'test', chapterRef: 'chapter1.xhtml' }, label: 'My Bookmark' }),
        }),
        env,
        makePassThroughContext() as unknown as ExecutionContext,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.data.label).toBe('My Bookmark');
      expect(body.data.id).toBeDefined();
    });

    it('returns 403 when canBookmark is false', async () => {
      mockRequireAuth.mockResolvedValue({ email: 'user@example.com', capabilities: { canBookmark: false } } as any);

      const res = await app.fetch(
        new Request('http://localhost/api/books/book-1/bookmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid' },
          body: JSON.stringify({ locator: { cfi: 'epubcfi(/6/8)', selectedText: 'test', chapterRef: 'chapter1.xhtml' } }),
        }),
        env,
        makePassThroughContext() as unknown as ExecutionContext,
      );
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/books/:bookId/bookmarks/:bookmarkId', () => {
    it('deletes bookmark and returns success', async () => {
      mockRequireAuth.mockResolvedValue({ email: 'user@example.com', capabilities: { canBookmark: true } } as any);
      mockExecute.mockResolvedValue({} as any);

      const res = await app.fetch(
        new Request('http://localhost/api/books/book-1/bookmarks/bm-1', {
          method: 'DELETE',
          headers: { Authorization: 'Bearer valid' },
        }),
        env,
        makePassThroughContext() as unknown as ExecutionContext,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.ok).toBe(true);
    });
  });
});

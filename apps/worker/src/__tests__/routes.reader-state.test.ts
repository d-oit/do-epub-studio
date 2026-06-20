import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  makePassThroughContext,
  mockQueryFirst,
  mockQueryAll,
  mockExecute,
  mockRequireAuth,
} from './fixtures';
import { app } from '../app';
import { assertBookAccess } from '../lib/tenant-isolation';

vi.mock('../lib/tenant-isolation', () => ({
  parseLocatorRow: vi.fn(),
  assertBookAccess: vi.fn(),
}));

const mockAssertBookAccess = assertBookAccess as ReturnType<typeof vi.fn>;

describe('Reader State Routes', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertBookAccess.mockResolvedValue(null);
  });

  describe('GET /api/books/:bookId/progress', () => {
    it('returns 401 when unauthenticated', async () => {
      mockRequireAuth.mockResolvedValue(null);
      const res = await app.fetch(new Request('http://localhost/api/books/book-1/progress'), env, makePassThroughContext());
      expect(res.status).toBe(401);
    });

    it('returns progress when authenticated', async () => {
      mockRequireAuth.mockResolvedValue({ email: 'user@example.com', bookId: 'book-1', sessionId: 'session-1' } as any);

      mockQueryFirst.mockResolvedValue({
        id: 'progress-1',
        locator_json: JSON.stringify({ cfi: 'epubcfi(/6/4)', selectedText: 'test', chapterRef: 'Ch1' }),
        progress_percent: 50,
        updated_at: '2023-01-01T00:00:00Z',
      });

      const res = await app.fetch(new Request('http://localhost/api/books/book-1/progress', {
        headers: { 'Authorization': 'Bearer valid' }
      }), env, makePassThroughContext());
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.progressPercent).toBe(50);
    });
  });

  describe('PUT /api/books/:bookId/progress', () => {
    it('updates progress and returns success', async () => {
      mockRequireAuth.mockResolvedValue({
        email: 'user@example.com',
        capabilities: { canRead: true },
      } as any);
      mockExecute.mockResolvedValue({} as any);

      const res = await app.fetch(new Request('http://localhost/api/books/book-1/progress', {
        method: 'PUT',
        body: JSON.stringify({
          locator: { cfi: 'epubcfi(/6/4)', selectedText: 'text', chapterRef: 'chap1' },
          progressPercent: 60,
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid'
        },
      }), env, makePassThroughContext());

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.ok).toBe(true);
    });
  });

  describe('GET /api/books/:bookId/bookmarks', () => {
    it('returns list of bookmarks', async () => {
      mockRequireAuth.mockResolvedValue({ email: 'user@example.com' } as any);
      mockQueryAll.mockResolvedValue([
        { id: '1', locator_json: JSON.stringify({ cfi: 'cfi' }), label: 'bm1', created_at: 'now' }
      ]);

      const res = await app.fetch(new Request('http://localhost/api/books/book-1/bookmarks', {
        headers: { 'Authorization': 'Bearer valid' }
      }), env, makePassThroughContext());
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data).toHaveLength(1);
    });
  });

  describe('POST /api/books/:bookId/bookmarks', () => {
    it('creates bookmark and returns success', async () => {
      mockRequireAuth.mockResolvedValue({
        email: 'user@example.com',
        capabilities: { canBookmark: true },
      } as any);
      mockExecute.mockResolvedValue({} as any);

      const res = await app.fetch(new Request('http://localhost/api/books/book-1/bookmarks', {
        method: 'POST',
        body: JSON.stringify({
          locator: { cfi: 'cfi', selectedText: 'text', chapterRef: 'chap1' },
          label: 'My Bookmark',
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid'
        },
      }), env, makePassThroughContext());

      expect(res.status).toBe(201);
    });
  });

  describe('DELETE /api/books/:bookId/bookmarks/:bookmarkId', () => {
    it('deletes bookmark and returns success', async () => {
      mockRequireAuth.mockResolvedValue({ email: 'user@example.com' } as any);
      mockExecute.mockResolvedValue({} as any);

      const res = await app.fetch(new Request('http://localhost/api/books/book-1/bookmarks/bookmark-1', {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer valid' },
      }), env, makePassThroughContext());

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/books/:bookId/highlights', () => {
    it('returns list of highlights', async () => {
      mockRequireAuth.mockResolvedValue({ email: 'user@example.com' } as any);
      mockQueryAll.mockResolvedValue([
        { id: '1', chapter_ref: 'c1', cfi_range: 'r1', selected_text: 't', color: '#ff0', created_at: 'now' }
      ]);

      const res = await app.fetch(new Request('http://localhost/api/books/book-1/highlights', {
        headers: { 'Authorization': 'Bearer valid' }
      }), env, makePassThroughContext());
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data).toHaveLength(1);
    });
  });

  describe('POST /api/books/:bookId/highlights', () => {
    it('creates highlight and returns success', async () => {
      mockRequireAuth.mockResolvedValue({
        email: 'user@example.com',
        capabilities: { canHighlight: true },
      } as any);
      mockExecute.mockResolvedValue({} as any);

      const res = await app.fetch(new Request('http://localhost/api/books/book-1/highlights', {
        method: 'POST',
        body: JSON.stringify({
          locator: { cfi: 'cfi', selectedText: 'text', chapterRef: 'chap1' },
          note: 'nice',
          color: '#ff0000',
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid'
        },
      }), env, makePassThroughContext());

      expect(res.status).toBe(201);
    });
  });

  describe('PATCH /api/books/:bookId/highlights/:highlightId', () => {
    it('updates highlight and returns success', async () => {
      mockRequireAuth.mockResolvedValue({ email: 'user@example.com' } as any);
      mockQueryFirst.mockResolvedValue({ user_email: 'user@example.com' });
      mockExecute.mockResolvedValue({} as any);

      const res = await app.fetch(new Request('http://localhost/api/books/book-1/highlights/highlight-1', {
        method: 'PATCH',
        body: JSON.stringify({ note: 'updated', color: '#00ff00' }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid'
        },
      }), env, makePassThroughContext());

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/books/:bookId/highlights/:highlightId', () => {
    it('deletes highlight and returns success', async () => {
      mockRequireAuth.mockResolvedValue({ email: 'user@example.com' } as any);
      mockExecute.mockResolvedValue({} as any);

      const res = await app.fetch(new Request('http://localhost/api/books/book-1/highlights/highlight-1', {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer valid' },
      }), env, makePassThroughContext());

      expect(res.status).toBe(200);
    });
  });
});

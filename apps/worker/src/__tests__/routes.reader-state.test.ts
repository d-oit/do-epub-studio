import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  mockRequireAuth,
  mockQueryAll,
  mockQueryFirst,
  mockExecute,
} from './fixtures';
import { app } from '../app';

describe('Reader State Routes', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/books/:bookId/progress', () => {
    it('returns 401 when unauthenticated', async () => {
      mockRequireAuth.mockResolvedValue(null);
      const res = await app.fetch(new Request('http://localhost/api/books/book-1/progress'), env);
      expect(res.status).toBe(401);
    });

    it('returns progress when authenticated', async () => {
      mockRequireAuth.mockResolvedValue({ email: 'user@example.com' } as any);
      mockQueryFirst.mockResolvedValue({
        locator_json: JSON.stringify({ cfi: 'epubcfi(/6/4)' }),
        progress_percent: 50,
        updated_at: '2023-01-01T00:00:00Z',
      } as any);

      const res = await app.fetch(new Request('http://localhost/api/books/book-1/progress'), env);
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
        headers: { 'Content-Type': 'application/json' },
      }), env);

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
      ] as any);

      const res = await app.fetch(new Request('http://localhost/api/books/book-1/bookmarks'), env);
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
        headers: { 'Content-Type': 'application/json' },
      }), env);

      expect(res.status).toBe(201);
    });
  });
});

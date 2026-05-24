import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  mockQueryFirst,
  mockQueryAll,
  mockRequireAuth,
  mockGetSignedUrl,
} from './fixtures';
import { app } from '../app';

describe('Books Routes', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/books', () => {
    it('returns list of books', async () => {
      mockQueryAll.mockResolvedValue([
        { id: '1', slug: 'book-1', title: 'Book 1', visibility: 'public' }
      ] as any);

      const res = await app.fetch(new Request('http://localhost/api/books'), env);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.ok).toBe(true);
      expect(body.data).toHaveLength(1);
    });
  });

  describe('GET /api/books/:id', () => {
    it('returns 404 when book not found', async () => {
      mockQueryFirst.mockResolvedValue(null);
      const res = await app.fetch(new Request('http://localhost/api/books/none'), env);
      expect(res.status).toBe(404);
    });

    it('returns book details when found', async () => {
      mockQueryFirst.mockResolvedValue({ id: '1', slug: 'book-1', title: 'Book 1', visibility: 'public' } as any);
      const res = await app.fetch(new Request('http://localhost/api/books/1'), env);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.id).toBe('1');
    });
  });

  describe('POST /api/books/:id/file-url', () => {
    it('returns signed URL when book and file exist', async () => {
      mockQueryFirst
        .mockResolvedValueOnce({ id: '1', slug: 'book-1' } as any) // Book check
        .mockResolvedValueOnce({ storage_key: 'key.epub' } as any); // File check

      mockGetSignedUrl.mockResolvedValue('https://signed.url');

      const res = await app.fetch(new Request('http://localhost/api/books/1/file-url', {
        method: 'POST'
      }), env);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.url).toBe('https://signed.url');
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  mockQueryFirst,
  mockQueryAll,
  mockGenerateSignedUrl,
  mockRequireAuth,
} from './fixtures';
import { app } from '../app';

describe('Books Routes', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/books', () => {
    it('returns list of books', async () => {
      mockRequireAuth.mockResolvedValue({ email: 'user@example.com' } as any);

      mockQueryAll.mockResolvedValue([
        { id: '1', slug: 'book-1', title: 'Book 1', visibility: 'public' }
      ]);

      const res = await app.fetch(new Request('http://localhost/api/books', {
        headers: { 'Authorization': 'Bearer valid' }
      }), env, { waitUntil: () => {} } as any);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.ok).toBe(true);
      expect(body.data).toHaveLength(1);
    });
  });

  describe('GET /api/books/:id', () => {
    it('returns 404 when book not found', async () => {
      mockRequireAuth.mockResolvedValue({ email: 'user@example.com' } as any);

      mockQueryFirst.mockResolvedValue(null);
      const res = await app.fetch(new Request('http://localhost/api/books/none', {
        headers: { 'Authorization': 'Bearer valid' }
      }), env, { waitUntil: () => {} } as any);
      expect(res.status).toBe(404);
    });

    it('returns book details when found', async () => {
      mockRequireAuth.mockResolvedValue({ email: 'user@example.com' } as any);

      mockQueryFirst.mockResolvedValue({ id: '1', slug: 'book-1', title: 'Book 1', visibility: 'public' });
      const res = await app.fetch(new Request('http://localhost/api/books/1', {
        headers: { 'Authorization': 'Bearer valid' }
      }), env, { waitUntil: () => {} } as any);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.id).toBe('1');
    });
  });

  describe('POST /api/books/:id/file-url', () => {
    it('returns signed URL when book and file exist', async () => {
      mockRequireAuth.mockResolvedValue({
        email: 'user@example.com',
        capabilities: { canRead: true }
      } as any);

      mockQueryFirst
        .mockResolvedValueOnce({ id: '1', slug: 'book-1' }) // Book check
        .mockResolvedValueOnce({ storage_key: 'key.epub' }); // File check

      mockGenerateSignedUrl.mockResolvedValue({ url: 'https://signed.url' } as any);

      const res = await app.fetch(new Request('http://localhost/api/books/1/file-url', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer valid' }
      }), env, { waitUntil: () => {} } as any);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.url).toBe('https://signed.url');
    });
  });
});

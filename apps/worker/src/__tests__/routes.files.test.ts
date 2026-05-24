import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  mockQueryFirst,
  mockVerifyExpiry,
  mockVerifySignature,
} from './fixtures';
import { app } from '../app';

describe('Files Routes', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeFileUrlRequest(expires: string, signature: string): Request {
    return new Request(`http://localhost/api/files/book-1/key?expires=${expires}&signature=${signature}`);
  }

  describe('GET /api/files/:remainder', () => {
    it('returns 404 when file not found in DB', async () => {
      mockQueryFirst.mockResolvedValue(null);
      const res = await app.fetch(makeFileUrlRequest('9999999999', 'sig'), env);
      expect(res.status).toBe(404);
    });

    it('returns 404 when file not found in bucket', async () => {
      mockQueryFirst.mockResolvedValue({ id: '1', storage_key: 'key' } as any);
      // makeEnv already returns a bucket that returns null for get
      const res = await app.fetch(makeFileUrlRequest('9999999999', 'sig'), env);
      expect(res.status).toBe(404);
    });

    it('returns file body with correct headers when valid', async () => {
      const mockBody = new ReadableStream();
      const mockObject = {
        body: mockBody,
        httpEtag: 'etag',
        writeHttpMetadata: (h: Headers) => h.set('Content-Type', 'application/epub+zip'),
      };

      mockQueryFirst.mockResolvedValue({ id: '1', storage_key: 'key' } as any);
      vi.spyOn(env.BOOKS_BUCKET, 'get').mockResolvedValue(mockObject as any);

      const res = await app.fetch(makeFileUrlRequest('9999999999', 'sig'), env);

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/epub+zip');
      expect(res.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'self'");
    });
  });
});

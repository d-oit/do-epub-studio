import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  mockQueryFirst,
} from './fixtures';
import { app } from '../app';

describe('Files Routes', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeFileUrlRequest(bookId: string, remainder: string, expires: string, signature: string): Request {
    return new Request(`http://localhost/api/files/${bookId}/${remainder}?expires=${expires}&signature=${signature}`);
  }

  describe('GET /api/files/:bookId/:remainder', () => {
    it('returns 403 when signature is invalid (mocked)', async () => {
      const { verifySignedUrlSignature } = await import('../storage/signed-url');
      vi.mocked(verifySignedUrlSignature).mockResolvedValue(false);

      const res = await app.fetch(makeFileUrlRequest('book-1', 'key', '9999999999', 'sig'), env);
      expect(res.status).toBe(403);
    });

    it('returns 404 when file not found in DB', async () => {
      const { verifySignedUrlSignature, verifySignedUrlExpiry } = await import('../storage/signed-url');
      vi.mocked(verifySignedUrlSignature).mockResolvedValue(true);
      vi.mocked(verifySignedUrlExpiry).mockReturnValue(true);

      mockQueryFirst.mockResolvedValue(null);
      const res = await app.fetch(makeFileUrlRequest('book-1', 'key', '9999999999', 'sig'), env);
      expect(res.status).toBe(404);
    });

    it('returns file body with correct headers when valid', async () => {
      const { verifySignedUrlSignature, verifySignedUrlExpiry } = await import('../storage/signed-url');
      vi.mocked(verifySignedUrlSignature).mockResolvedValue(true);
      vi.mocked(verifySignedUrlExpiry).mockReturnValue(true);

      const mockBody = new ReadableStream();
      const mockObject = {
        body: mockBody,
        httpEtag: 'etag',
        writeHttpMetadata: (h: Headers) => h.set('Content-Type', 'application/epub+zip'),
      };

      mockQueryFirst.mockResolvedValue({ id: '1', storage_key: 'key' });
      vi.spyOn(env.BOOKS_BUCKET, 'get').mockResolvedValue(mockObject as any);

      const res = await app.fetch(makeFileUrlRequest('book-1', 'key', '9999999999', 'sig'), env);

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/epub+zip');
      expect(res.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'self'");
    });
  });
});

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
      expect(res.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    });

    // Lock the SE2 carve-out from apps/worker/src/middleware/security-headers.ts:
    // /api/files/* responses use minimalSecurityHeaders (NOT the global
    // securityHeaders), so the new strict `style-src 'self'` does NOT reach
    // EPUB chapter responses. A regression here would break EPUB rendering.
    // (Plan 122 § Compatibility constraints.)
    it('uses the EPUB carve-out CSP, not the global Worker CSP', async () => {
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
      const csp = res.headers.get('Content-Security-Policy') ?? '';
      expect(csp).toMatch(/default-src 'none'/);

      // The global securityHeaders['Content-Security-Policy'] contains
      // `script-src 'self'`; minimalSecurityHeaders does not. A regression
      // that drops the carve-out (or accidentally applies applySecurityHeaders
      // here) would introduce script-src into the EPUB response and break
      // the ADR-035 EPUB sandbox contract.
      expect(csp).not.toMatch(/script-src 'self'/);
    });
  });
});

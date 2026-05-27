import { describe, it, expect } from 'vitest';
import { generateSignedUrl, verifySignedUrlExpiry, verifySignedUrlSignature } from '../storage/signed-url';

describe('signed-url utilities (real implementation)', () => {
  const env = {
    APP_BASE_URL: 'https://test.example.com',
    SESSION_SIGNING_SECRET: process.env.TEST_SESSION_SIGNING_SECRET || 'test-secret'
  } as any;
  const bookId = 'book-123';
  const fileKey = 'books/book-123/content.epub';

  describe('generateSignedUrl', () => {
    it('generates a URL with the expected HMAC format', async () => {
      const result = await generateSignedUrl(env, bookId, fileKey);

      expect(result.url).toContain(env.APP_BASE_URL + '/api/files/' + bookId + '/' + fileKey);
      expect(result.url).toContain('expires=');
      expect(result.url).toContain('signature=');
      const urlObj = new URL(result.url);
      const signature = urlObj.searchParams.get('signature') as string;
      expect(signature).toHaveLength(64); // SHA-256 HMAC in hex
    });
  });

  describe('verifySignedUrlExpiry', () => {
    it('returns true for future expiry', () => {
      const future = Math.floor(Date.now() / 1000) + 3600;
      expect(verifySignedUrlExpiry(String(future))).toBe(true);
    });

    it('returns false for past expiry', () => {
      const past = Math.floor(Date.now() / 1000) - 3600;
      expect(verifySignedUrlExpiry(String(past))).toBe(false);
    });

    it('returns false for NaN expiry', () => {
      expect(verifySignedUrlExpiry('invalid')).toBe(false);
    });
  });

  describe('verifySignedUrlSignature', () => {
    it('returns true for valid HMAC signature', async () => {
      const { url } = await generateSignedUrl(env, bookId, fileKey);
      const urlObj = new URL(url);
      const expires = urlObj.searchParams.get('expires') as string;
      const signature = urlObj.searchParams.get('signature') as string;

      const isValid = await verifySignedUrlSignature(env, bookId, fileKey, expires, signature);
      expect(isValid).toBe(true);
    });

    it('returns false for tampered bookId', async () => {
        const { url } = await generateSignedUrl(env, bookId, fileKey);
        const urlObj = new URL(url);
        const expires = urlObj.searchParams.get('expires') as string;
        const signature = urlObj.searchParams.get('signature') as string;

        const isValid = await verifySignedUrlSignature(env, 'other-book', fileKey, expires, signature);
        expect(isValid).toBe(false);
      });

    it('returns false for invalid signature format', async () => {
        const isValid = await verifySignedUrlSignature(env, bookId, fileKey, '1234567890', 'invalid');
        expect(isValid).toBe(false);
    });

    it('returns false for NaN expires', async () => {
        const isValid = await verifySignedUrlSignature(env, bookId, fileKey, 'invalid', 'a'.repeat(64));
        expect(isValid).toBe(false);
    });
  });
});

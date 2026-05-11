import { describe, it, expect } from 'vitest';

const SIGNED_URL_EXPIRY_SECONDS = 3600;

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function hexToUint8Array(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) return new Uint8Array(0);
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function generateSignedUrl(
  env: any,
  bookId: string,
  fileKey: string,
): Promise<any> {
  const expiresAt = new Date(Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000);
  const expiresEpoch = Math.floor(expiresAt.getTime() / 1000);

  const encoder = new TextEncoder();
  const data = encoder.encode(`${bookId}:${fileKey}:${expiresEpoch}`);
  const key = await getHmacKey(env.SESSION_SIGNING_SECRET);
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, data);
  const signature = uint8ArrayToHex(new Uint8Array(signatureBuffer));

  const baseUrl = `${env.APP_BASE_URL}/api/files/${bookId}/${fileKey}`;
  const signedUrl = `${baseUrl}?expires=${expiresEpoch}&signature=${signature}`;

  return {
    url: signedUrl,
    expiresAt: expiresAt.toISOString(),
    fileSize: 0,
    mimeType: 'application/epub+zip',
  };
}

function verifySignedUrlExpiry(expires: string): boolean {
  const expiresEpoch = parseInt(expires, 10);

  if (Number.isNaN(expiresEpoch)) {
    return false;
  }

  return Date.now() / 1000 <= expiresEpoch;
}

async function verifySignedUrlSignature(
  env: any,
  bookId: string,
  fileKey: string,
  expires: string,
  providedSignature: string,
): Promise<boolean> {
  const expiresEpoch = parseInt(expires, 10);

  if (Number.isNaN(expiresEpoch)) {
    return false;
  }

  if (providedSignature.length !== 64) {
    return false;
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(`${bookId}:${fileKey}:${expiresEpoch}`);
  const key = await getHmacKey(env.SESSION_SIGNING_SECRET);
  const sigBytes = hexToUint8Array(providedSignature);

  try {
    return await crypto.subtle.verify('HMAC', key, sigBytes.buffer as ArrayBuffer, data);
  } catch {
    return false;
  }
}

describe('signed-url utilities (HMAC verification)', () => {
  const env = {
    APP_BASE_URL: 'https://test.example.com',
    SESSION_SIGNING_SECRET: 'test-secret'
  };
  const bookId = 'book-123';
  const fileKey = 'books/book-123/content.epub';

  describe('generateSignedUrl', () => {
    it('generates a URL with the expected HMAC format', async () => {
      const result = await generateSignedUrl(env, bookId, fileKey);

      expect(result.url).toContain(env.APP_BASE_URL + '/api/files/' + bookId + '/' + fileKey);
      expect(result.url).toContain('expires=');
      expect(result.url).toContain('signature=');
      const urlObj = new URL(result.url);
      const signature = urlObj.searchParams.get('signature')!;
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
  });

  describe('verifySignedUrlSignature', () => {
    it('returns true for valid HMAC signature', async () => {
      const { url } = await generateSignedUrl(env, bookId, fileKey);
      const urlObj = new URL(url);
      const expires = urlObj.searchParams.get('expires')!;
      const signature = urlObj.searchParams.get('signature')!;

      const isValid = await verifySignedUrlSignature(env, bookId, fileKey, expires, signature);
      expect(isValid).toBe(true);
    });

    it('returns false for tampered bookId', async () => {
        const { url } = await generateSignedUrl(env, bookId, fileKey);
        const urlObj = new URL(url);
        const expires = urlObj.searchParams.get('expires')!;
        const signature = urlObj.searchParams.get('signature')!;

        const isValid = await verifySignedUrlSignature(env, 'other-book', fileKey, expires, signature);
        expect(isValid).toBe(false);
      });

    it('returns false for invalid signature format', async () => {
        const isValid = await verifySignedUrlSignature(env, bookId, fileKey, '1234567890', 'invalid');
        expect(isValid).toBe(false);
    });
  });
});

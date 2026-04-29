import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mockVerifyExpiry,
  mockVerifySignature,
} from './fixtures';
import { handleDownloadBookFile } from '../routes/files';

describe('GET /api/files/{bookId}/{fileKey} (handleDownloadBookFile)', () => {
  function makeFileUrlRequest(expires: string, signature: string): Request {
    return new Request(`https://test.example.com/api/files/book-1/books/book-1/epub/file.epub?expires=${expires}&signature=${signature}`);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when signature parameters missing', async () => {
    const req = new Request('https://test.example.com/api/files/book-1/key');
    const res = await handleDownloadBookFile({} as never, req, 'book-1', 'key');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('returns 400 when only expires provided', async () => {
    const req = new Request('https://test.example.com/api/files/book-1/key?expires=123');
    const res = await handleDownloadBookFile({} as never, req, 'book-1', 'key');
    expect(res.status).toBe(400);
  });

  it('returns 400 when only signature provided', async () => {
    const req = new Request('https://test.example.com/api/files/book-1/key?signature=abc');
    const res = await handleDownloadBookFile({} as never, req, 'book-1', 'key');
    expect(res.status).toBe(400);
  });

  it('returns 403 when signature is invalid', async () => {
    mockVerifySignature.mockResolvedValue(false);

    const req = makeFileUrlRequest('1234567890', 'invalid-signature');
    const res = await handleDownloadBookFile({} as never, req, 'book-1', 'key');
    expect(res.status).toBe(403);
  });

  it('returns 403 when URL is expired', async () => {
    mockVerifySignature.mockResolvedValue(true);
    mockVerifyExpiry.mockReturnValue(false);

    const req = makeFileUrlRequest('1234567890', 'valid-signature');
    const res = await handleDownloadBookFile({} as never, req, 'book-1', 'key');
    expect(res.status).toBe(403);
  });

  it('returns 404 when file not found in bucket', async () => {
    mockVerifyExpiry.mockReturnValue(true);
    mockVerifySignature.mockResolvedValue(true);
    const env = { BOOKS_BUCKET: { get: async () => null } } as never;

    const req = makeFileUrlRequest('9999999999', 'valid-sig');
    const res = await handleDownloadBookFile(env, req, 'book-1', 'key');
    expect(res.status).toBe(404);
  });

  it('returns file body with correct headers when valid', async () => {
    mockVerifyExpiry.mockReturnValue(true);
    mockVerifySignature.mockResolvedValue(true);

    const mockObject = {
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('file content'));
          controller.close();
        },
      }),
      httpMetadata: { contentType: 'application/epub+zip' },
    } as never;

    const env = { BOOKS_BUCKET: { get: async () => mockObject } } as never;

    const req = makeFileUrlRequest('9999999999', 'valid-sig');
    const res = await handleDownloadBookFile(env, req, 'book-1', 'key');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/epub+zip');
  });
});

describe('Signed URL expiry validation', () => {
  function makeFileUrlRequest(expires: string, signature: string): Request {
    return new Request(`https://test.example.com/api/files/book-1/key?expires=${expires}&signature=${signature}`);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 for non-numeric expires value', async () => {
    mockVerifyExpiry.mockReturnValue(false); // parseInt('not-a-number') = NaN -> false
    mockVerifySignature.mockResolvedValue(true);

    const req = makeFileUrlRequest('not-a-number', 'sig');
    const res = await handleDownloadBookFile({} as never, req, 'book-1', 'key');
    expect(res.status).toBe(403);
  });

  it('returns 403 for negative expires value', async () => {
    mockVerifyExpiry.mockReturnValue(false);
    mockVerifySignature.mockResolvedValue(true);

    const req = makeFileUrlRequest('-100', 'sig');
    const res = await handleDownloadBookFile({} as never, req, 'book-1', 'key');
    expect(res.status).toBe(403);
  });

  it('passes validation for future expiry', async () => {
    // Future timestamp
    const futureExpires = Math.floor(Date.now() / 1000) + 3600;
    mockVerifyExpiry.mockReturnValue(true);
    mockVerifySignature.mockResolvedValue(true);

    const mockObject = {
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('file'));
          controller.close();
        },
      }),
      httpMetadata: { contentType: 'application/octet-stream' },
    } as never;

    const env = { BOOKS_BUCKET: { get: async () => mockObject } } as never;

    const req = makeFileUrlRequest(String(futureExpires), 'sig');
    const res = await handleDownloadBookFile(env, req, 'book-1', 'key');
    expect(res.status).toBe(200);
  });
});

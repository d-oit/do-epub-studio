import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import type { Env } from '../lib/env';
import {
  makeAuthContext,
  makeEnv,
  makePassThroughContext,
  mockQueryAll,
  mockQueryFirst,
  mockRequireAdminAuth,
  mockRequireAuth,
} from './fixtures';
import { app } from '../app';

const ASSET_ID = '550e8400-e29b-41d4-a716-446655440000';
const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_SHA256 = createHash('sha256').update(PNG_SIGNATURE).digest('hex');
const ROW = {
  id: ASSET_ID,
  book_id: 'book-1',
  name: 'diagram.png',
  media_type: 'image/png' as const,
  sha256: PNG_SHA256,
  size_bytes: PNG_SIGNATURE.byteLength,
  storage_key: 'books/book-1/author-assets/asset-id/hash',
  created_at: '2026-11-08T10:00:00.000Z',
};

function mockAdmin() {
  mockRequireAdminAuth.mockResolvedValue({
    ok: true,
    context: {
      userId: 'admin-1',
      email: 'admin@example.com',
      globalRole: 'admin',
      token: 'admin-token',
    },
  });
}

function mockAuthor(bookId = 'book-1', canAuthor = true) {
  const context = makeAuthContext({ bookId });
  mockRequireAdminAuth.mockResolvedValue({ ok: false, status: 401, error: 'Invalid session' });
  mockRequireAuth.mockResolvedValue({
    ...context,
    capabilities: { ...context.capabilities, canAuthor },
  });
}

describe('author asset API', () => {
  let env: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    env = makeEnv();
    mockAdmin();
  });

  it('lists assets only for an explicitly authorized book-scoped author', async () => {
    mockAuthor('book-1', true);
    mockQueryAll.mockResolvedValueOnce([ROW]);

    const res = await app.fetch(
      new Request('http://localhost/api/author/books/book-1/assets', {
        headers: { Authorization: 'Bearer author-token' },
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    const body = await res.json<{
      data: { assets: Array<{ id: string; mediaType: string; sizeBytes: number }> };
    }>();
    expect(body.data.assets).toEqual([
      expect.objectContaining({
        id: ASSET_ID,
        mediaType: 'image/png',
        sizeBytes: PNG_SIGNATURE.byteLength,
      }),
    ]);
    expect(mockQueryAll.mock.calls[0]?.[2]).toEqual(['book-1']);
  });

  it('denies a reader and denies an author token scoped to another book', async () => {
    mockAuthor('book-1', false);
    const readerRes = await app.fetch(
      new Request('http://localhost/api/author/books/book-1/assets', {
        headers: { Authorization: 'Bearer reader-token' },
      }),
      env,
      makePassThroughContext(),
    );
    expect(readerRes.status).toBe(403);

    mockAuthor('book-2', true);
    const crossBookRes = await app.fetch(
      new Request('http://localhost/api/author/books/book-1/assets', {
        headers: { Authorization: 'Bearer author-token' },
      }),
      env,
      makePassThroughContext(),
    );
    expect(crossBookRes.status).toBe(403);
    expect(mockQueryAll).not.toHaveBeenCalled();
  });

  it('denies direct asset reads without book-scoped authoring capability', async () => {
    mockAuthor('book-1', false);
    const readerRes = await app.fetch(
      new Request(`http://localhost/api/author/books/book-1/assets/${ASSET_ID}`, {
        headers: { Authorization: 'Bearer reader-token' },
      }),
      env,
      makePassThroughContext(),
    );
    expect(readerRes.status).toBe(403);

    mockAuthor('book-2', true);
    const crossBookRes = await app.fetch(
      new Request(`http://localhost/api/author/books/book-1/assets/${ASSET_ID}`, {
        headers: { Authorization: 'Bearer author-token' },
      }),
      env,
      makePassThroughContext(),
    );
    expect(crossBookRes.status).toBe(403);
    expect(mockQueryFirst).not.toHaveBeenCalled();
  });

  it('returns local asset bytes with private, nosniff response headers', async () => {
    mockAuthor('book-1', true);
    mockQueryFirst.mockResolvedValueOnce(ROW);
    const objectBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(PNG_SIGNATURE);
        controller.close();
      },
    });
    const object = {
      body: objectBody,
      httpEtag: '"asset-etag"',
      writeHttpMetadata(headers: Headers) {
        headers.set('Content-Type', 'application/octet-stream');
      },
    } as unknown as Awaited<ReturnType<Env['BOOKS_BUCKET']['get']>>;
    const getObject = vi.fn().mockResolvedValue(object);
    env.BOOKS_BUCKET.get = getObject;

    const res = await app.fetch(
      new Request(`http://localhost/api/author/books/book-1/assets/${ASSET_ID}`, {
        headers: { Authorization: 'Bearer author-token' },
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('ETag')).toBe('"asset-etag"');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG_SIGNATURE);
    expect(getObject).toHaveBeenCalledWith(ROW.storage_key);
  });

  it('accepts a bounded signature-matched image and stores book-scoped metadata', async () => {
    const put = vi.fn().mockResolvedValue(null);
    env.BOOKS_BUCKET.put = put;
    mockQueryFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: ASSET_ID });

    const res = await app.fetch(
      new Request(`http://localhost/api/author/books/book-1/assets/${ASSET_ID}`, {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer admin-token',
          'Content-Type': 'image/png',
          'X-Asset-Name': encodeURIComponent('diagram.png'),
        },
        body: PNG_SIGNATURE,
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(201);
    const body = await res.json<{
      data: { asset: { id: string; mediaType: string; sha256: string } };
    }>();
    expect(body.data.asset).toMatchObject({
      id: ASSET_ID,
      mediaType: 'image/png',
      sha256: PNG_SHA256,
    });
    expect(put).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^books/book-1/author-assets/${ASSET_ID}/[a-f0-9]{64}$`)),
      expect.any(Uint8Array),
      expect.objectContaining({
        httpMetadata: { contentType: 'image/png', cacheControl: 'private, no-store' },
      }),
    );
    const insertSql = mockQueryFirst.mock.calls[1]?.[1] as string;
    expect(insertSql).toContain('SELECT COUNT(*) FROM author_assets');
    expect(insertSql).toContain('SUM(size_bytes)');
  });

  it('rejects image bytes that do not match the declared type before storing them', async () => {
    const put = vi.fn().mockResolvedValue(null);
    env.BOOKS_BUCKET.put = put;

    const res = await app.fetch(
      new Request(`http://localhost/api/author/books/book-1/assets/${ASSET_ID}`, {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer admin-token',
          'Content-Type': 'image/png',
          'X-Asset-Name': encodeURIComponent('diagram.png'),
        },
        body: new Uint8Array([0xff, 0xd8, 0xff]),
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(400);
    expect(put).not.toHaveBeenCalled();
    expect(mockQueryFirst).not.toHaveBeenCalled();
  });

  it('rejects active CSS and oversized images before storing them', async () => {
    const put = vi.fn().mockResolvedValue(null);
    env.BOOKS_BUCKET.put = put;
    const cssRes = await app.fetch(
      new Request(`http://localhost/api/author/books/book-1/assets/${ASSET_ID}`, {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer admin-token',
          'Content-Type': 'text/css',
          'X-Asset-Name': encodeURIComponent('theme.css'),
        },
        body: '@import url(https://example.invalid/x.css);',
      }),
      env,
      makePassThroughContext(),
    );
    expect(cssRes.status).toBe(400);

    const oversized = new Uint8Array(5 * 1024 * 1024 + 1);
    oversized.set([0xff, 0xd8, 0xff]);
    const imageRes = await app.fetch(
      new Request(`http://localhost/api/author/books/book-1/assets/${ASSET_ID}`, {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer admin-token',
          'Content-Type': 'image/jpeg',
          'X-Asset-Name': encodeURIComponent('large.jpg'),
        },
        body: oversized,
      }),
      env,
      makePassThroughContext(),
    );
    expect(imageRes.status).toBe(413);
    expect(put).not.toHaveBeenCalled();
    expect(mockQueryFirst).not.toHaveBeenCalled();
  });

  it('blocks deletion while the current manuscript references the asset', async () => {
    mockQueryFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(ROW);
    const deleteObject = vi.fn().mockResolvedValue(undefined);
    env.BOOKS_BUCKET.delete = deleteObject;

    const res = await app.fetch(
      new Request(`http://localhost/api/author/books/book-1/assets/${ASSET_ID}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer admin-token' },
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(409);
    expect(mockQueryFirst.mock.calls[0]?.[1]).toContain('instr(publication_json, ?)');
    expect(deleteObject).not.toHaveBeenCalled();
  });
});

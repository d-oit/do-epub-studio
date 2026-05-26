import { Hono } from 'hono';
import type { Env } from '../lib/env';
import { queryFirst } from '../db/client';
import { verifySignedUrlExpiry, verifySignedUrlSignature } from '../storage/signed-url';

export const filesRouter = new Hono<{ Bindings: Env }>();

filesRouter.get('/:bookId/:remainder{.+}', async (c) => {
  const bookId = c.req.param('bookId');
  const fileKey = c.req.param('remainder');

  if (!bookId || !fileKey) {
    return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
  }

  // Security: Verify signed URL parameters
  const url = new URL(c.req.url);
  const expires = url.searchParams.get('expires');
  const signature = url.searchParams.get('signature');

  if (!expires || !signature) {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Missing signature parameters' } }, 400);
  }

  if (!verifySignedUrlExpiry(expires)) {
    return c.json({ ok: false, error: { code: 'FORBIDDEN', message: 'URL has expired' } }, 403);
  }

  const isValid = await verifySignedUrlSignature(
    c.env,
    bookId,
    fileKey,
    expires,
    signature
  );

  if (!isValid) {
    return c.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Invalid signature' } }, 403);
  }

  const file = await queryFirst(
    c.env,
    `SELECT * FROM book_files WHERE book_id = ? AND storage_key = ? LIMIT 1`,
    [bookId, fileKey],
  );

  if (!file) {
    return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'File not found' } }, 404);
  }

  const object = await c.env.BOOKS_BUCKET.get(fileKey);

  if (!object) {
    return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'File not found in storage' } }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);

  // Security: ADR-035 restrictive CSP for framed EPUB content
  headers.set('Content-Security-Policy', "script-src 'none'; frame-ancestors 'self'; sandbox allow-same-origin allow-scripts");

  return new Response(object.body, {
    headers,
  });
});

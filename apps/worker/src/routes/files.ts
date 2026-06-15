import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { SignedUrlSchema } from '@do-epub-studio/schema';
import type { Env } from '../lib/env';
import { queryFirst } from '../db/client';
import { verifySignedUrlExpiry, verifySignedUrlSignature } from '../storage/signed-url';
import { createRequestContext, logRequestEnd, withTraceHeaders } from '../lib/observability';

export const filesRouter = new Hono<{ Bindings: Env }>();

filesRouter.get('/:bookId/:remainder{.+}', zValidator('query', SignedUrlSchema), async (c) => {
  const bookId = c.req.param('bookId');
  const fileKey = c.req.param('remainder');
  const { expires, signature } = c.req.valid('query');

  if (!bookId || !fileKey) {
    return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
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
  headers.set('Content-Security-Policy', "script-src 'none'; frame-ancestors 'self'; sandbox allow-same-origin");

  const ctx = createRequestContext(c.req.raw);
  logRequestEnd(ctx, 200, {
    route: '/files/:bookId/:remainder',
    assetType: object.httpMetadata?.contentType || 'unknown',
    fetchSource: 'r2',
    cacheStatus: 'MISS', // R2 does not expose cache status directly on the object
  });

  return withTraceHeaders(new Response(object.body, {
    headers,
  }), ctx);
});

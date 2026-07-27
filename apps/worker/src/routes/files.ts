import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { SignedUrlSchema } from '@do-epub-studio/schema';
import type { Env } from '../lib/env';
import { queryFirst } from '../db/client';
import { verifySignedUrlExpiry, verifySignedUrlSignature } from '../storage/signed-url';
import { createRequestContext, logRequestEnd, withTraceHeaders } from '../lib/observability';
import { NotFoundError, ForbiddenError } from '../lib/http-errors';

export const filesRouter = new Hono<{ Bindings: Env }>();

filesRouter.get('/:bookId/:remainder{.+}', zValidator('query', SignedUrlSchema), async (c) => {
  const bookId = c.req.param('bookId');
  const fileKey = c.req.param('remainder');
  const { expires, signature } = c.req.valid('query');

  if (!bookId || !fileKey) {
    throw new NotFoundError('File');
  }

  if (!verifySignedUrlExpiry(expires)) {
    throw new ForbiddenError('URL has expired');
  }

  const isValid = await verifySignedUrlSignature(
    c.env,
    bookId,
    fileKey,
    expires,
    signature
  );

  if (!isValid) {
    throw new ForbiddenError('Invalid signature');
  }

  const file = await queryFirst(
    c.env,
    `SELECT * FROM book_files WHERE book_id = ? AND storage_key = ? LIMIT 1`,
    [bookId, fileKey],
  );

  if (!file) {
    throw new NotFoundError('File');
  }

  const object = await c.env.BOOKS_BUCKET.get(fileKey);

  if (!object) {
    throw new NotFoundError('File');
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);

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

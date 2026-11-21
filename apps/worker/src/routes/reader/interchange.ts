import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  AnnotationInterchangeDocumentSchema,
  ANNOTATION_INTERCHANGE_MAX_EXTENSION_BYTES,
} from '@do-epub-studio/schema';
import type { Env, JsonRow } from '../../lib/env';
import type { AuthContext } from '../../auth/middleware';
import { queryFirst, execute } from '../../db/client';
import { readerAuth } from '../../middleware/auth';
import { assertBookAccess } from '../../lib/tenant-isolation';
import { apiError, getRequestTraceId } from '../../lib/api-error';

export const interchangeRouter = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

interface DocumentRow extends JsonRow {
  document_json: string;
  updated_at: string;
}

interchangeRouter.get('/:bookId/annotation-interchange', readerAuth, async (c) => {
  const bookId = c.req.param('bookId');
  const auth = c.get('auth');
  const mismatch = await assertBookAccess(
    c.env,
    auth,
    bookId,
    c.executionCtx,
    getRequestTraceId(c),
  );
  if (mismatch) return mismatch.response;
  const row = await queryFirst<DocumentRow>(
    c.env,
    'SELECT document_json, updated_at FROM annotation_interchange_documents WHERE book_id = ? AND user_email = ?',
    [bookId, auth.email],
  );
  if (!row) return c.json({ ok: true, data: null });
  try {
    return c.json({
      ok: true,
      data: AnnotationInterchangeDocumentSchema.parse(JSON.parse(row.document_json)),
      updatedAt: row.updated_at,
    });
  } catch {
    return apiError(c, 500, 'INVALID_STORED_DOCUMENT', 'Stored interchange document is invalid');
  }
});
interchangeRouter.put(
  '/:bookId/annotation-interchange',
  readerAuth,
  zValidator('json', AnnotationInterchangeDocumentSchema),
  async (c) => {
    const bookId = c.req.param('bookId');
    const auth = c.get('auth');
    const mismatch = await assertBookAccess(
      c.env,
      auth,
      bookId,
      c.executionCtx,
      getRequestTraceId(c),
    );
    if (mismatch) return mismatch.response;
    const document = c.req.valid('json');
    if (document.source !== `urn:do-epub-studio:publication:${encodeURIComponent(bookId)}`) {
      return apiError(c, 400, 'PUBLICATION_MISMATCH', 'Publication identity does not match this book');
    }
    const annotationIds = new Set<string>();
    for (const annotation of document.items) {
      if (
        annotationIds.has(annotation.id) ||
        annotation.target.source !== document.source ||
        annotation.target.selector.value !== annotation.target.selector.locator.cfi
      ) {
        return apiError(c, 400, 'INVALID_ANNOTATION', 'Annotation IDs must be unique and targets must be consistent');
      }
      annotationIds.add(annotation.id);
      if (
        new TextEncoder().encode(JSON.stringify(annotation.extensions ?? {})).byteLength >
        ANNOTATION_INTERCHANGE_MAX_EXTENSION_BYTES
      ) {
        return apiError(c, 413, 'EXTENSION_TOO_LARGE', 'Annotation extension exceeds limit');
      }
    }
    const serialized = JSON.stringify(document);
    await execute(
      c.env,
      `INSERT INTO annotation_interchange_documents (book_id, user_email, document_json, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(book_id, user_email) DO UPDATE SET document_json = excluded.document_json, updated_at = excluded.updated_at`,
      [bookId, auth.email, serialized],
    );
    return c.json({ ok: true, data: { saved: true } });
  },
);

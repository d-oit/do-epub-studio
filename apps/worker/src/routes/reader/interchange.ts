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
import { getRequestTraceId } from '../../lib/api-error';

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
    return c.json(
      {
        ok: false,
        error: {
          code: 'INVALID_STORED_DOCUMENT',
          message: 'Stored interchange document is invalid',
        },
      },
      500,
    );
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
      return c.json(
        {
          ok: false,
          error: {
            code: 'PUBLICATION_MISMATCH',
            message: 'Publication identity does not match this book',
          },
        },
        400,
      );
    }
    const annotationIds = new Set<string>();
    for (const annotation of document.items) {
      if (
        annotationIds.has(annotation.id) ||
        annotation.target.source !== document.source ||
        annotation.target.selector.value !== annotation.target.selector.locator.cfi
      ) {
        return c.json(
          {
            ok: false,
            error: {
              code: 'INVALID_ANNOTATION',
              message: 'Annotation IDs must be unique and targets must be consistent',
            },
          },
          400,
        );
      }
      annotationIds.add(annotation.id);
      if (
        new TextEncoder().encode(JSON.stringify(annotation.extensions ?? {})).byteLength >
        ANNOTATION_INTERCHANGE_MAX_EXTENSION_BYTES
      ) {
        return c.json(
          {
            ok: false,
            error: { code: 'EXTENSION_TOO_LARGE', message: 'Annotation extension exceeds limit' },
          },
          413,
        );
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

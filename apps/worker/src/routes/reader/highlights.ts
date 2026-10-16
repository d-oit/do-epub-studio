import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../../lib/env';
import type { AuthContext } from '../../auth/middleware';
import { queryFirst, queryAll, execute } from '../../db/client';
import { logAudit } from '../../audit';
import { HighlightCreateSchema, HighlightUpdateSchema } from '@do-epub-studio/schema';
import { readerAuth } from '../../middleware/auth';
import { assertBookAccess } from '../../lib/tenant-isolation';
import { getRequestTraceId } from '../../lib/api-error';
import { NotFoundError, ForbiddenError } from '../../lib/http-errors';

export const highlightsRouter = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

interface HighlightRow {
  [key: string]: string | number | null | undefined;
  id: string;
  book_id: string;
  user_email: string;
  mutation_id?: string | null;
  chapter_ref: string | null;
  cfi_range: string | null;
  selected_text: string;
  note: string | null;
  color: string;
  created_at: string;
  updated_at: string;
  revision_id?: string | null;
  original_cfi?: string | null;
  original_chapter_ref?: string | null;
  original_selected_text?: string | null;
  anchor_status?: string | null;
  confidence?: number | null;
  migration_outcome?: string | null;
}

function toHighlightDTO(row: HighlightRow) {
  return {
    id: row.id,
    chapterRef: row.chapter_ref ?? null,
    cfiRange: row.cfi_range ?? null,
    selectedText: row.selected_text,
    note: row.note ?? null,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    anchorStatus: row.anchor_status ?? 'anchored',
    confidence: row.confidence ?? 1.0,
    migrationOutcome: row.migration_outcome ?? null,
    revisionId: row.revision_id ?? null,
    originalCfi: row.original_cfi ?? null,
    originalChapterRef: row.original_chapter_ref ?? null,
    originalSelectedText: row.original_selected_text ?? null,
  };
}
highlightsRouter.get('/:bookId/highlights', readerAuth, async (c) => {
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

  const anchorStatus = c.req.query('anchorStatus');
  let query = `SELECT * FROM highlights WHERE book_id = ? AND user_email = ?`;
  const params: (string | number | null)[] = [bookId, auth.email];
  if (anchorStatus) {
    query += ` AND anchor_status = ?`;
    params.push(anchorStatus);
  }
  query += ` ORDER BY created_at DESC LIMIT 1000`;
  const highlights = await queryAll<HighlightRow>(c.env, query, params);

  return c.json({
    ok: true,
    data: highlights.map(toHighlightDTO),
  });
});

highlightsRouter.post(
  '/:bookId/highlights',
  readerAuth,
  zValidator('json', HighlightCreateSchema),
  async (c) => {
    const bookId = c.req.param('bookId');
    const auth = c.get('auth');
    const body = c.req.valid('json');

    const mismatch = await assertBookAccess(
      c.env,
      auth,
      bookId,
      c.executionCtx,
      getRequestTraceId(c),
    );
    if (mismatch) return mismatch.response;

    if (!auth.capabilities.canHighlight) {
      throw new ForbiddenError('Access denied');
    }

    const { locator } = body;
    const mutationId = body.mutationId ?? null;
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const inserted = await queryFirst<HighlightRow>(
      c.env,
      `INSERT INTO highlights (id, book_id, user_email, mutation_id, chapter_ref, cfi_range, selected_text, note, color, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(mutation_id) WHERE mutation_id IS NOT NULL DO NOTHING
       RETURNING *`,
      [
        id,
        bookId,
        auth.email,
        mutationId,
        locator.chapterRef,
        locator.cfi,
        locator.selectedText,
        body.note ?? null,
        body.color ?? '#ffff00',
        now,
        now,
      ],
    );

    if (inserted) {
      await logAudit(
        c.env,
        {
          entityType: 'highlight',
          entityId: inserted.id,
          action: 'create',
          actorEmail: auth.email,
          payload: { bookId, chapterRef: locator.chapterRef, color: body.color },
        },
        c.executionCtx,
      );

      return c.json(
        {
          ok: true,
          data: toHighlightDTO(inserted),
        },
        201,
      );
    }

    if (!mutationId) {
      throw new Error('Failed to insert highlight');
    }

    const existing = await queryFirst<HighlightRow>(
      c.env,
      `SELECT * FROM highlights WHERE mutation_id = ?`,
      [mutationId],
    );

    if (!existing) {
      throw new Error('Failed to find conflicting highlight');
    }

    if (existing.book_id !== bookId || existing.user_email !== auth.email) {
      throw new ForbiddenError('Access denied');
    }

    return c.json(
      {
        ok: true,
        data: toHighlightDTO(existing),
      },
      200,
    );
  },
);
highlightsRouter.delete('/:bookId/highlights/:highlightId', readerAuth, async (c) => {
  const { bookId, highlightId } = c.req.param();
  const auth = c.get('auth');

  const mismatch = await assertBookAccess(
    c.env,
    auth,
    bookId,
    c.executionCtx,
    getRequestTraceId(c),
  );
  if (mismatch) return mismatch.response;

  await execute(c.env, `DELETE FROM highlights WHERE id = ? AND book_id = ? AND user_email = ?`, [
    highlightId,
    bookId,
    auth.email,
  ]);

  await logAudit(
    c.env,
    {
      entityType: 'highlight',
      entityId: highlightId,
      action: 'delete',
      actorEmail: auth.email,
      payload: { bookId },
    },
    c.executionCtx,
  );

  return c.json({ ok: true });
});

highlightsRouter.patch(
  '/:bookId/highlights/:highlightId',
  readerAuth,
  zValidator('json', HighlightUpdateSchema),
  async (c) => {
    const { bookId, highlightId } = c.req.param();
    const auth = c.get('auth');
    const body = c.req.valid('json');

    const mismatch = await assertBookAccess(
      c.env,
      auth,
      bookId,
      c.executionCtx,
      getRequestTraceId(c),
    );
    if (mismatch) return mismatch.response;

    const highlight = await queryFirst<HighlightRow>(
      c.env,
      `SELECT * FROM highlights WHERE id = ? AND book_id = ?`,
      [highlightId, bookId],
    );

    if (!highlight) {
      throw new NotFoundError('Highlight');
    }

    if (highlight.user_email !== auth.email) {
      throw new ForbiddenError('Cannot edit others highlights');
    }

    const now = new Date().toISOString();
    const updates: string[] = ['updated_at = ?'];
    const args: (string | number | null)[] = [now];

    if (body.note !== undefined) {
      updates.push('note = ?');
      args.push(body.note);
    }
    if (body.color !== undefined) {
      updates.push('color = ?');
      args.push(body.color);
    }

    args.push(highlightId);

    await execute(c.env, `UPDATE highlights SET ${updates.join(', ')} WHERE id = ?`, args);

    await logAudit(
      c.env,
      {
        entityType: 'highlight',
        entityId: highlightId,
        action: 'update',
        actorEmail: auth.email,
        payload: body,
      },
      c.executionCtx,
    );

    return c.json({
      ok: true,
      data: { id: highlightId, ...body },
    });
  },
);

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../../lib/env';
import type { AuthContext } from '../../auth/middleware';
import { queryFirst, queryAll, execute } from '../../db/client';
import { logAudit } from '../../audit';
import { HighlightCreateSchema } from '@do-epub-studio/shared';
import { readerAuth } from '../../middleware/auth';

export const highlightsRouter = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

interface HighlightRow {
  [key: string]: string | number | null | undefined;
  id: string;
  book_id: string;
  user_email: string;
  chapter_ref: string | null;
  cfi_range: string | null;
  selected_text: string;
  note: string | null;
  color: string;
  created_at: string;
  updated_at: string;
}

highlightsRouter.get('/:bookId/highlights', readerAuth, async (c) => {
  const bookId = c.req.param('bookId');
  const auth = c.get('auth');

  const highlights = await queryAll<HighlightRow>(
    c.env,
    `SELECT * FROM highlights WHERE book_id = ? AND user_email = ? ORDER BY created_at DESC`,
    [bookId, auth.email],
  );

  return c.json({
    ok: true,
    data: highlights.map((hl) => ({
      id: hl.id,
      chapterRef: hl.chapter_ref,
      cfiRange: hl.cfi_range,
      selectedText: hl.selected_text,
      note: hl.note,
      color: hl.color,
      createdAt: hl.created_at,
      updatedAt: hl.updated_at,
    })),
  });
});

highlightsRouter.post('/:bookId/highlights', zValidator('json', HighlightCreateSchema), readerAuth, async (c) => {
  const bookId = c.req.param('bookId');
  const auth = c.get('auth');
  const body = c.req.valid('json');

  if (!auth.capabilities.canHighlight) {
    return c.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const { locator } = body;

  await execute(
    c.env,
    `INSERT INTO highlights (id, book_id, user_email, chapter_ref, cfi_range, selected_text, note, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      bookId,
      auth.email,
      locator.chapterRef,
      locator.cfi,
      locator.selectedText,
      body.note ?? null,
      body.color ?? '#ffff00',
      now,
      now,
    ],
  );

  await logAudit(c.env, {
    entityType: 'highlight',
    entityId: id,
    action: 'create',
    actorEmail: auth.email,
    payload: { bookId, chapterRef: locator.chapterRef, color: body.color },
  });

  return c.json(
    {
      ok: true,
      data: {
        id,
        chapterRef: locator.chapterRef,
        cfiRange: locator.cfi,
        selectedText: locator.selectedText,
        note: body.note,
        color: body.color ?? '#ffff00',
        createdAt: now,
        updatedAt: now,
      },
    },
    201,
  );
});

highlightsRouter.delete('/:bookId/highlights/:highlightId', readerAuth, async (c) => {
  const { bookId, highlightId } = c.req.param();
  const auth = c.get('auth');

  await execute(c.env, `DELETE FROM highlights WHERE id = ? AND book_id = ? AND user_email = ?`, [
    highlightId,
    bookId,
    auth.email,
  ]);

  await logAudit(c.env, {
    entityType: 'highlight',
    entityId: highlightId,
    action: 'delete',
    actorEmail: auth.email,
    payload: { bookId },
  });

  return c.json({ ok: true });
});

const HighlightUpdateSchema = HighlightCreateSchema.pick({ note: true, color: true }).partial();

highlightsRouter.patch('/:bookId/highlights/:highlightId', zValidator('json', HighlightUpdateSchema), readerAuth, async (c) => {
  const { highlightId } = c.req.param();
  const auth = c.get('auth');
  const body = c.req.valid('json');

  const highlight = await queryFirst<HighlightRow>(c.env, `SELECT * FROM highlights WHERE id = ?`, [
    highlightId,
  ]);

  if (!highlight) {
    return c.json(
      { ok: false, error: { code: 'NOT_FOUND', message: 'Highlight not found' } },
      404,
    );
  }

  if (highlight.user_email !== auth.email) {
    return c.json(
      { ok: false, error: { code: 'FORBIDDEN', message: 'Cannot edit others highlights' } },
      403,
    );
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

  await logAudit(c.env, {
    entityType: 'highlight',
    entityId: highlightId,
    action: 'update',
    actorEmail: auth.email,
    payload: body,
  });

  return c.json({
    ok: true,
    data: { id: highlightId, ...body },
  });
});

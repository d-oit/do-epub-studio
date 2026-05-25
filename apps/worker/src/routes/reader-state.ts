import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../lib/env';
import { requireAuth } from '../auth/middleware';
import type { AuthContext } from '../auth/middleware';
import { queryFirst, queryAll, execute } from '../db/client';
import { logAudit } from '../audit';
import {
  ProgressUpdateSchema,
  BookmarkCreateSchema,
  HighlightCreateSchema,
} from '@do-epub-studio/shared';

export const readerStateRouter = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

interface ProgressRow {
  [key: string]: string | number | null | undefined;
  id: string;
  book_id: string;
  user_email: string;
  locator_json: string;
  progress_percent: number;
  updated_at: string;
}

interface BookmarkRow {
  [key: string]: string | number | null | undefined;
  id: string;
  book_id: string;
  user_email: string;
  locator_json: string;
  label: string | null;
  created_at: string;
}

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

readerStateRouter.use('/:bookId/*', async (c, next) => {
  const auth = await requireAuth(c.env, c.req.raw);
  if (!auth) {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, 401);
  }
  c.set('auth', auth);
  await next();
});

readerStateRouter.get('/:bookId/progress', async (c) => {
  const bookId = c.req.param('bookId');
  const auth = c.get('auth');

  const progress = await queryFirst<ProgressRow>(
    c.env,
    `SELECT * FROM reading_progress WHERE book_id = ? AND user_email = ?`,
    [bookId, auth.email],
  );

  if (!progress) {
    return c.json({
      ok: true,
      data: { locator: null, progressPercent: 0 },
    });
  }

  return c.json({
    ok: true,
    data: {
      locator: JSON.parse(progress.locator_json) as Record<string, unknown>,
      progressPercent: progress.progress_percent,
      updatedAt: progress.updated_at,
    },
  });
});

readerStateRouter.put('/:bookId/progress', zValidator('json', ProgressUpdateSchema), async (c) => {
  const bookId = c.req.param('bookId');
  const auth = c.get('auth');
  const body = c.req.valid('json');

  if (!auth.capabilities.canRead) {
    return c.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403);
  }

  const locatorJson = JSON.stringify(body.locator);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await execute(
    c.env,
    `INSERT INTO reading_progress (id, book_id, user_email, locator_json, progress_percent, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(book_id, user_email) DO UPDATE SET
       locator_json = excluded.locator_json,
       progress_percent = excluded.progress_percent,
       updated_at = excluded.updated_at`,
    [id, bookId, auth.email, locatorJson, body.progressPercent, now],
  );

  return c.json({
    ok: true,
    data: { locator: body.locator, progressPercent: body.progressPercent, updatedAt: now },
  });
});

readerStateRouter.get('/:bookId/bookmarks', async (c) => {
  const bookId = c.req.param('bookId');
  const auth = c.get('auth');

  const bookmarks = await queryAll<BookmarkRow>(
    c.env,
    `SELECT * FROM bookmarks WHERE book_id = ? AND user_email = ? ORDER BY created_at DESC`,
    [bookId, auth.email],
  );

  return c.json({
    ok: true,
    data: bookmarks.map((bm) => ({
      id: bm.id,
      locator: JSON.parse(bm.locator_json) as Record<string, unknown>,
      label: bm.label,
      createdAt: bm.created_at,
    })),
  });
});

readerStateRouter.post('/:bookId/bookmarks', zValidator('json', BookmarkCreateSchema), async (c) => {
  const bookId = c.req.param('bookId');
  const auth = c.get('auth');
  const body = c.req.valid('json');

  if (!auth.capabilities.canBookmark) {
    return c.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403);
  }

  const id = crypto.randomUUID();
  const locatorJson = JSON.stringify(body.locator);
  const now = new Date().toISOString();

  await execute(
    c.env,
    `INSERT INTO bookmarks (id, book_id, user_email, locator_json, label, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, bookId, auth.email, locatorJson, body.label ?? null, now],
  );

  return c.json(
    {
      ok: true,
      data: { id, locator: body.locator, label: body.label, createdAt: now },
    },
    201,
  );
});

readerStateRouter.delete('/:bookId/bookmarks/:bookmarkId', async (c) => {
  const { bookId, bookmarkId } = c.req.param();
  const auth = c.get('auth');

  await execute(c.env, `DELETE FROM bookmarks WHERE id = ? AND book_id = ? AND user_email = ?`, [
    bookmarkId,
    bookId,
    auth.email,
  ]);

  return c.json({ ok: true });
});

readerStateRouter.get('/:bookId/highlights', async (c) => {
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

readerStateRouter.post('/:bookId/highlights', zValidator('json', HighlightCreateSchema), async (c) => {
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

readerStateRouter.delete('/:bookId/highlights/:highlightId', async (c) => {
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

readerStateRouter.patch('/:bookId/highlights/:highlightId', zValidator('json', HighlightUpdateSchema), async (c) => {
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

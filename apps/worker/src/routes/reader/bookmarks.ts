import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../../lib/env';
import type { AuthContext } from '../../auth/middleware';
import { queryAll, queryFirst, execute } from '../../db/client';
import { BookmarkCreateSchema } from '@do-epub-studio/shared';
import { readerAuth } from '../../middleware/auth';
import { parseLocatorRow, assertBookAccess } from '../../lib/tenant-isolation';
import { getRequestTraceId } from '../../lib/api-error';
import { ForbiddenError } from '../../lib/http-errors';

export const bookmarksRouter = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

interface BookmarkRow {
  [key: string]: string | number | null | undefined;
  id: string;
  book_id: string;
  user_email: string;
  locator_json: string;
  label: string | null;
  created_at: string;
}

bookmarksRouter.get('/:bookId/bookmarks', readerAuth, async (c) => {
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

  const bookmarks = await queryAll<BookmarkRow>(
    c.env,
    `SELECT * FROM bookmarks WHERE book_id = ? AND user_email = ? ORDER BY created_at DESC LIMIT 1000`,
    [bookId, auth.email],
  );

  const parsedBookmarks = await Promise.all(
    bookmarks.map(async (bm) => ({
      id: bm.id,
      locator: await parseLocatorRow(
        c.env,
        bm.locator_json,
        { entityType: 'bookmark', entityId: bm.id, bookId },
        c.executionCtx,
      ),
      label: bm.label,
      createdAt: bm.created_at,
    })),
  );

  return c.json({
    ok: true,
    data: parsedBookmarks.filter((bm) => bm.locator !== null),
  });
});

bookmarksRouter.post(
  '/:bookId/bookmarks',
  readerAuth,
  zValidator('json', BookmarkCreateSchema),
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

    if (!auth.capabilities.canBookmark) {
      throw new ForbiddenError('Access denied');
    }

    const mutationId = body.mutationId ?? null;
    const id = crypto.randomUUID();
    const locatorJson = JSON.stringify(body.locator);
    const now = new Date().toISOString();

    const inserted = await queryFirst<BookmarkRow>(
      c.env,
      `INSERT INTO bookmarks (id, book_id, user_email, mutation_id, locator_json, label, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(mutation_id) WHERE mutation_id IS NOT NULL DO NOTHING
       RETURNING *`,
      [id, bookId, auth.email, mutationId, locatorJson, body.label ?? null, now],
    );

    if (inserted) {
      return c.json(
        {
          ok: true,
          data: { id, locator: body.locator, label: body.label, createdAt: now },
        },
        201,
      );
    }

    if (!mutationId) throw new Error('Failed to insert bookmark');

    const existing = await queryFirst<BookmarkRow>(
      c.env,
      `SELECT * FROM bookmarks WHERE mutation_id = ?`,
      [mutationId],
    );

    if (!existing) throw new Error('Failed to find conflicting bookmark');
    if (existing.book_id !== bookId || existing.user_email !== auth.email) {
      throw new ForbiddenError('Access denied');
    }

    const locator = await parseLocatorRow(
      c.env,
      existing.locator_json,
      { entityType: 'bookmark', entityId: existing.id, bookId },
      c.executionCtx,
    );
    if (!locator) throw new Error('Failed to parse conflicting bookmark locator');

    return c.json(
      {
        ok: true,
        data: {
          id: existing.id,
          locator,
          label: existing.label ?? undefined,
          createdAt: existing.created_at,
        },
      },
      200,
    );
  },
);

bookmarksRouter.delete('/:bookId/bookmarks/:bookmarkId', readerAuth, async (c) => {
  const { bookId, bookmarkId } = c.req.param();
  const auth = c.get('auth');

  const mismatch = await assertBookAccess(
    c.env,
    auth,
    bookId,
    c.executionCtx,
    getRequestTraceId(c),
  );
  if (mismatch) return mismatch.response;

  await execute(c.env, `DELETE FROM bookmarks WHERE id = ? AND book_id = ? AND user_email = ?`, [
    bookmarkId,
    bookId,
    auth.email,
  ]);

  return c.json({ ok: true });
});

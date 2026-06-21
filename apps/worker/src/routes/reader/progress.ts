import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../../lib/env';
import type { AuthContext } from '../../auth/middleware';
import { queryFirst, execute } from '../../db/client';
import { ProgressUpdateSchema } from '@do-epub-studio/shared';
import { readerAuth } from '../../middleware/auth';
import { parseLocatorRow, assertBookAccess } from '../../lib/tenant-isolation';

export const progressRouter = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

interface ProgressRow {
  [key: string]: string | number | null | undefined;
  id: string;
  book_id: string;
  user_email: string;
  locator_json: string;
  progress_percent: number;
  updated_at: string;
}

progressRouter.get('/:bookId/progress', readerAuth, async (c) => {
  const bookId = c.req.param('bookId');
  const auth = c.get('auth');

  const mismatch = await assertBookAccess(c.env, auth, bookId, c.executionCtx);
  if (mismatch) return mismatch.response;

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

  const locator = await parseLocatorRow(
    c.env,
    progress.locator_json,
    { entityType: 'highlight', entityId: progress.id, bookId },
    c.executionCtx,
  );

  return c.json({
    ok: true,
    data: {
      locator,
      progressPercent: progress.progress_percent,
      updatedAt: progress.updated_at,
    },
  });
});

progressRouter.put('/:bookId/progress', readerAuth, zValidator('json', ProgressUpdateSchema), async (c) => {
  const bookId = c.req.param('bookId');
  const auth = c.get('auth');
  const body = c.req.valid('json');

  const mismatch = await assertBookAccess(c.env, auth, bookId, c.executionCtx);
  if (mismatch) return mismatch.response;

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

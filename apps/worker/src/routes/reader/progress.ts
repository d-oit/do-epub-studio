import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../../lib/env';
import type { AuthContext } from '../../auth/middleware';
import { queryFirst, transaction } from '../../db/client';
import { ProgressUpdateSchema } from '@do-epub-studio/shared';
import { readerAuth } from '../../middleware/auth';
import { parseLocatorRow, assertBookAccess } from '../../lib/tenant-isolation';
import { getRequestTraceId } from '../../lib/api-error';
import { AppError, ForbiddenError } from '../../lib/http-errors';

export const progressRouter = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

interface ProgressRow {
  [key: string]: string | number | null | undefined;
  id: string;
  book_id: string;
  user_email: string;
  locator_json: string;
  progress_percent: number;
  updated_at: string;
  revision: number;
  mutation_id: string | null;
}

async function toProgressData(
  env: Env,
  row: ProgressRow,
  bookId: string,
  ctx: { waitUntil: (promise: Promise<unknown>) => void },
) {
  const locator = await parseLocatorRow(
    env,
    row.locator_json,
    { entityType: 'progress', entityId: row.id, bookId },
    ctx,
  );
  if (!locator) throw new Error('Failed to parse progress locator');
  return {
    locator,
    progressPercent: row.progress_percent,
    updatedAt: row.updated_at,
    revision: row.revision,
  };
}

progressRouter.get('/:bookId/progress', readerAuth, async (c) => {
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

  const progress = await queryFirst<ProgressRow>(
    c.env,
    `SELECT * FROM reading_progress WHERE book_id = ? AND user_email = ?`,
    [bookId, auth.email],
  );

  if (!progress) {
    return c.json({
      ok: true,
      data: { locator: null, progressPercent: 0, updatedAt: null, revision: 0 },
    });
  }

  return c.json({
    ok: true,
    data: await toProgressData(c.env, progress, bookId, c.executionCtx),
  });
});

progressRouter.put(
  '/:bookId/progress',
  readerAuth,
  zValidator('json', ProgressUpdateSchema),
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

    if (!auth.capabilities.canRead) {
      throw new ForbiddenError('Access denied');
    }
    const replay = await queryFirst<ProgressRow>(
      c.env,
      `SELECT progress_id AS id, book_id, user_email, locator_json, progress_percent, updated_at, revision, mutation_id
       FROM reading_progress_mutations
       WHERE book_id = ? AND user_email = ? AND mutation_id = ?`,
      [bookId, auth.email, body.mutationId],
    );
    if (replay) {
      return c.json({
        ok: true,
        data: await toProgressData(c.env, replay, bookId, c.executionCtx),
      });
    }

    const existing = await queryFirst<ProgressRow>(
      c.env,
      `SELECT * FROM reading_progress WHERE book_id = ? AND user_email = ?`,
      [bookId, auth.email],
    );

    if (existing?.mutation_id === body.mutationId) {
      return c.json({
        ok: true,
        data: await toProgressData(c.env, existing, bookId, c.executionCtx),
      });
    }

    const now = new Date().toISOString();
    const recordMutationSql = `INSERT OR IGNORE INTO reading_progress_mutations
      (mutation_id, book_id, user_email, progress_id, locator_json, progress_percent, updated_at, revision)
      SELECT mutation_id, book_id, user_email, id, locator_json, progress_percent, updated_at, revision
      FROM reading_progress
      WHERE book_id = ? AND user_email = ? AND mutation_id = ?`;

    if (existing) {
      const followsLocalMutation =
        body.dependsOnMutationId !== undefined &&
        body.dependsOnMutationId === existing.mutation_id &&
        existing.revision > body.baseRevision;
      if (existing.revision !== body.baseRevision && !followsLocalMutation) {
        throw new AppError('Reading progress changed on the server', 'PROGRESS_CONFLICT', 409);
      }

      await transaction(c.env, [
        {
          sql: `UPDATE reading_progress
                SET locator_json = ?, progress_percent = ?, updated_at = ?, revision = revision + 1, mutation_id = ?
                WHERE id = ? AND revision = ?`,
          args: [
            JSON.stringify(body.locator),
            body.progressPercent,
            now,
            body.mutationId,
            existing.id,
            existing.revision,
          ],
        },
        {
          sql: recordMutationSql,
          args: [bookId, auth.email, body.mutationId],
        },
      ]);
    } else {
      if (body.baseRevision !== 0 || body.dependsOnMutationId !== undefined) {
        throw new AppError('Reading progress changed on the server', 'PROGRESS_CONFLICT', 409);
      }

      await transaction(c.env, [
        {
          sql: `INSERT INTO reading_progress
                (id, book_id, user_email, locator_json, progress_percent, updated_at, revision, mutation_id)
                VALUES (?, ?, ?, ?, ?, ?, 1, ?)
                ON CONFLICT(book_id, user_email) DO NOTHING`,
          args: [
            crypto.randomUUID(),
            bookId,
            auth.email,
            JSON.stringify(body.locator),
            body.progressPercent,
            now,
            body.mutationId,
          ],
        },
        {
          sql: recordMutationSql,
          args: [bookId, auth.email, body.mutationId],
        },
      ]);
    }

    const applied = await queryFirst<ProgressRow>(
      c.env,
      `SELECT progress_id AS id, book_id, user_email, locator_json, progress_percent, updated_at, revision, mutation_id
       FROM reading_progress_mutations
       WHERE book_id = ? AND user_email = ? AND mutation_id = ?`,
      [bookId, auth.email, body.mutationId],
    );
    if (applied) {
      return c.json({
        ok: true,
        data: await toProgressData(c.env, applied, bookId, c.executionCtx),
      });
    }

    throw new AppError('Reading progress changed on the server', 'PROGRESS_CONFLICT', 409);
  },
);

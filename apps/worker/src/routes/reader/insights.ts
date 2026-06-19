import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../../lib/env';
import type { AuthContext } from '../../auth/middleware';
import { queryAll, execute } from '../../db/client';
import { ReadingInsightSyncSchema } from '@do-epub-studio/schema';
import { readerAuth } from '../../middleware/auth';
import { assertBookAccess } from '../../lib/tenant-isolation';

export const insightsRouter = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

interface InsightRow {
  [key: string]: string | number | null | undefined;
  id: string;
  book_id: string;
  user_email: string;
  bucket_date: string;
  active_minutes: number;
  updated_at: string;
}

insightsRouter.get('/:bookId/insights', readerAuth, async (c) => {
  const bookId = c.req.param('bookId');
  const auth = c.get('auth');

  const mismatch = await assertBookAccess(c.env, auth, bookId, c.executionCtx);
  if (mismatch) return mismatch.response;

  const rows = await queryAll<InsightRow>(
    c.env,
    `SELECT * FROM reading_insights WHERE book_id = ? AND user_email = ? ORDER BY bucket_date DESC LIMIT 30`,
    [bookId, auth.email],
  );

  const totalActiveMinutes = rows.reduce((sum, r) => sum + (r.active_minutes ?? 0), 0);

  const currentStreakDays = computeStreak(rows.map((r) => r.bucket_date ?? ''));

  const recentActivity = rows
    .slice(0, 7)
    .reverse()
    .map((r) => ({
      date: r.bucket_date ?? '',
      activeMinutes: r.active_minutes ?? 0,
    }));

  return c.json({
    ok: true,
    data: {
      totalActiveMinutes,
      currentStreakDays,
      recentActivity,
    },
  });
});

insightsRouter.post('/:bookId/insights/sync', zValidator('json', ReadingInsightSyncSchema), readerAuth, async (c) => {
  const bookId = c.req.param('bookId');
  const auth = c.get('auth');
  const body = c.req.valid('json');

  const mismatch = await assertBookAccess(c.env, auth, bookId, c.executionCtx);
  if (mismatch) return mismatch.response;

  if (!auth.capabilities.canRead) {
    return c.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403);
  }

  try {
    for (const bucket of body.buckets) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      await execute(
        c.env,
        `INSERT INTO reading_insights (id, book_id, user_email, bucket_date, active_minutes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(book_id, user_email, bucket_date) DO UPDATE SET
           active_minutes = MAX(reading_insights.active_minutes, excluded.active_minutes),
           updated_at = excluded.updated_at`,
        [id, bookId, auth.email, bucket.date, bucket.activeMinutes, now, now],
      );
    }

    return c.json({ ok: true });
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', event: 'reader.insight_sync_failed', bookId, error: String(e) }));
    return c.json({ ok: false, error: { code: 'SYNC_FAILED', message: 'Failed to sync insights' } }, 500);
  }
});

function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0;

  const today = new Date().toISOString().slice(0, 10);
  const dateSet = new Set(dates);

  if (!dateSet.has(today)) return 0;

  let streak = 1;
  let current = new Date(today);

  while (true) {
    current = new Date(current);
    current.setDate(current.getDate() - 1);
    const key = current.toISOString().slice(0, 10);
    if (dateSet.has(key)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

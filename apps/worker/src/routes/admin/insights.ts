import { Hono } from 'hono';
import type { Env } from '../../lib/env';
import { queryAll } from '../../db/client';
import { adminAuth } from '../../middleware/auth';

export const adminInsightsRouter = new Hono<{
  Bindings: Env;
  Variables: { adminUser: { email: string; id: string; role: string } };
}>();

interface InsightAggRow {
  [key: string]: string | number | null | undefined;
  book_id: string;
  total_active_minutes: number;
  total_active_pages: number;
  reader_count: number;
  last_activity: string | null;
}

/**
 * GET /admin/insights
 *
 * Aggregated book-level reading statistics.
 * Per ADR-102b §7: shows aggregate summaries only — no individual reader timelines.
 *
 * Query params:
 *   limit  (default 20, max 100)
 *   offset (default 0)
 */
const MAX_OFFSET = 100_000;

adminInsightsRouter.get('/insights', adminAuth, async (c) => {
  const rawLimit = parseInt(c.req.query('limit') ?? '20', 10);
  const rawOffset = parseInt(c.req.query('offset') ?? '0', 10);
  const limit = Math.min(Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 20), 100);
  const offset = Math.min(Math.max(0, Number.isFinite(rawOffset) ? rawOffset : 0), MAX_OFFSET);

  const rows = await queryAll<InsightAggRow>(
    c.env,
    `SELECT
       book_id,
       SUM(active_minutes) AS total_active_minutes,
       SUM(active_pages)   AS total_active_pages,
       COUNT(DISTINCT user_email) AS reader_count,
       MAX(bucket_date)    AS last_activity
     FROM reading_insights
     GROUP BY book_id
     ORDER BY last_activity DESC
     LIMIT ? OFFSET ?`,
    [limit, offset],
  );

  return c.json({
    ok: true,
    data: rows.map((r) => ({
      bookId: r.book_id,
      totalActiveMinutes: r.total_active_minutes,
      totalActivePages: r.total_active_pages,
      readerCount: r.reader_count,
      lastActivity: r.last_activity,
    })),
    pagination: { limit, offset },
  });
});

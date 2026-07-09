import { Hono } from 'hono';
import type { Env } from '../../lib/env';
import { queryAll, queryFirst } from '../../db/client';
import { adminAuth } from '../../middleware/auth';

export const statsRouter = new Hono<{ Bindings: Env; Variables: { adminUser: { email: string; id: string; role: string } } }>();

statsRouter.get('/stats', adminAuth, async (c) => {
  const [bookCountRow, activeGrantsRow, activeSessionsRow, archivedBooksRow] = await Promise.all([
    queryFirst<{ cnt: number }>(c.env, "SELECT COUNT(*) as cnt FROM books WHERE archived_at IS NULL", []),
    queryFirst<{ cnt: number }>(
      c.env,
      "SELECT COUNT(*) as cnt FROM book_access_grants WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > datetime('now'))",
      [],
    ),
    queryFirst<{ cnt: number }>(
      c.env,
      "SELECT COUNT(*) as cnt FROM reader_sessions WHERE revoked_at IS NULL AND expires_at > datetime('now')",
      [],
    ),
    queryFirst<{ cnt: number }>(c.env, "SELECT COUNT(*) as cnt FROM books WHERE archived_at IS NOT NULL", []),
  ]);

  // Storage usage from book_files
  const storageRow = await queryFirst<{ total_bytes: number | null }>(
    c.env,
    'SELECT COALESCE(SUM(file_size_bytes), 0) as total_bytes FROM book_files',
    [],
  );

  // Recent activity (last 7 days of audit entries)
  const recentActivity = await queryAll<{ action: string; cnt: number }>(
    c.env,
    `SELECT action, COUNT(*) as cnt FROM audit_log
     WHERE created_at >= datetime('now', '-7 days')
     GROUP BY action ORDER BY cnt DESC LIMIT 10`,
    [],
  );

  const totalBooks = bookCountRow?.cnt ?? 0;
  const activeGrants = activeGrantsRow?.cnt ?? 0;
  const activeSessions = activeSessionsRow?.cnt ?? 0;
  const archivedBooks = archivedBooksRow?.cnt ?? 0;
  const storageBytes = storageRow?.total_bytes ?? 0;

  return c.json({
    ok: true,
    data: {
      totalBooks,
      archivedBooks,
      activeGrants,
      activeSessions,
      storageBytes,
      recentActivity: recentActivity.map((row) => ({
        action: row.action,
        count: row.cnt,
      })),
    },
  });
});

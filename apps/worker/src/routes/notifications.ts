import { Hono } from 'hono';
import type { Env } from '../lib/env';
import type { AuthContext } from '../auth/middleware';
import { queryFirst, queryAll, execute } from '../db/client';
import { readerAuth } from '../middleware/auth';

export const notificationsRouter = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

interface NotificationRow {
  [key: string]: string | number | null | undefined;
  id: string;
  user_email: string;
  book_id: string;
  comment_id: string;
  parent_comment_id: string | null;
  type: string;
  message: string;
  read_at: string | null;
  created_at: string;
}

/**
 * GET /api/notifications
 * List notifications for the authenticated user with pagination.
 */
notificationsRouter.get('/notifications', readerAuth, async (c) => {
  const auth = c.get('auth');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10), 100);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);
  const unreadOnly = c.req.query('unread') === 'true';

  const conditions = ['user_email = ?'];
  const args: (string | number)[] = [auth.email];

  if (unreadOnly) {
    conditions.push('read_at IS NULL');
  }

  const whereClause = ` WHERE ${conditions.join(' AND ')}`;

  const countResult = await queryFirst<{ cnt: number }>(
    c.env,
    `SELECT COUNT(*) as cnt FROM notifications${whereClause}`,
    args,
  );
  const total = countResult?.cnt ?? 0;

  const notifications = await queryAll<NotificationRow>(
    c.env,
    `SELECT * FROM notifications${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...args, limit, offset],
  );

  return c.json({
    ok: true,
    data: {
      notifications: notifications.map((n) => ({
        id: n.id,
        bookId: n.book_id,
        commentId: n.comment_id,
        parentCommentId: n.parent_comment_id,
        type: n.type,
        message: n.message,
        readAt: n.read_at,
        createdAt: n.created_at,
      })),
      total,
      limit,
      offset,
    },
  });
});

/**
 * GET /api/notifications/unread-count
 * Get count of unread notifications for the authenticated user.
 */
notificationsRouter.get('/notifications/unread-count', readerAuth, async (c) => {
  const auth = c.get('auth');

  const result = await queryFirst<{ cnt: number }>(
    c.env,
    `SELECT COUNT(*) as cnt FROM notifications WHERE user_email = ? AND read_at IS NULL`,
    [auth.email],
  );

  return c.json({
    ok: true,
    data: { count: result?.cnt ?? 0 },
  });
});

/**
 * POST /api/notifications/read-all
 * Mark all notifications as read for the authenticated user.
 */
notificationsRouter.post('/notifications/read-all', readerAuth, async (c) => {
  const auth = c.get('auth');
  const now = new Date().toISOString();

  await execute(
    c.env,
    `UPDATE notifications SET read_at = ? WHERE user_email = ? AND read_at IS NULL`,
    [now, auth.email],
  );

  return c.json({ ok: true });
});

/**
 * POST /api/notifications/:id/read
 * Mark a single notification as read.
 */
notificationsRouter.post('/notifications/:id/read', readerAuth, async (c) => {
  const notificationId = c.req.param('id');
  const auth = c.get('auth');
  const now = new Date().toISOString();

  const notification = await queryFirst<NotificationRow>(
    c.env,
    `SELECT * FROM notifications WHERE id = ? AND user_email = ?`,
    [notificationId, auth.email],
  );

  if (!notification) {
    return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Notification not found' } }, 404);
  }

  await execute(
    c.env,
    `UPDATE notifications SET read_at = ? WHERE id = ?`,
    [now, notificationId],
  );

  return c.json({ ok: true });
});

/**
 * Helper: Create a notification when someone replies to a comment.
 * Called from comments route when a reply is created.
 */
export async function createReplyNotification(
  env: Env,
  params: {
    bookId: string;
    commentId: string;
    parentCommentId: string;
    replierEmail: string;
  },
): Promise<void> {
  const { bookId, commentId, parentCommentId, replierEmail } = params;

  // Get the parent comment to find the author
  const parentComment = await queryFirst<{ user_email: string; body: string }>(
    env,
    `SELECT user_email, body FROM comments WHERE id = ?`,
    [parentCommentId],
  );

  if (!parentComment) return;

  // Don't notify if replying to own comment
  if (parentComment.user_email === replierEmail) return;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  // Sanitize parent comment body for notification message (strip HTML-like chars)
  const sanitizedBody = parentComment.body.replace(/[<>&"']/g, '').slice(0, 50);
  const message = `New reply to your comment: "${sanitizedBody}${parentComment.body.length > 50 ? '...' : ''}"`;

  await execute(
    env,
    `INSERT INTO notifications (id, user_email, book_id, comment_id, parent_comment_id, type, message, created_at)
     VALUES (?, ?, ?, ?, ?, 'reply', ?, ?)`,
    [id, parentComment.user_email, bookId, commentId, parentCommentId, message, now],
  );
}

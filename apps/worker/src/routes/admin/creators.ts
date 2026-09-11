import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env, JsonRow } from '../../lib/env';
import { queryFirst, queryAll, execute } from '../../db/client';
import { logAudit } from '../../audit';
import { CreatorAssignSchema } from '@do-epub-studio/schema';
import { adminAuth } from '../../middleware/auth';
import { requireStepUp } from '../../middleware/step-up';
import { NotFoundError, AppError } from '../../lib/http-errors';

export const creatorsAdminRouter = new Hono<{ Bindings: Env; Variables: { adminUser: { email: string; id: string; role: string } } }>();

interface CreatorRow extends JsonRow {
  email: string;
  assigned_at: string;
}

// ADR-234 sensitive-action "creator assignment": book-scoped review rights.
creatorsAdminRouter.post(
  '/books/:id/creators',
  adminAuth,
  requireStepUp,
  zValidator('json', CreatorAssignSchema),
  async (c) => {
    const bookId = c.req.param('id');
    const body = c.req.valid('json');
    const adminUser = c.get('adminUser');

    const book = await queryFirst<{ id: string }>(
      c.env,
      `SELECT id FROM books WHERE id = ?`,
      [bookId],
    );
    if (!book) {
      throw new NotFoundError('Book');
    }

    // Creators are team members with accounts — never auto-create users.
    const user = await queryFirst<{ id: string }>(
      c.env,
      `SELECT id FROM users WHERE email = ?`,
      [body.email],
    );
    if (!user) {
      throw new AppError('No user account for this email', 'NO_USER', 404);
    }

    const now = new Date().toISOString();
    const existing = await queryFirst<{ id: string }>(
      c.env,
      `SELECT id FROM book_creators WHERE book_id = ? AND user_id = ?`,
      [bookId, user.id],
    );
    if (!existing) {
      await execute(
        c.env,
        `INSERT INTO book_creators (id, book_id, user_id, assigned_by_user_id, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), bookId, user.id, adminUser.id, now],
      );
      await logAudit(c.env, {
        entityType: 'book-creator',
        entityId: `${bookId}:${user.id}`,
        action: 'assigned',
        actorEmail: adminUser.email,
        payload: { bookId, email: body.email },
      }, c.executionCtx);
    }

    return c.json({ ok: true, data: { bookId, email: body.email, alreadyAssigned: Boolean(existing) } }, 201);
  },
);

creatorsAdminRouter.delete(
  '/books/:id/creators',
  adminAuth,
  requireStepUp,
  zValidator('json', CreatorAssignSchema),
  async (c) => {
    const bookId = c.req.param('id');
    const body = c.req.valid('json');
    const adminUser = c.get('adminUser');

    const user = await queryFirst<{ id: string }>(
      c.env,
      `SELECT id FROM users WHERE email = ?`,
      [body.email],
    );
    if (user) {
      // Revocation is a hard delete; the audit entry preserves the history.
      await execute(
        c.env,
        `DELETE FROM book_creators WHERE book_id = ? AND user_id = ?`,
        [bookId, user.id],
      );
      await logAudit(c.env, {
        entityType: 'book-creator',
        entityId: `${bookId}:${user.id}`,
        action: 'revoked',
        actorEmail: adminUser.email,
        payload: { bookId, email: body.email },
      }, c.executionCtx);
    }

    return c.json({ ok: true, data: { bookId, email: body.email } });
  },
);

creatorsAdminRouter.get('/books/:id/creators', adminAuth, async (c) => {
  const bookId = c.req.param('id');

  const book = await queryFirst<{ id: string }>(
    c.env,
    `SELECT id FROM books WHERE id = ?`,
    [bookId],
  );
  if (!book) {
    throw new NotFoundError('Book');
  }

  const rows = await queryAll<CreatorRow>(
    c.env,
    `SELECT u.email AS email, bc.created_at AS assigned_at
     FROM book_creators bc JOIN users u ON u.id = bc.user_id
     WHERE bc.book_id = ? ORDER BY bc.created_at ASC LIMIT 200`,
    [bookId],
  );

  return c.json({ ok: true, data: rows });
});

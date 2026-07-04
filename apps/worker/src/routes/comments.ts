import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../lib/env';
import type { AuthContext } from '../auth/middleware';
import { queryFirst, queryAll, execute } from '../db/client';
import { logAudit } from '../audit';
import { getGrantByBookAndSession, computeCapabilities } from '../auth/password';
import {
  CommentCreateSchema,
  CommentUpdateSchema,
} from '@do-epub-studio/shared';
import { parseLocatorRow, assertBookAccess } from '../lib/tenant-isolation';
import { readerAuth } from '../middleware/auth';

export const commentsRouter = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

interface CommentRow {
  [key: string]: string | number | null | undefined;
  id: string;
  book_id: string;
  user_email: string;
  locator_json: string | null;
  body: string;
  visibility: string;
  status: string;
  parent_comment_id: string | null;
  created_at: string;
  updated_at: string;
}

commentsRouter.get('/books/:bookId/comments', readerAuth, async (c) => {
  const bookId = c.req.param('bookId');
  const auth = c.get('auth');

  const mismatch = await assertBookAccess(c.env, auth, bookId, c.executionCtx);
  if (mismatch) return mismatch.response;

  const comments = await queryAll<CommentRow>(
    c.env,
    `SELECT * FROM comments WHERE book_id = ? AND status != 'deleted' AND (visibility = 'shared' OR user_email = ?) ORDER BY created_at ASC`,
    [bookId, auth.email],
  );

  const parsedComments = await Promise.all(
    comments.map(async (cm) => ({
      id: cm.id,
      userEmail: cm.user_email,
      locator: await parseLocatorRow(
        c.env,
        cm.locator_json,
        { entityType: 'comment', entityId: cm.id, bookId: cm.book_id },
        c.executionCtx,
      ),
      body: cm.body,
      visibility: cm.visibility,
      status: cm.status,
      parentCommentId: cm.parent_comment_id,
      createdAt: cm.created_at,
      updatedAt: cm.updated_at,
    })),
  );

  return c.json({
    ok: true,
    data: parsedComments,
  });
});

commentsRouter.post('/books/:bookId/comments', readerAuth, zValidator('json', CommentCreateSchema), async (c) => {
  const bookId = c.req.param('bookId');
  const auth = c.get('auth');

  const mismatch = await assertBookAccess(c.env, auth, bookId, c.executionCtx);
  if (mismatch) return mismatch.response;

  // Use session capabilities if bookId matches session, otherwise re-fetch
  let canComment = auth.capabilities.canComment;
  if (auth.bookId !== bookId) {
    const grant = await getGrantByBookAndSession(c.env, bookId, auth.email);
    if (grant) {
      canComment = computeCapabilities(grant).canComment;
    }
  }

  if (!canComment) {
    return c.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403);
  }

  const body = c.req.valid('json');
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await execute(
    c.env,
    `INSERT INTO comments (id, book_id, user_email, locator_json, body, visibility, status, parent_comment_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)`,
    [
      id,
      bookId,
      auth.email,
      body.locator ? JSON.stringify(body.locator) : null,
      body.body,
      body.visibility ?? 'shared',
      body.parentCommentId ?? null,
      now,
      now,
    ],
  );

  await logAudit(c.env, {
    entityType: 'comment',
    entityId: id,
    action: 'create',
    actorEmail: auth.email,
    payload: { bookId, visibility: body.visibility },
  }, c.executionCtx);

  return c.json(
    {
      ok: true,
      data: {
        id,
        userEmail: auth.email,
        locator: body.locator,
        body: body.body,
        visibility: body.visibility,
        status: 'open',
        parentCommentId: body.parentCommentId,
        createdAt: now,
        updatedAt: now,
      },
    },
    201,
  );
});

commentsRouter.patch('/comments/:commentId', readerAuth, zValidator('json', CommentUpdateSchema), async (c) => {
  const commentId = c.req.param('commentId');
  const auth = c.get('auth');

  const comment = await queryFirst<CommentRow>(c.env, `SELECT * FROM comments WHERE id = ?`, [
    commentId,
  ]);

  if (!comment) {
    return c.json(
      { ok: false, error: { code: 'NOT_FOUND', message: 'Comment not found' } },
      404,
    );
  }

  if (comment.user_email !== auth.email) {
    return c.json(
      { ok: false, error: { code: 'FORBIDDEN', message: 'Cannot edit others comments' } },
      403,
    );
  }

  const body = c.req.valid('json');
  const now = new Date().toISOString();
  const updates: string[] = ['updated_at = ?'];
  const args: (string | number | null)[] = [now];

  if (body.body !== undefined) {
    updates.push('body = ?');
    args.push(body.body);
  }
  if (body.status !== undefined) {
    updates.push('status = ?');
    args.push(body.status);
  }
  if (body.visibility !== undefined) {
    updates.push('visibility = ?');
    args.push(body.visibility);
  }

  args.push(commentId);

  await execute(c.env, `UPDATE comments SET ${updates.join(', ')} WHERE id = ?`, args);

  await logAudit(c.env, {
    entityType: 'comment',
    entityId: commentId,
    action: 'update',
    actorEmail: auth.email,
    payload: body,
  }, c.executionCtx);

  return c.json({
    ok: true,
    data: { id: commentId, ...body },
  });
});

commentsRouter.delete('/comments/:commentId', readerAuth, async (c) => {
  const commentId = c.req.param('commentId');
  const auth = c.get('auth');

  const comment = await queryFirst<CommentRow>(c.env, `SELECT * FROM comments WHERE id = ?`, [
    commentId,
  ]);

  if (!comment) {
    return c.json(
      { ok: false, error: { code: 'NOT_FOUND', message: 'Comment not found' } },
      404,
    );
  }

  if (comment.user_email !== auth.email) {
    return c.json(
      { ok: false, error: { code: 'FORBIDDEN', message: 'Cannot delete others comments' } },
      403,
    );
  }

  await execute(c.env, `UPDATE comments SET status = 'deleted', updated_at = ? WHERE id = ?`, [
    new Date().toISOString(),
    commentId,
  ]);

  await logAudit(c.env, {
    entityType: 'comment',
    entityId: commentId,
    action: 'delete',
    actorEmail: auth.email,
  }, c.executionCtx);

  return c.json({ ok: true });
});

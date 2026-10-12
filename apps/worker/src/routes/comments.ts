import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../lib/env';
import type { AuthContext } from '../auth/middleware';
import { queryFirst, queryAll, execute } from '../db/client';
import { logAudit } from '../audit';
import { getGrantByBookAndSession, computeCapabilities } from '../auth/password';
import { CommentCreateSchema, CommentUpdateSchema } from '@do-epub-studio/shared';
import { assertBookAccess } from '../lib/tenant-isolation';
import { getRequestTraceId } from '../lib/api-error';
import { readerAuth } from '../middleware/auth';
import { createReplyNotification } from './notifications';
import { NotFoundError, ForbiddenError, AppError } from '../lib/http-errors';

export const commentsRouter = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

interface CommentRow {
  [key: string]: string | number | null | undefined;
  id: string;
  book_id: string;
  user_email: string;
  mutation_id?: string | null;
  chapter_ref: string | null;
  selected_text: string | null;
  body: string;
  visibility: string;
  status: string;
  parent_comment_id: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Comment DTO. The client's `Comment` type reads flat locator fields, and
 * `comments` stores them as `chapter_ref` / `cfi_range` / `selected_text` —
 * this mapper is the single place that keeps the two in step. (The route
 * previously wrote a `locator_json` column that no migration defines, so
 * creating a comment failed with a D1 error.)
 */
function toCommentDTO(row: CommentRow, viewerEmail: string) {
  return {
    id: row.id,
    displayName: row.user_email.slice(0, 2) + '***',
    isOwn: row.user_email === viewerEmail,
    chapterRef: row.chapter_ref ?? null,
    cfiRange: row.cfi_range ?? null,
    selectedText: row.selected_text ?? null,
    body: row.body,
    visibility: row.visibility,
    status: row.status,
    parentCommentId: row.parent_comment_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at ?? null,
  };
}

commentsRouter.get('/books/:bookId/comments', readerAuth, async (c) => {
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

  const comments = await queryAll<CommentRow>(
    c.env,
    `SELECT * FROM comments WHERE book_id = ? AND status != 'deleted' AND (visibility = 'shared' OR user_email = ?) ORDER BY created_at ASC LIMIT 1000`,
    [bookId, auth.email],
  );

  return c.json({
    ok: true,
    data: comments.map((cm) => toCommentDTO(cm, auth.email)),
  });
});

commentsRouter.post(
  '/books/:bookId/comments',
  readerAuth,
  zValidator('json', CommentCreateSchema),
  async (c) => {
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

    // Use session capabilities if bookId matches session, otherwise re-fetch
    let canComment = auth.capabilities.canComment;
    if (auth.bookId !== bookId) {
      const grant = await getGrantByBookAndSession(c.env, bookId, auth.email);
      if (grant) {
        canComment = computeCapabilities(grant).canComment;
      }
    }

    if (!canComment) {
      throw new ForbiddenError('Access denied');
    }

    const body = c.req.valid('json');

    if (body.parentCommentId) {
      const parent = await queryFirst<CommentRow>(c.env, `SELECT * FROM comments WHERE id = ?`, [
        body.parentCommentId,
      ]);
      if (!parent || parent.status === 'deleted' || parent.book_id !== bookId) {
        throw new AppError(
          'Parent comment not found or inaccessible',
          'INVALID_PARENT_COMMENT',
          400,
        );
      }
      if (parent.visibility !== 'shared' && parent.user_email !== auth.email) {
        throw new AppError(
          'Parent comment not found or inaccessible',
          'INVALID_PARENT_COMMENT',
          403,
        );
      }
    }

    const mutationId = body.mutationId ?? null;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const inserted = await queryFirst<CommentRow>(
      c.env,
      `INSERT INTO comments (id, book_id, user_email, mutation_id, chapter_ref, cfi_range, selected_text, body, visibility, status, parent_comment_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)
       ON CONFLICT(mutation_id) WHERE mutation_id IS NOT NULL DO NOTHING
       RETURNING *`,
      [
        id,
        bookId,
        auth.email,
        mutationId,
        body.locator?.chapterRef ?? null,
        body.locator?.cfi ?? null,
        body.locator?.selectedText ?? null,
        body.body,
        body.visibility ?? 'shared',
        body.parentCommentId ?? null,
        now,
        now,
      ],
    );

    if (inserted) {
      await logAudit(
        c.env,
        {
          entityType: 'comment',
          entityId: inserted.id,
          action: 'create',
          actorEmail: auth.email,
          payload: { bookId, visibility: body.visibility },
        },
        c.executionCtx,
      );

      // Trigger notification for reply comments
      if (body.parentCommentId) {
        c.executionCtx.waitUntil(
          createReplyNotification(c.env, {
            bookId,
            commentId: inserted.id,
            parentCommentId: body.parentCommentId,
            replierEmail: auth.email,
          }),
        );
      }

      return c.json(
        {
          ok: true,
          data: toCommentDTO(inserted, auth.email),
        },
        201,
      );
    }

    if (!mutationId) {
      throw new Error('Failed to insert comment');
    }

    const existing = await queryFirst<CommentRow>(
      c.env,
      `SELECT * FROM comments WHERE mutation_id = ?`,
      [mutationId],
    );

    if (!existing) {
      throw new Error('Failed to find conflicting comment');
    }

    if (existing.book_id !== bookId || existing.user_email !== auth.email) {
      throw new ForbiddenError('Access denied');
    }

    return c.json(
      {
        ok: true,
        data: toCommentDTO(existing, auth.email),
      },
      200,
    );
  },
);

commentsRouter.patch(
  '/comments/:commentId',
  readerAuth,
  zValidator('json', CommentUpdateSchema),
  async (c) => {
    const commentId = c.req.param('commentId');
    const auth = c.get('auth');

    const comment = await queryFirst<CommentRow>(c.env, `SELECT * FROM comments WHERE id = ?`, [
      commentId,
    ]);

    if (!comment) {
      throw new NotFoundError('Comment');
    }

    const mismatch = await assertBookAccess(
      c.env,
      auth,
      comment.book_id,
      c.executionCtx,
      getRequestTraceId(c),
    );
    if (mismatch) return mismatch.response;

    if (comment.user_email !== auth.email) {
      throw new ForbiddenError('Cannot edit others comments');
    }

    // Use session capabilities if bookId matches session, otherwise re-fetch
    let canComment = auth.capabilities?.canComment;
    if (auth.bookId !== comment.book_id) {
      const grant = await getGrantByBookAndSession(c.env, comment.book_id, auth.email);
      if (grant) {
        canComment = computeCapabilities(grant).canComment;
      } else {
        canComment = false;
      }
    }

    if (!canComment) {
      throw new ForbiddenError('Access denied');
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

    await logAudit(
      c.env,
      {
        entityType: 'comment',
        entityId: commentId,
        action: 'update',
        actorEmail: auth.email,
        payload: body,
      },
      c.executionCtx,
    );

    return c.json({
      ok: true,
      data: { id: commentId, ...body },
    });
  },
);

commentsRouter.delete('/comments/:commentId', readerAuth, async (c) => {
  const commentId = c.req.param('commentId');
  const auth = c.get('auth');

  const comment = await queryFirst<CommentRow>(c.env, `SELECT * FROM comments WHERE id = ?`, [
    commentId,
  ]);

  if (!comment) {
    throw new NotFoundError('Comment');
  }

  const mismatch = await assertBookAccess(
    c.env,
    auth,
    comment.book_id,
    c.executionCtx,
    getRequestTraceId(c),
  );
  if (mismatch) return mismatch.response;

  if (comment.user_email !== auth.email) {
    throw new ForbiddenError('Cannot delete others comments');
  }

  // Use session capabilities if bookId matches session, otherwise re-fetch
  let canComment = auth.capabilities?.canComment;
  if (auth.bookId !== comment.book_id) {
    const grant = await getGrantByBookAndSession(c.env, comment.book_id, auth.email);
    if (grant) {
      canComment = computeCapabilities(grant).canComment;
    } else {
      canComment = false;
    }
  }

  if (!canComment) {
    throw new ForbiddenError('Access denied');
  }

  await execute(c.env, `UPDATE comments SET status = 'deleted', updated_at = ? WHERE id = ?`, [
    new Date().toISOString(),
    commentId,
  ]);

  await logAudit(
    c.env,
    {
      entityType: 'comment',
      entityId: commentId,
      action: 'delete',
      actorEmail: auth.email,
    },
    c.executionCtx,
  );

  return c.json({ ok: true });
});

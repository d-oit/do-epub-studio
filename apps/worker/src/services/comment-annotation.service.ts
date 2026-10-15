import type { Env } from '../lib/env';
import { queryFirst, queryAll, execute } from '../db/client';
import { logAudit } from '../audit';
import { getGrantByBookAndSession, computeCapabilities } from '../auth/password';
import type { AuthContext } from '../auth/middleware';
import type { CommentCreate, CommentUpdate } from '@do-epub-studio/shared';
import { assertBookAccess } from '../lib/tenant-isolation';
import { createReplyNotification } from '../routes/notifications';
import { NotFoundError, ForbiddenError, AppError } from '../lib/http-errors';

export interface CommentRow {
  [key: string]: string | number | null | undefined;
  id: string;
  book_id: string;
  user_email: string;
  mutation_id?: string | null;
  chapter_ref: string | null;
  cfi_range?: string | null;
  selected_text: string | null;
  body: string;
  visibility: string;
  status: string;
  parent_comment_id: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommentDTO {
  id: string;
  displayName: string;
  isOwn: boolean;
  chapterRef: string | null;
  cfiRange: string | null;
  selectedText: string | null;
  body: string;
  visibility: string;
  status: string;
  parentCommentId: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export function toCommentDTO(row: CommentRow, viewerEmail: string): CommentDTO {
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

export interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

export class CommentAnnotationService {
  static async listComments(env: Env, bookId: string, viewerEmail: string) {
    const comments = await queryAll<CommentRow>(
      env,
      `SELECT * FROM comments WHERE book_id = ? AND status != 'deleted' AND (visibility = 'shared' OR user_email = ?) ORDER BY created_at ASC LIMIT 1000`,
      [bookId, viewerEmail],
    );

    return comments.map((cm) => toCommentDTO(cm, viewerEmail));
  }

  static async canCommentInBook(env: Env, auth: AuthContext, bookId: string): Promise<boolean> {
    if (auth.bookId === bookId) {
      return auth.capabilities?.canComment ?? false;
    }

    const grant = await getGrantByBookAndSession(env, bookId, auth.email);
    return grant ? computeCapabilities(grant).canComment : false;
  }

  static async createComment(options: {
    env: Env;
    auth: AuthContext;
    bookId: string;
    body: CommentCreate;
    executionCtx?: ExecutionContextLike;
  }): Promise<{ status: 200 | 201; data: CommentDTO }> {
    const { env, auth, bookId, body, executionCtx } = options;
    const authorEmail = auth.email;

    if (!(await CommentAnnotationService.canCommentInBook(env, auth, bookId))) {
      throw new ForbiddenError('Access denied');
    }

    if (body.parentCommentId) {
      const parent = await queryFirst<CommentRow>(env, `SELECT * FROM comments WHERE id = ?`, [
        body.parentCommentId,
      ]);
      if (!parent || parent.status === 'deleted' || parent.book_id !== bookId) {
        throw new AppError(
          'Parent comment not found or inaccessible',
          'INVALID_PARENT_COMMENT',
          400,
        );
      }
      if (parent.visibility !== 'shared' && parent.user_email !== authorEmail) {
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
      env,
      `INSERT INTO comments (id, book_id, user_email, mutation_id, chapter_ref, cfi_range, selected_text, body, visibility, status, parent_comment_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)
       ON CONFLICT(mutation_id) WHERE mutation_id IS NOT NULL DO NOTHING
       RETURNING *`,
      [
        id,
        bookId,
        authorEmail,
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
        env,
        {
          entityType: 'comment',
          entityId: inserted.id,
          action: 'create',
          actorEmail: authorEmail,
          payload: { bookId, visibility: body.visibility },
        },
        executionCtx,
      );

      if (body.parentCommentId) {
        executionCtx?.waitUntil(
          createReplyNotification(env, {
            bookId,
            commentId: inserted.id,
            parentCommentId: body.parentCommentId,
            replierEmail: authorEmail,
          }),
        );
      }

      return {
        status: 201,
        data: toCommentDTO(inserted, authorEmail),
      };
    }

    if (!mutationId) {
      throw new Error('Failed to insert comment');
    }

    const existing = await queryFirst<CommentRow>(
      env,
      `SELECT * FROM comments WHERE mutation_id = ?`,
      [mutationId],
    );

    if (!existing) {
      throw new Error('Failed to find conflicting comment');
    }

    if (existing.book_id !== bookId || existing.user_email !== authorEmail) {
      throw new ForbiddenError('Access denied');
    }

    return {
      status: 200,
      data: toCommentDTO(existing, authorEmail),
    };
  }

  static async updateComment(options: {
    env: Env;
    auth: AuthContext;
    commentId: string;
    body: CommentUpdate;
    executionCtx?: ExecutionContextLike;
    traceId?: string;
  }): Promise<{
    mismatch?: Response;
    data?: { id: string; body?: string; status?: string; visibility?: string };
  }> {
    const { env, auth, commentId, body, executionCtx, traceId } = options;

    const comment = await queryFirst<CommentRow>(env, `SELECT * FROM comments WHERE id = ?`, [
      commentId,
    ]);

    if (!comment) {
      throw new NotFoundError('Comment');
    }

    const mismatch = await assertBookAccess(env, auth, comment.book_id, executionCtx, traceId);
    if (mismatch) return { mismatch: mismatch.response };

    if (comment.user_email !== auth.email) {
      throw new ForbiddenError('Cannot edit others comments');
    }

    if (!(await CommentAnnotationService.canCommentInBook(env, auth, comment.book_id))) {
      throw new ForbiddenError('Access denied');
    }

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

    await execute(env, `UPDATE comments SET ${updates.join(', ')} WHERE id = ?`, args);

    await logAudit(
      env,
      {
        entityType: 'comment',
        entityId: commentId,
        action: 'update',
        actorEmail: auth.email,
        payload: body,
      },
      executionCtx,
    );

    return {
      data: { id: commentId, ...body },
    };
  }

  static async deleteComment(options: {
    env: Env;
    auth: AuthContext;
    commentId: string;
    executionCtx?: ExecutionContextLike;
    traceId?: string;
  }): Promise<{ mismatch?: Response; ok: boolean }> {
    const { env, auth, commentId, executionCtx, traceId } = options;

    const comment = await queryFirst<CommentRow>(env, `SELECT * FROM comments WHERE id = ?`, [
      commentId,
    ]);

    if (!comment) {
      throw new NotFoundError('Comment');
    }

    const mismatch = await assertBookAccess(env, auth, comment.book_id, executionCtx, traceId);
    if (mismatch) return { mismatch: mismatch.response, ok: false };

    if (comment.user_email !== auth.email) {
      throw new ForbiddenError('Cannot delete others comments');
    }

    if (!(await CommentAnnotationService.canCommentInBook(env, auth, comment.book_id))) {
      throw new ForbiddenError('Access denied');
    }

    await execute(env, `UPDATE comments SET status = 'deleted', updated_at = ? WHERE id = ?`, [
      new Date().toISOString(),
      commentId,
    ]);

    await logAudit(
      env,
      {
        entityType: 'comment',
        entityId: commentId,
        action: 'delete',
        actorEmail: auth.email,
      },
      executionCtx,
    );

    return { ok: true };
  }
}

import type { Env } from '../lib/env';
import { requireAuth } from '../auth/middleware';
import { queryFirst, queryAll, execute } from '../db/client';
import { jsonResponse } from '../lib/responses';
import { logAudit } from '../audit';

interface CommentRow {
  id: string;
  book_id: string;
  user_email: string;
  chapter_ref: string | null;
  cfi_range: string | null;
  selected_text: string | null;
  body: string;
  status: string;
  visibility: string;
  parent_comment_id: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export async function handleListComments(
  env: Env,
  request: Request,
  bookId: string,
): Promise<Response> {
  const auth = await requireAuth(env, request);

  if (!auth) {
    return jsonResponse(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
      401,
    );
  }

  const comments = (await queryAll(
    env,
    `SELECT * FROM comments WHERE book_id = ? AND status != 'deleted' ORDER BY created_at ASC`,
    [bookId],
  )) as unknown as CommentRow[];

  const threaded = buildCommentTree(comments);

  return jsonResponse({
    ok: true,
    data: threaded,
  });
}

export async function handleCreateComment(
  env: Env,
  request: Request,
  bookId: string,
  body: {
    chapterRef?: string;
    cfiRange?: string;
    selectedText?: string;
    body: string;
    visibility?: string;
    parentCommentId?: string;
  },
): Promise<Response> {
  const auth = await requireAuth(env, request);

  if (!auth) {
    return jsonResponse(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
      401,
    );
  }

  if (!auth.capabilities.canComment) {
    return jsonResponse({ ok: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await execute(
    env,
    `INSERT INTO comments (id, book_id, user_email, chapter_ref, cfi_range, selected_text, body, status, visibility, parent_comment_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)`,
    [
      id,
      bookId,
      auth.email,
      body.chapterRef ?? null,
      body.cfiRange ?? null,
      body.selectedText ?? null,
      body.body,
      body.visibility ?? 'shared',
      body.parentCommentId ?? null,
      now,
      now,
    ],
  );

  await logAudit(env, {
    entityType: 'comment',
    entityId: id,
    action: 'create',
    actorEmail: auth.email,
    payload: { bookId, chapterRef: body.chapterRef, hasParent: !!body.parentCommentId },
  });

  return jsonResponse(
    {
      ok: true,
      data: {
        id,
        userEmail: auth.email,
        chapterRef: body.chapterRef,
        cfiRange: body.cfiRange,
        selectedText: body.selectedText,
        body: body.body,
        status: 'open',
        visibility: body.visibility ?? 'shared',
        parentCommentId: body.parentCommentId,
        createdAt: now,
        updatedAt: now,
        resolvedAt: null,
        replies: [],
      },
    },
    201,
  );
}

export async function handleUpdateComment(
  env: Env,
  request: Request,
  commentId: string,
  body: { body?: string; status?: string; visibility?: string },
): Promise<Response> {
  const auth = await requireAuth(env, request);

  if (!auth) {
    return jsonResponse(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
      401,
    );
  }

  const comment = (await queryFirst(env, `SELECT * FROM comments WHERE id = ?`, [
    commentId,
  ])) as CommentRow | null;

  if (!comment) {
    return jsonResponse(
      { ok: false, error: { code: 'NOT_FOUND', message: 'Comment not found' } },
      404,
    );
  }

  if (comment.user_email !== auth.email) {
    return jsonResponse(
      { ok: false, error: { code: 'FORBIDDEN', message: 'Cannot edit others comments' } },
      403,
    );
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
    if (body.status === 'resolved') {
      updates.push('resolved_at = ?');
      args.push(now);
    }
  }
  if (body.visibility !== undefined) {
    updates.push('visibility = ?');
    args.push(body.visibility);
  }

  args.push(commentId);

  await execute(env, `UPDATE comments SET ${updates.join(', ')} WHERE id = ?`, args);

  await logAudit(env, {
    entityType: 'comment',
    entityId: commentId,
    action:
      body.status === 'resolved' ? 'resolve' : body.status === 'deleted' ? 'delete' : 'update',
    actorEmail: auth.email,
    payload: body,
  });

  return jsonResponse({
    ok: true,
    data: { id: commentId, ...body },
  });
}

function buildCommentTree(comments: CommentRow[]): CommentResponse[] {
  const commentMap = new Map<string, CommentResponse>();
  const roots: CommentResponse[] = [];

  for (const comment of comments) {
    const response: CommentResponse = {
      id: comment.id,
      userEmail: comment.user_email,
      chapterRef: comment.chapter_ref,
      cfiRange: comment.cfi_range,
      selectedText: comment.selected_text,
      body: comment.body,
      status: comment.status,
      visibility: comment.visibility,
      parentCommentId: comment.parent_comment_id,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      resolvedAt: comment.resolved_at,
      replies: [],
    };
    commentMap.set(comment.id, response);
  }

  for (const comment of comments) {
    const response = commentMap.get(comment.id)!;
    if (comment.parent_comment_id) {
      const parent = commentMap.get(comment.parent_comment_id);
      if (parent) {
        parent.replies!.push(response);
      } else {
        roots.push(response);
      }
    } else {
      roots.push(response);
    }
  }

  return roots;
}

interface CommentResponse {
  id: string;
  userEmail: string;
  chapterRef: string | null;
  cfiRange: string | null;
  selectedText: string | null;
  body: string;
  status: string;
  visibility: string;
  parentCommentId: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  replies?: CommentResponse[];
}

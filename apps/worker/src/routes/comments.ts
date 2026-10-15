import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../lib/env';
import type { AuthContext } from '../auth/middleware';
import { CommentCreateSchema, CommentUpdateSchema } from '@do-epub-studio/shared';
import { assertBookAccess } from '../lib/tenant-isolation';
import { getRequestTraceId } from '../lib/api-error';
import { readerAuth } from '../middleware/auth';
import { CommentAnnotationService } from '../services/comment-annotation.service';

export const commentsRouter = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

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

  const data = await CommentAnnotationService.listComments(c.env, bookId, auth.email);

  return c.json({
    ok: true,
    data,
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

    const body = c.req.valid('json');

    const result = await CommentAnnotationService.createComment({
      env: c.env,
      auth,
      bookId,
      body,
      executionCtx: c.executionCtx,
    });

    return c.json(
      {
        ok: true,
        data: result.data,
      },
      result.status,
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
    const body = c.req.valid('json');

    const result = await CommentAnnotationService.updateComment({
      env: c.env,
      auth,
      commentId,
      body,
      executionCtx: c.executionCtx,
      traceId: getRequestTraceId(c),
    });

    if (result.mismatch) return result.mismatch;

    return c.json({
      ok: true,
      data: result.data,
    });
  },
);

commentsRouter.delete('/comments/:commentId', readerAuth, async (c) => {
  const commentId = c.req.param('commentId');
  const auth = c.get('auth');

  const result = await CommentAnnotationService.deleteComment({
    env: c.env,
    auth,
    commentId,
    executionCtx: c.executionCtx,
    traceId: getRequestTraceId(c),
  });

  if (result.mismatch) return result.mismatch;

  return c.json({ ok: true });
});

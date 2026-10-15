import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  makePassThroughContext,
  makeAuthContext,
  mockQueryFirst,
  mockQueryAll,
  mockExecute,
  mockComputeCapabilities,
  mockGetGrantByBookAndSession,
} from '../fixtures';
import { CommentAnnotationService, toCommentDTO } from '../../services/comment-annotation.service';
import { NotFoundError, ForbiddenError, AppError } from '../../lib/http-errors';

vi.mock('../../lib/tenant-isolation', () => ({
  assertBookAccess: vi.fn().mockResolvedValue(null),
}));

import { assertBookAccess } from '../../lib/tenant-isolation';
const mockAssertBookAccess = assertBookAccess as ReturnType<typeof vi.fn>;

describe('CommentAnnotationService', () => {
  const env = makeEnv();
  const passCtx = makePassThroughContext();

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertBookAccess.mockResolvedValue(null);
  });

  describe('toCommentDTO', () => {
    it('masks display name and determines ownership', () => {
      const row = {
        id: 'c1',
        book_id: 'b1',
        user_email: 'author@example.com',
        body: 'hello',
        visibility: 'shared',
        status: 'open',
        parent_comment_id: null,
        chapter_ref: 'ch1',
        selected_text: 'quote',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        resolved_at: null,
      };

      const ownDto = toCommentDTO(row, 'author@example.com');
      expect(ownDto.displayName).toBe('au***');
      expect(ownDto.isOwn).toBe(true);

      const otherDto = toCommentDTO(row, 'other@example.com');
      expect(otherDto.isOwn).toBe(false);
    });
  });

  describe('listComments', () => {
    it('queries and returns formatted comments for a book', async () => {
      mockQueryAll.mockResolvedValue([
        {
          id: 'c1',
          book_id: 'b1',
          user_email: 'user@example.com',
          body: 'text',
          visibility: 'shared',
          status: 'open',
          parent_comment_id: null,
          chapter_ref: null,
          selected_text: null,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
          resolved_at: null,
        },
      ]);

      const result = await CommentAnnotationService.listComments(env, 'b1', 'user@example.com');
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('c1');
    });
  });

  describe('createComment', () => {
    it('denies cross-book comments when the target grant is read-only', async () => {
      mockGetGrantByBookAndSession.mockResolvedValue({ book_id: 'b2', comments_allowed: 0 });
      mockComputeCapabilities.mockReturnValue({ canComment: false });
      const auth = makeAuthContext();

      await expect(
        CommentAnnotationService.createComment({
          env,
          auth,
          bookId: 'b2',
          body: { body: 'text', visibility: 'shared' },
          executionCtx: passCtx,
        }),
      ).rejects.toThrow(ForbiddenError);

      expect(mockGetGrantByBookAndSession).toHaveBeenCalledWith(env, 'b2', auth.email);
      expect(mockQueryFirst).not.toHaveBeenCalled();
    });

    it('uses the target grant when cross-book comments are allowed', async () => {
      mockGetGrantByBookAndSession.mockResolvedValue({ book_id: 'b2', comments_allowed: 1 });
      mockComputeCapabilities.mockReturnValue({ canComment: true });
      mockQueryFirst.mockResolvedValue({
        id: 'new-c1',
        book_id: 'b2',
        user_email: 'user@example.com',
        body: 'new comment',
        visibility: 'shared',
        status: 'open',
        parent_comment_id: null,
        chapter_ref: null,
        selected_text: null,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        resolved_at: null,
      });

      const result = await CommentAnnotationService.createComment({
        env,
        auth: makeAuthContext(),
        bookId: 'b2',
        body: { body: 'new comment', visibility: 'shared' },
        executionCtx: passCtx,
      });

      expect(result.status).toBe(201);
      expect(result.data.id).toBe('new-c1');
      expect(mockGetGrantByBookAndSession).toHaveBeenCalledWith(env, 'b2', 'user@example.com');
    });

    it('throws ForbiddenError if user cannot comment in the session book', async () => {
      const auth = makeAuthContext({
        capabilities: {
          canRead: true,
          canComment: false,
          canHighlight: true,
          canBookmark: true,
          canDownloadOffline: true,
          canExportNotes: true,
          canManageAccess: false,
        },
      });

      await expect(
        CommentAnnotationService.createComment({
          env,
          auth,
          bookId: auth.bookId,
          body: { body: 'text', visibility: 'shared' },
          executionCtx: passCtx,
        }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('validates parent comment existence and book match', async () => {
      mockQueryFirst.mockResolvedValue(null);

      await expect(
        CommentAnnotationService.createComment({
          env,
          auth: makeAuthContext({ bookId: 'b1' }),
          bookId: 'b1',
          body: { body: 'reply', visibility: 'shared', parentCommentId: 'parent-123' },
          executionCtx: passCtx,
        }),
      ).rejects.toThrow(AppError);
    });

    it('inserts comment and returns 201 status', async () => {
      mockQueryFirst.mockResolvedValue({
        id: 'new-c1',
        book_id: 'b1',
        user_email: 'user@example.com',
        body: 'new comment',
        visibility: 'shared',
        status: 'open',
        parent_comment_id: null,
        chapter_ref: 'ch1',
        selected_text: 'text',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        resolved_at: null,
      });

      const res = await CommentAnnotationService.createComment({
        env,
        auth: makeAuthContext({ bookId: 'b1' }),
        bookId: 'b1',
        body: { body: 'new comment', visibility: 'shared' },
        executionCtx: passCtx,
      });

      expect(res.status).toBe(201);
      expect(res.data.id).toBe('new-c1');
    });
  });

  describe('updateComment', () => {
    it('throws NotFoundError if comment does not exist', async () => {
      mockQueryFirst.mockResolvedValue(null);

      await expect(
        CommentAnnotationService.updateComment({
          env,
          auth: makeAuthContext(),
          commentId: 'c1',
          body: { body: 'updated' },
          executionCtx: passCtx,
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('returns mismatch response if tenant assertion fails', async () => {
      mockQueryFirst.mockResolvedValue({ id: 'c1', book_id: 'b2', user_email: 'user@example.com' });
      mockAssertBookAccess.mockResolvedValue({
        ok: false,
        response: new Response(JSON.stringify({ error: 'mismatch' }), { status: 403 }),
      });

      const res = await CommentAnnotationService.updateComment({
        env,
        auth: makeAuthContext(),
        commentId: 'c1',
        body: { body: 'updated' },
        executionCtx: passCtx,
      });

      expect(res.mismatch).toBeDefined();
      expect(res.mismatch?.status).toBe(403);
    });

    it('throws ForbiddenError if trying to update someone else comment', async () => {
      mockQueryFirst.mockResolvedValue({
        id: 'c1',
        book_id: 'book-1',
        user_email: 'other@example.com',
      });

      await expect(
        CommentAnnotationService.updateComment({
          env,
          auth: makeAuthContext({ email: 'user@example.com', bookId: 'book-1' }),
          commentId: 'c1',
          body: { body: 'updated' },
          executionCtx: passCtx,
        }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('updates comment when user is author', async () => {
      mockQueryFirst.mockResolvedValue({
        id: 'c1',
        book_id: 'book-1',
        user_email: 'user@example.com',
      });
      mockExecute.mockResolvedValue({ rows: [] });

      const res = await CommentAnnotationService.updateComment({
        env,
        auth: makeAuthContext({ email: 'user@example.com', bookId: 'book-1' }),
        commentId: 'c1',
        body: { body: 'updated body' },
        executionCtx: passCtx,
      });

      expect(res.data?.body).toBe('updated body');
      expect(mockExecute).toHaveBeenCalled();
    });
  });

  describe('deleteComment', () => {
    it('throws ForbiddenError if trying to delete someone else comment', async () => {
      mockQueryFirst.mockResolvedValue({
        id: 'c1',
        book_id: 'book-1',
        user_email: 'other@example.com',
      });

      await expect(
        CommentAnnotationService.deleteComment({
          env,
          auth: makeAuthContext({ email: 'user@example.com', bookId: 'book-1' }),
          commentId: 'c1',
          executionCtx: passCtx,
        }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('soft deletes comment when user is author', async () => {
      mockQueryFirst.mockResolvedValue({
        id: 'c1',
        book_id: 'book-1',
        user_email: 'user@example.com',
      });
      mockExecute.mockResolvedValue({ rows: [] });

      const res = await CommentAnnotationService.deleteComment({
        env,
        auth: makeAuthContext({ email: 'user@example.com', bookId: 'book-1' }),
        commentId: 'c1',
        executionCtx: passCtx,
      });

      expect(res.ok).toBe(true);
      expect(mockExecute).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining("status = 'deleted'"),
        expect.anything(),
      );
    });
  });
});

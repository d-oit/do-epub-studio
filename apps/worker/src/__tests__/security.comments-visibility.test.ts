import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  makePassThroughContext,
  mockRequireAuth,
  mockQueryAll,
  makeAuthContext,
} from './fixtures';
import { app } from '../app';

interface CommentsResponse {
  ok: boolean;
  data: Array<{ id: string }>;
}

describe('Security: Comments Visibility', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/books/:bookId/comments', () => {
    it('User A should NOT see User B internal comments', async () => {
      const userAAuth = makeAuthContext({
        email: 'userA@example.com',
        bookId: 'book-1',
      });
      mockRequireAuth.mockResolvedValue(userAAuth);

      // Mock database returning both shared and internal (private) comments
      const sharedComment = {
        id: 'c1',
        book_id: 'book-1',
        user_email: 'userB@example.com',
        body: 'Shared comment',
        visibility: 'shared',
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        locator_json: null,
      };
      const internalCommentB = {
        id: 'c2',
        book_id: 'book-1',
        user_email: 'userB@example.com',
        body: 'Internal comment B',
        visibility: 'internal',
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        locator_json: null,
      };

      mockQueryAll.mockImplementation((_env, _sql, args) => {
        // args[0] is bookId, args[1] is userEmail
        if (args && args[1] === 'userA@example.com') {
          return Promise.resolve([sharedComment]);
        }
        return Promise.resolve([sharedComment, internalCommentB]);
      });

      const res = await app.fetch(
        new Request('http://localhost/api/books/book-1/comments', {
          headers: { Authorization: 'Bearer token-A' },
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as CommentsResponse;
      expect(body.ok).toBe(true);

      // Verification: User A should only see sharedComment
      const commentIds = body.data.map((c: { id: string }) => c.id);
      expect(commentIds).toContain('c1');
      expect(commentIds).not.toContain('c2');
    });

    it('User A should see their own internal comments', async () => {
      const userAAuth = makeAuthContext({
        email: 'userA@example.com',
        bookId: 'book-1',
      });
      mockRequireAuth.mockResolvedValue(userAAuth);

      const internalCommentA = {
        id: 'c3',
        book_id: 'book-1',
        user_email: 'userA@example.com',
        body: 'Internal comment A',
        visibility: 'internal',
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        locator_json: null,
      };

      // Mock query result
      mockQueryAll.mockImplementation((_env, _sql, args) => {
        if (args && args.includes('userA@example.com')) {
           return Promise.resolve([internalCommentA]);
        }
        return Promise.resolve([]);
      });

      const res = await app.fetch(
        new Request('http://localhost/api/books/book-1/comments', {
          headers: { Authorization: 'Bearer token-A' },
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as CommentsResponse;
      expect(body.data.map((c: { id: string }) => c.id)).toContain('c3');
    });
  });
});

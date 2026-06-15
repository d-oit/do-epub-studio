import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  makePassThroughContext,
  mockRequireAuth,
  mockQueryAll,
  mockExecute,
  mockGetGrantByBookAndSession,
  mockComputeCapabilities,
} from './fixtures';
import { app } from '../app';

describe('Tenant Isolation: Comments', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/books/:bookId/comments', () => {
    it('returns 403 when authenticated for Book A but requesting Book B', async () => {
      // User has a valid session for book-A
      mockRequireAuth.mockResolvedValue({
        sessionId: 'session-A',
        bookId: 'book-A',
        email: 'user@example.com',
        capabilities: { canRead: true, canComment: true },
      } as any);

      // In the current vulnerable state, it will just query book-B comments and return 200
      mockQueryAll.mockResolvedValue([]);

      const res = await app.fetch(
        new Request('http://localhost/api/books/book-B/comments', {
          headers: { Authorization: 'Bearer valid-token-for-A' },
        }),
        env,
        makePassThroughContext() as unknown as ExecutionContext,
      );

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/books/:bookId/comments', () => {
    it('returns 403 when authenticated for Book A but posting to Book B', async () => {
      // User has a valid session for book-A
      mockRequireAuth.mockResolvedValue({
        sessionId: 'session-A',
        bookId: 'book-A',
        email: 'user@example.com',
        capabilities: { canRead: true, canComment: true },
      } as any);

      const res = await app.fetch(
        new Request('http://localhost/api/books/book-B/comments', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer valid-token-for-A',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            body: 'trying to post on book B',
            visibility: 'shared',
          }),
        }),
        env,
        makePassThroughContext() as unknown as ExecutionContext,
      );

      expect(res.status).toBe(403);
    });
  });

  describe('Legitimate Access', () => {
    it('allows GET when authenticated for the same book', async () => {
      mockRequireAuth.mockResolvedValue({
        sessionId: 'session-A',
        bookId: 'book-A',
        email: 'user@example.com',
        capabilities: { canRead: true, canComment: true },
      } as any);

      mockGetGrantByBookAndSession.mockResolvedValue({
        id: 'grant-A',
        book_id: 'book-A',
        email: 'user@example.com',
        allowed: 1,
        comments_allowed: 1,
      });

      mockQueryAll.mockResolvedValue([]);

      const res = await app.fetch(
        new Request('http://localhost/api/books/book-A/comments', {
          headers: { Authorization: 'Bearer valid-token-for-A' },
        }),
        env,
        makePassThroughContext() as unknown as ExecutionContext,
      );

      expect(res.status).toBe(200);
    });

    it('allows POST when authenticated for the same book', async () => {
      mockRequireAuth.mockResolvedValue({
        sessionId: 'session-A',
        bookId: 'book-A',
        email: 'user@example.com',
        capabilities: { canRead: true, canComment: true },
      } as any);

      mockGetGrantByBookAndSession.mockResolvedValue({
        id: 'grant-A',
        book_id: 'book-A',
        email: 'user@example.com',
        allowed: 1,
        comments_allowed: 1,
      });
      mockComputeCapabilities.mockReturnValue({
        canRead: true,
        canComment: true,
      });

      mockExecute.mockResolvedValue({} as any);

      const res = await app.fetch(
        new Request('http://localhost/api/books/book-A/comments', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer valid-token-for-A',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            body: 'legit comment',
            visibility: 'shared',
          }),
        }),
        env,
        makePassThroughContext() as unknown as ExecutionContext,
      );

      expect(res.status).toBe(201);
    });
  });
});

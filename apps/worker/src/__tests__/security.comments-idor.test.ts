import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  makePassThroughContext,
  mockRequireAuth,
  mockQueryFirst,
} from './fixtures';
import { app } from '../app';
import * as tenantIsolation from '../lib/tenant-isolation';

vi.mock('../lib/tenant-isolation', async (importOriginal) => {
  const actual = await importOriginal<typeof tenantIsolation>();
  return {
    ...actual,
    assertBookAccess: vi.fn(),
  };
});

const mockAssertBookAccess = tenantIsolation.assertBookAccess as ReturnType<typeof vi.fn>;

describe('Security: Comments IDOR Reproduction', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no mismatch
    mockAssertBookAccess.mockResolvedValue(null);
  });

  it('PATCH /api/comments/:id should fail if user does not have access to the book (REPRODUCTION)', async () => {
    // User is authenticated for Book A
    mockRequireAuth.mockResolvedValue({
      email: 'user@example.com',
      bookId: 'book-A',
      sessionId: 'session-A',
      capabilities: { canComment: true },
    });

    // But the comment they want to edit belongs to Book B
    mockQueryFirst.mockResolvedValue({
      id: 'comment-B',
      book_id: 'book-B',
      user_email: 'user@example.com',
      body: 'old body',
    });

    // Simulate assertBookAccess returning a 403 because user has no grant for Book B
    mockAssertBookAccess.mockImplementation((_env, _auth, bookId) => {
      if (bookId === 'book-B') {
        return Promise.resolve({
          ok: false,
          response: Response.json({ ok: false, error: { code: 'BOOK_SESSION_MISMATCH' } }, { status: 403 }),
        });
      }
      return Promise.resolve(null);
    });

    const res = await app.fetch(
      new Request('http://localhost/api/comments/comment-B', {
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer valid-token-for-A',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body: 'new body' }),
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(403);
  });

  it('DELETE /api/comments/:id should fail if user does not have access to the book (REPRODUCTION)', async () => {
    mockRequireAuth.mockResolvedValue({
      email: 'user@example.com',
      bookId: 'book-A',
      sessionId: 'session-A',
    });

    mockQueryFirst.mockResolvedValue({
      id: 'comment-B',
      book_id: 'book-B',
      user_email: 'user@example.com',
    });

    mockAssertBookAccess.mockImplementation((_env, _auth, bookId) => {
      if (bookId === 'book-B') {
        return Promise.resolve({
          ok: false,
          response: Response.json({ ok: false, error: { code: 'BOOK_SESSION_MISMATCH' } }, { status: 403 }),
        });
      }
      return Promise.resolve(null);
    });

    const res = await app.fetch(
      new Request('http://localhost/api/comments/comment-B', {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer valid-token-for-A' },
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(403);
  });

  describe('Reply Parent Comment IDOR Validation', () => {
    beforeEach(() => {
      mockRequireAuth.mockResolvedValue({
        email: 'user@example.com',
        bookId: 'book-A',
        sessionId: 'session-A',
        capabilities: { canComment: true },
      });
    });

    it('POST should fail if parent comment does not exist', async () => {
      mockQueryFirst.mockResolvedValue(null);

      const res = await app.fetch(
        new Request('http://localhost/api/books/book-A/comments', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            body: 'reply body',
            parentCommentId: '00000000-0000-0000-0000-000000000000',
          }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(400);
      const data = await res.json() as any;
      expect(data.error.code).toBe('INVALID_PARENT_COMMENT');
    });

    it('POST should fail if parent comment belongs to a different book', async () => {
      mockQueryFirst.mockResolvedValue({
        id: '22222222-2222-4222-a222-222222222222',
        book_id: 'book-B',
        user_email: 'other@example.com',
        status: 'open',
        visibility: 'shared',
      });

      const res = await app.fetch(
        new Request('http://localhost/api/books/book-A/comments', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            body: 'reply body',
            parentCommentId: '22222222-2222-4222-a222-222222222222',
          }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(400);
      const data = await res.json() as any;
      expect(data.error.code).toBe('INVALID_PARENT_COMMENT');
    });

    it('POST should fail if parent comment is deleted', async () => {
      mockQueryFirst.mockResolvedValue({
        id: '33333333-3333-4333-a333-333333333333',
        book_id: 'book-A',
        user_email: 'other@example.com',
        status: 'deleted',
        visibility: 'shared',
      });

      const res = await app.fetch(
        new Request('http://localhost/api/books/book-A/comments', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            body: 'reply body',
            parentCommentId: '33333333-3333-4333-a333-333333333333',
          }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(400);
      const data = await res.json() as any;
      expect(data.error.code).toBe('INVALID_PARENT_COMMENT');
    });

    it('POST should fail if parent comment is internal and belongs to another user', async () => {
      mockQueryFirst.mockResolvedValue({
        id: '44444444-4444-4444-a444-444444444444',
        book_id: 'book-A',
        user_email: 'other@example.com',
        status: 'open',
        visibility: 'internal',
      });

      const res = await app.fetch(
        new Request('http://localhost/api/books/book-A/comments', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            body: 'reply body',
            parentCommentId: '44444444-4444-4444-a444-444444444444',
          }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(403);
      const data = await res.json() as any;
      expect(data.error.code).toBe('INVALID_PARENT_COMMENT');
    });

    it('POST should succeed if parent comment is internal but owned by the same user', async () => {
      mockQueryFirst.mockResolvedValue({
        id: '55555555-5555-4555-a555-555555555555',
        book_id: 'book-A',
        user_email: 'user@example.com',
        status: 'open',
        visibility: 'internal',
      });

      const res = await app.fetch(
        new Request('http://localhost/api/books/book-A/comments', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            body: 'reply body',
            parentCommentId: '55555555-5555-4555-a555-555555555555',
          }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(201);
    });
  });
});

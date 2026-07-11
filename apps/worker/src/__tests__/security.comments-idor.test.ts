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
});

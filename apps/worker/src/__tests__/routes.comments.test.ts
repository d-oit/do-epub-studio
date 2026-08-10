import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  makeAuthContext,
  makePassThroughContext,
  mockQueryFirst,
  mockQueryAll,
  mockExecute,
  mockRequireAuth,
  mockGetGrantByBookAndSession,
  mockComputeCapabilities,
} from './fixtures';
import { app } from '../app';
import { assertBookAccess } from '../lib/tenant-isolation';

vi.mock('../lib/tenant-isolation', () => ({
  parseLocatorRow: vi.fn(),
  assertBookAccess: vi.fn(),
}));

const mockAssertBookAccess = assertBookAccess as ReturnType<typeof vi.fn>;

describe('Comments Routes', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertBookAccess.mockResolvedValue(null);
  });

  describe('GET /api/books/:bookId/comments', () => {
    it('returns 401 when unauthenticated', async () => {
      mockRequireAuth.mockResolvedValue(null);
      const res = await app.fetch(new Request('http://localhost/api/books/book-1/comments'), env, makePassThroughContext());
      expect(res.status).toBe(401);
    });

    it('returns list of comments when authenticated', async () => {
      mockRequireAuth.mockResolvedValue(makeAuthContext());
      mockGetGrantByBookAndSession.mockResolvedValue({ id: 'grant-1' });

      mockQueryAll.mockResolvedValue([
        { id: '1', body: 'cool', user_email: 'other@ex.com', status: 'open', visibility: 'shared', created_at: 'now', updated_at: 'now' }
      ]);

      const res = await app.fetch(new Request('http://localhost/api/books/book-1/comments', {
        headers: { 'Authorization': 'Bearer valid' }
      }), env, makePassThroughContext());
      expect(res.status).toBe(200);
      const body: Record<string, unknown> = await res.json();
      expect(body.data).toHaveLength(1);
      // B1 (GOAP-224 W1.3): shared-comment payload must mask author email —
      // displayName is a truncated identifier and no userEmail key leaks.
      const data = body.data as Array<Record<string, unknown>>;
      const comment = data[0];
      expect(comment?.displayName).toBe('ot***');
      expect(comment.isOwn).toBe(false);
      expect('userEmail' in comment).toBe(false);
      expect('user_email' in comment).toBe(false);
    });
  });

  describe('POST /api/books/:bookId/comments', () => {
    it('creates comment and returns success', async () => {
      mockRequireAuth.mockResolvedValue({
        email: 'user@example.com',
        bookId: 'book-1',
        capabilities: { canComment: true },
      });
      mockGetGrantByBookAndSession.mockResolvedValue({ id: 'grant-1' });
      mockComputeCapabilities.mockReturnValue({ canComment: true });
      mockExecute.mockResolvedValue({ rows: [] });

      const res = await app.fetch(new Request('http://localhost/api/books/book-1/comments', {
        method: 'POST',
        body: JSON.stringify({
          body: 'new comment',
          visibility: 'shared',
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid'
        },
      }), env, makePassThroughContext());

      expect(res.status).toBe(201);
    });
  });

  describe('PATCH /api/comments/:commentId', () => {
    it('updates comment when owned by user', async () => {
      mockRequireAuth.mockResolvedValue({ email: 'user@example.com' });

      mockQueryFirst.mockResolvedValue({ user_email: 'user@example.com' });
      mockExecute.mockResolvedValue({ rows: [] });

      const res = await app.fetch(new Request('http://localhost/api/comments/1', {
        method: 'PATCH',
        body: JSON.stringify({ body: 'updated body' }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid'
        },
      }), env, makePassThroughContext());

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/comments/:commentId', () => {
    it('deletes comment when owned by user', async () => {
      mockRequireAuth.mockResolvedValue({ email: 'user@example.com' });

      mockQueryFirst.mockResolvedValue({ user_email: 'user@example.com' });
      mockExecute.mockResolvedValue({ rows: [] });

      const res = await app.fetch(new Request('http://localhost/api/comments/1', {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer valid' },
      }), env, makePassThroughContext());

      expect(res.status).toBe(200);
    });
  });
});

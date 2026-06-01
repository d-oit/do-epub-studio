import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  makePassThroughContext,
  mockQueryFirst,
  mockQueryAll,
  mockExecute,
  mockRequireAuth,
} from './fixtures';
import { app } from '../app';

describe('Comments Routes', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/books/:bookId/comments', () => {
    it('returns 401 when unauthenticated', async () => {
      mockRequireAuth.mockResolvedValue(null);
      const res = await app.fetch(new Request('http://localhost/api/books/book-1/comments'), env, makePassThroughContext() as unknown as ExecutionContext);
      expect(res.status).toBe(401);
    });

    it('returns list of comments when authenticated', async () => {
      mockRequireAuth.mockResolvedValue({ email: 'user@example.com' } as any);

      mockQueryAll.mockResolvedValue([
        { id: '1', body: 'cool', user_email: 'other@ex.com', status: 'open', visibility: 'shared', created_at: 'now', updated_at: 'now' }
      ]);

      const res = await app.fetch(new Request('http://localhost/api/books/book-1/comments', {
        headers: { 'Authorization': 'Bearer valid' }
      }), env, makePassThroughContext() as unknown as ExecutionContext);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data).toHaveLength(1);
    });
  });

  describe('POST /api/books/:bookId/comments', () => {
    it('creates comment and returns success', async () => {
      mockRequireAuth.mockResolvedValue({
        email: 'user@example.com',
        capabilities: { canComment: true },
      } as any);
      mockExecute.mockResolvedValue({} as any);

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
      }), env, makePassThroughContext() as unknown as ExecutionContext);

      expect(res.status).toBe(201);
    });
  });

  describe('PATCH /api/comments/:commentId', () => {
    it('updates comment when owned by user', async () => {
      mockRequireAuth.mockResolvedValue({ email: 'user@example.com' } as any);

      mockQueryFirst.mockResolvedValue({ user_email: 'user@example.com' });
      mockExecute.mockResolvedValue({} as any);

      const res = await app.fetch(new Request('http://localhost/api/comments/1', {
        method: 'PATCH',
        body: JSON.stringify({ body: 'updated body' }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid'
        },
      }), env, makePassThroughContext() as unknown as ExecutionContext);

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/comments/:commentId', () => {
    it('deletes comment when owned by user', async () => {
      mockRequireAuth.mockResolvedValue({ email: 'user@example.com' } as any);

      mockQueryFirst.mockResolvedValue({ user_email: 'user@example.com' });
      mockExecute.mockResolvedValue({} as any);

      const res = await app.fetch(new Request('http://localhost/api/comments/1', {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer valid' },
      }), env, makePassThroughContext() as unknown as ExecutionContext);

      expect(res.status).toBe(200);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  makePassThroughContext,
  mockValidateGrant,
  mockCreateSession,
  mockRevokeSession,
  mockValidateSessionMod,
  mockGetGrantByBookAndSession,
  mockGetGrantsBySession,
} from './fixtures';
import { app } from '../app';

describe('Access Routes', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/access/request', () => {
    const validPayload = {
      bookSlug: 'test-book',
      email: 'reader@example.com',
      password: 'secret123',
    };

    it('returns validation error for missing fields', async () => {
      const res = await app.fetch(new Request('http://localhost/api/access/request', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' }
      }), env, makePassThroughContext() as unknown as ExecutionContext);
      expect(res.status).toBe(400);
    });

    it('returns 401 when grant validation fails', async () => {
      mockValidateGrant.mockResolvedValue({ valid: false, error: 'Access denied' });

      const res = await app.fetch(new Request('http://localhost/api/access/request', {
        method: 'POST',
        body: JSON.stringify(validPayload),
        headers: { 'Content-Type': 'application/json' }
      }), env, makePassThroughContext() as unknown as ExecutionContext);
      expect(res.status).toBe(401);
      const body = await res.json() as any;
      expect(body.error.code).toBe('ACCESS_DENIED');
    });

    it('creates session and returns token on valid grant', async () => {
      mockValidateGrant.mockResolvedValue({
        valid: true,
        grant: {
          id: 'grant-1',
          book_id: 'book-1',
          email: 'user@example.com',
          password_hash: null,
          mode: 'private',
          allowed: 1,
          comments_allowed: 0,
          offline_allowed: 0,
          expires_at: null,
          revoked_at: null,
        },
        book: {
          id: 'book-1',
          slug: 'test-book',
          title: 'Test Book',
          author_name: null,
          visibility: 'private',
          cover_image_url: null,
        },
      });
      mockCreateSession.mockResolvedValue({ token: 'new-session-token', expiresAt: '2030-01-01T00:00:00.000Z' });

      const res = await app.fetch(new Request('http://localhost/api/access/request', {
        method: 'POST',
        body: JSON.stringify(validPayload),
        headers: { 'Content-Type': 'application/json' }
      }), env, makePassThroughContext() as unknown as ExecutionContext);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.ok).toBe(true);
      expect(body.data.sessionToken).toBe('new-session-token');
    });
  });

  describe('POST /api/access/logout', () => {
    it('revokes session and returns ok', async () => {
      mockRevokeSession.mockResolvedValue(undefined);
      const res = await app.fetch(new Request('http://localhost/api/access/logout', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer session-token' }
      }), env, makePassThroughContext() as unknown as ExecutionContext);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.ok).toBe(true);
    });
  });

  describe('POST /api/access/refresh', () => {
    it('returns 401 for invalid session', async () => {
      mockValidateSessionMod.mockResolvedValue({ valid: false });
      const res = await app.fetch(new Request('http://localhost/api/access/refresh', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer bad-token' }
      }), env, makePassThroughContext() as unknown as ExecutionContext);
      expect(res.status).toBe(401);
    });

    it('returns new session token for valid session and rotates token', async () => {
      mockValidateSessionMod.mockResolvedValue({
        valid: true,
        session: { email: 'user@example.com' },
        bookId: 'book-1',
      } as any);
      mockGetGrantByBookAndSession.mockResolvedValue({ revoked_at: null, expires_at: null } as any);
      mockCreateSession.mockResolvedValue({ token: 'new-token', expiresAt: '2030-01-01T00:00:00.000Z' });
      mockRevokeSession.mockResolvedValue(undefined);

      const res = await app.fetch(new Request('http://localhost/api/access/refresh', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer good-token' }
      }), env, makePassThroughContext() as unknown as ExecutionContext);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.ok).toBe(true);
      expect(body.data.sessionToken).toBe('new-token');
    });
  });

  describe('GET /api/access/validate', () => {
    it('returns 401 for invalid session', async () => {
      mockValidateSessionMod.mockResolvedValue({ valid: false });
      const res = await app.fetch(new Request('http://localhost/api/access/validate?bookId=book-1', {
        headers: { 'Authorization': 'Bearer bad-token' }
      }), env, makePassThroughContext() as unknown as ExecutionContext);
      expect(res.status).toBe(401);
    });

    it('returns valid when grant is active', async () => {
      mockValidateSessionMod.mockResolvedValue({
        valid: true,
        session: { email: 'user@example.com' },
        bookId: 'book-1',
      } as any);
      mockGetGrantByBookAndSession.mockResolvedValue({ revoked_at: null, id: 'grant-1', comments_allowed: 1, offline_allowed: 0 } as any);

      const res = await app.fetch(new Request('http://localhost/api/access/validate?bookId=book-1', {
        headers: { 'Authorization': 'Bearer good-token' }
      }), env, makePassThroughContext() as unknown as ExecutionContext);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.ok).toBe(true);
      expect(body.data.valid).toBe(true);
    });
  });

  describe('GET /api/access/validate-all', () => {
    it('returns valid grant IDs and revoked book IDs', async () => {
      mockValidateSessionMod.mockResolvedValue({
        valid: true,
        session: { email: 'user@example.com' },
        bookId: 'book-1',
      } as any);
      mockGetGrantsBySession.mockResolvedValue([
        { id: 'grant-1', book_id: 'book-1', revoked_at: null },
        { id: 'grant-2', book_id: 'book-2', revoked_at: new Date().toISOString() },
      ] as any);

      const res = await app.fetch(new Request('http://localhost/api/access/validate-all', {
        headers: { 'Authorization': 'Bearer good-token' }
      }), env, makePassThroughContext() as unknown as ExecutionContext);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.ok).toBe(true);
      expect(body.data.grantIds).toContain('grant-1');
      expect(body.data.revokedBookIds).toContain('book-2');
    });
  });
});

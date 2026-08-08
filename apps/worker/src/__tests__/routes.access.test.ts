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

// ---------------------------------------------------------------------------
// Mock rate-limit-client so individual tests can control lockout / failure
// behaviour without wiring up the full Durable Object.
// Default: every call returns allowed=true.
// ---------------------------------------------------------------------------
vi.mock('../lib/rate-limit-client', () => ({
  checkRateLimitDO: vi.fn().mockResolvedValue({ allowed: true, remaining: 4, resetAt: Date.now() + 900_000 }),
  deleteRateLimitKey: vi.fn().mockResolvedValue(undefined),
}));

import { checkRateLimitDO, deleteRateLimitKey } from '../lib/rate-limit-client';
const mockCheckRateLimitDO = checkRateLimitDO as ReturnType<typeof vi.fn>;
const mockDeleteRateLimitKey = deleteRateLimitKey as ReturnType<typeof vi.fn>;

describe('Access Routes', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();
    // Restore rate-limit default: all checks pass
    mockCheckRateLimitDO.mockResolvedValue({ allowed: true, remaining: 4, resetAt: Date.now() + 900_000 });
    mockDeleteRateLimitKey.mockResolvedValue(undefined);
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
      }), env, makePassThroughContext());
      expect(res.status).toBe(400);
    });

    it('returns 401 when grant validation fails', async () => {
      mockValidateGrant.mockResolvedValue({ valid: false, error: 'Access denied' });

      const res = await app.fetch(new Request('http://localhost/api/access/request', {
        method: 'POST',
        body: JSON.stringify(validPayload),
        headers: { 'Content-Type': 'application/json' }
      }), env, makePassThroughContext());
      expect(res.status).toBe(401);
      const body: { ok: boolean; data: Record<string, unknown>; error: { code: string; message?: string } } = await res.json();
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
      }), env, makePassThroughContext());
      expect(res.status).toBe(200);
      const body: { ok: boolean; data: Record<string, unknown>; error: { code: string; message?: string } } = await res.json();
      expect(body.ok).toBe(true);
      expect(body.data.sessionToken).toBe('new-session-token');
    });

    it('5th failed attempt returns 401 (does NOT reveal lockout)', async () => {
      // Call order:
      // 1. IP rate-limit middleware (ip:auth, unknown)
      // 2. auth_access per-email throttle
      // 3. auth_lockout check (not yet locked)
      // 4. auth_failures counter (5th failure — blocked)
      // 5. auth_lockout write (trigger lockout entry)
      mockCheckRateLimitDO
        .mockResolvedValueOnce({ allowed: true, remaining: 9, resetAt: Date.now() + 60_000 })   // ip middleware
        .mockResolvedValueOnce({ allowed: true, remaining: 0, resetAt: Date.now() + 60_000 })   // auth_access
        .mockResolvedValueOnce({ allowed: true, remaining: 0, resetAt: Date.now() + 900_000 })  // auth_lockout check
        .mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 900_000 }) // auth_failures (5th)
        .mockResolvedValueOnce({ allowed: true, remaining: 0, resetAt: Date.now() + 900_000 }); // auth_lockout write

      mockValidateGrant.mockResolvedValue({ valid: false, error: 'bad password' });

      const res = await app.fetch(new Request('http://localhost/api/access/request', {
        method: 'POST',
        body: JSON.stringify(validPayload),
        headers: { 'Content-Type': 'application/json' }
      }), env, makePassThroughContext());

      expect(res.status).toBe(401);
      const body: { ok: boolean; data: Record<string, unknown>; error: { code: string; message?: string } } = await res.json();
      expect(body.error.code).toBe('ACCESS_DENIED');
    });

    it('6th attempt (after lockout triggered) returns 423 with Retry-After header', async () => {
      const resetAt = Date.now() + 900_000;
      // Call order: IP middleware, auth_access, auth_lockout (blocked)
      mockCheckRateLimitDO
        .mockResolvedValueOnce({ allowed: true, remaining: 9, resetAt: Date.now() + 60_000 }) // ip middleware
        .mockResolvedValueOnce({ allowed: true, remaining: 4, resetAt: Date.now() + 60_000 }) // auth_access
        .mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt });                    // auth_lockout blocked

      const res = await app.fetch(new Request('http://localhost/api/access/request', {
        method: 'POST',
        body: JSON.stringify(validPayload),
        headers: { 'Content-Type': 'application/json' }
      }), env, makePassThroughContext());

      expect(res.status).toBe(423);
      const body: { ok: boolean; data: Record<string, unknown>; error: { code: string; message?: string } } = await res.json();
      expect(body.error.code).toBe('ACCOUNT_LOCKED');
      const retryAfter = res.headers.get('Retry-After');
      expect(retryAfter).not.toBeNull();
      expect(Number(retryAfter)).toBeGreaterThan(0);
    });

    it('successful login clears failure counter and lockout via deleteRateLimitKey', async () => {
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
      mockCreateSession.mockResolvedValue({ token: 'tok', expiresAt: '2030-01-01T00:00:00.000Z' });

      const res = await app.fetch(new Request('http://localhost/api/access/request', {
        method: 'POST',
        body: JSON.stringify(validPayload),
        headers: { 'Content-Type': 'application/json' }
      }), env, makePassThroughContext());

      expect(res.status).toBe(200);
      // deleteRateLimitKey must be called for both auth_failures and auth_lockout
      expect(mockDeleteRateLimitKey).toHaveBeenCalledWith(expect.anything(), 'auth_failures', validPayload.email.toLowerCase());
      expect(mockDeleteRateLimitKey).toHaveBeenCalledWith(expect.anything(), 'auth_lockout', validPayload.email.toLowerCase());
    });
  });

  describe('POST /api/access/logout', () => {
    it('revokes session and returns ok', async () => {
      mockRevokeSession.mockResolvedValue(undefined);
      const res = await app.fetch(new Request('http://localhost/api/access/logout', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer session-token' }
      }), env, makePassThroughContext());
      expect(res.status).toBe(200);
      const body: { ok: boolean; data: Record<string, unknown>; error: { code: string; message?: string } } = await res.json();
      expect(body.ok).toBe(true);
    });
  });

  describe('POST /api/access/refresh', () => {
    it('returns 401 for invalid session', async () => {
      mockValidateSessionMod.mockResolvedValue({ valid: false });
      const res = await app.fetch(new Request('http://localhost/api/access/refresh', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer bad-token' }
      }), env, makePassThroughContext());
      expect(res.status).toBe(401);
    });

    it('returns new session token for valid session and rotates token', async () => {
      mockValidateSessionMod.mockResolvedValue({
        valid: true,
        session: { email: 'user@example.com' },
        bookId: 'book-1',
      });
      mockGetGrantByBookAndSession.mockResolvedValue({ revoked_at: null, expires_at: null });
      mockCreateSession.mockResolvedValue({ token: 'new-token', expiresAt: '2030-01-01T00:00:00.000Z' });
      mockRevokeSession.mockResolvedValue(undefined);

      const res = await app.fetch(new Request('http://localhost/api/access/refresh', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer good-token' }
      }), env, makePassThroughContext());
      expect(res.status).toBe(200);
      const body: { ok: boolean; data: Record<string, unknown>; error: { code: string; message?: string } } = await res.json();
      expect(body.ok).toBe(true);
      expect(body.data.sessionToken).toBe('new-token');
    });
  });

  describe('GET /api/access/validate', () => {
    it('returns 401 for invalid session', async () => {
      mockValidateSessionMod.mockResolvedValue({ valid: false });
      const res = await app.fetch(new Request('http://localhost/api/access/validate?bookId=book-1', {
        headers: { 'Authorization': 'Bearer bad-token' }
      }), env, makePassThroughContext());
      expect(res.status).toBe(401);
    });

    it('returns valid when grant is active', async () => {
      mockValidateSessionMod.mockResolvedValue({
        valid: true,
        session: { email: 'user@example.com' },
        bookId: 'book-1',
      });
      mockGetGrantByBookAndSession.mockResolvedValue({ revoked_at: null, id: 'grant-1', comments_allowed: 1, offline_allowed: 0 });

      const res = await app.fetch(new Request('http://localhost/api/access/validate?bookId=book-1', {
        headers: { 'Authorization': 'Bearer good-token' }
      }), env, makePassThroughContext());
      expect(res.status).toBe(200);
      const body: { ok: boolean; data: Record<string, unknown>; error: { code: string; message?: string } } = await res.json();
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
      });
      mockGetGrantsBySession.mockResolvedValue([
        { id: 'grant-1', book_id: 'book-1', revoked_at: null },
        { id: 'grant-2', book_id: 'book-2', revoked_at: new Date().toISOString() },
      ]);

      const res = await app.fetch(new Request('http://localhost/api/access/validate-all', {
        headers: { 'Authorization': 'Bearer good-token' }
      }), env, makePassThroughContext());
      expect(res.status).toBe(200);
      const body: { ok: boolean; data: Record<string, unknown>; error: { code: string; message?: string } } = await res.json();
      expect(body.ok).toBe(true);
      expect(body.data.grantIds).toContain('grant-1');
      expect(body.data.revokedBookIds).toContain('book-2');
    });
  });
});

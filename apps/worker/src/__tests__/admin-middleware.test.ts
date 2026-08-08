import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  requireAdminAuth,
  createAdminSession,
  revokeAdminSession,
  generateAdminToken,
} from '../auth/admin-middleware';
import * as db from '../db/client';
import * as password from '../auth/password';
import type { Env } from '../lib/env';

vi.mock('../db/client', () => ({
  queryFirst: vi.fn(),
  execute: vi.fn(),
}));

vi.mock('../auth/password', () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock('../lib/observability', () => ({
  createRequestContext: vi.fn(() => ({})),
}));

describe('admin-middleware', () => {
  const env = {} as Env;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requireAdminAuth', () => {
    it('returns 401 when no Authorization header', async () => {
      const request = new Request('http://localhost/api/admin');
      const result = await requireAdminAuth(env, request);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(401);
    });

    it('returns 401 when Authorization header is not Bearer', async () => {
      const request = new Request('http://localhost/api/admin', {
        headers: { Authorization: 'Basic abc123' },
      });
      const result = await requireAdminAuth(env, request);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(401);
    });

    it('returns 401 when session is not found', async () => {
      vi.mocked(db.queryFirst).mockResolvedValue(null);
      const request = new Request('http://localhost/api/admin', {
        headers: { Authorization: 'Bearer test-token' },
      });
      const result = await requireAdminAuth(env, request);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(401);
    });

    it('returns 401 when session is expired', async () => {
      vi.mocked(db.queryFirst).mockResolvedValue({
        id: 'session-1',
        user_id: 'user-1',
        token_hash: 'hash',
        expires_at: new Date(Date.now() - 1000).toISOString(),
        revoked_at: null,
        created_at: new Date().toISOString(),
        last_used_at: new Date().toISOString(),
      });
      const request = new Request('http://localhost/api/admin', {
        headers: { Authorization: 'Bearer test-token' },
      });
      const result = await requireAdminAuth(env, request);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(401);
    });

    it('returns 401 when session is revoked', async () => {
      // Revoked sessions are filtered out by the WHERE clause, so queryFirst returns null
      vi.mocked(db.queryFirst).mockResolvedValue(null);
      const request = new Request('http://localhost/api/admin', {
        headers: { Authorization: 'Bearer test-token' },
      });
      const result = await requireAdminAuth(env, request);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(401);
    });

    it('returns 403 when user is not admin', async () => {
      vi.mocked(db.queryFirst)
        .mockResolvedValueOnce({
          id: 'session-1',
          user_id: 'user-1',
          token_hash: 'hash',
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          revoked_at: null,
          created_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
        })
        .mockResolvedValueOnce({
          id: 'user-1',
          email: 'user@example.com',
          global_role: 'reader',
        });
      const request = new Request('http://localhost/api/admin', {
        headers: { Authorization: 'Bearer test-token' },
      });
      const result = await requireAdminAuth(env, request);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(403);
    });

    it('returns ok with context for valid admin session', async () => {
      vi.mocked(db.queryFirst)
        .mockResolvedValueOnce({
          id: 'session-1',
          user_id: 'user-1',
          token_hash: 'hash',
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          revoked_at: null,
          created_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
        })
        .mockResolvedValueOnce({
          id: 'user-1',
          email: 'admin@example.com',
          global_role: 'admin',
        });
      vi.mocked(db.execute).mockResolvedValue({ rows: [] });
      const request = new Request('http://localhost/api/admin', {
        headers: { Authorization: 'Bearer test-token' },
      });
      const result = await requireAdminAuth(env, request);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.context.userId).toBe('user-1');
        expect(result.context.email).toBe('admin@example.com');
        expect(result.context.globalRole).toBe('admin');
      }
    });
  });

  describe('createAdminSession', () => {
    it('returns 401 for invalid credentials', async () => {
      vi.mocked(db.queryFirst).mockResolvedValue(null);
      const result = await createAdminSession(env, 'user@example.com', 'password');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(401);
    });

    it('returns 401 when password is wrong', async () => {
      vi.mocked(db.queryFirst).mockResolvedValue({
        id: 'user-1',
        email: 'admin@example.com',
        global_role: 'admin',
        password_hash: 'hashed',
      });
      vi.mocked(password.verifyPassword).mockResolvedValue(false);
      const result = await createAdminSession(env, 'admin@example.com', 'wrong');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(401);
    });

    it('returns 403 for non-admin user', async () => {
      vi.mocked(db.queryFirst).mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        global_role: 'reader',
        password_hash: 'hashed',
      });
      vi.mocked(password.verifyPassword).mockResolvedValue(true);
      const result = await createAdminSession(env, 'user@example.com', 'password');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(403);
    });

    it('returns token for valid admin credentials', async () => {
      vi.mocked(db.queryFirst).mockResolvedValue({
        id: 'user-1',
        email: 'admin@example.com',
        global_role: 'admin',
        password_hash: 'hashed',
      });
      vi.mocked(password.verifyPassword).mockResolvedValue(true);
      vi.mocked(db.execute).mockResolvedValue({ rows: [] });
      const result = await createAdminSession(env, 'admin@example.com', 'password');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.token).toBeDefined();
        expect(result.token.length).toBe(64); // 32 bytes hex
        expect(result.user.role).toBe('admin');
      }
    });
  });

  describe('revokeAdminSession', () => {
    it('executes update query', async () => {
      vi.mocked(db.execute).mockResolvedValue({ rows: [] });
      await revokeAdminSession(env, 'test-token');
      expect(db.execute).toHaveBeenCalled();
    });
  });

  describe('generateAdminToken', () => {
    it('returns a 64-char hex string', () => {
      const token = generateAdminToken();
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('returns unique tokens', () => {
      const t1 = generateAdminToken();
      const t2 = generateAdminToken();
      expect(t1).not.toBe(t2);
    });
  });
});

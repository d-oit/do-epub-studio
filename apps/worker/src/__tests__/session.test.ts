import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSession,
  validateSession,
  revokeSession,
  hashToken,
  parseAuthHeader,
} from '../auth/session';
import * as db from '../db/client';
import type { Env } from '../lib/env';

vi.mock('../db/client', () => ({
  queryFirst: vi.fn(),
  execute: vi.fn(),
}));

describe('session', () => {
  const env = {} as Env;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSession', () => {
    it('creates a session and returns token', async () => {
      vi.mocked(db.execute).mockResolvedValue({ rows: [] });
      const result = await createSession(env, 'book-1', 'user@example.com');
      expect(result.token).toBeDefined();
      expect(result.token.length).toBe(64); // 32 bytes hex
      expect(result.expiresAt).toBeDefined();
      expect(db.execute).toHaveBeenCalled();
    });

    it('lowercases email', async () => {
      vi.mocked(db.execute).mockResolvedValue({ rows: [] });
      await createSession(env, 'book-1', 'USER@EXAMPLE.COM');
      const callArgs = vi.mocked(db.execute).mock.calls[0];
      // execute(env, sql, params) — email is params[2]
      expect(callArgs?.[2]?.[2]).toBe('user@example.com');
    });
  });

  describe('validateSession', () => {
    it('returns invalid when session not found', async () => {
      vi.mocked(db.queryFirst).mockResolvedValue(null);
      const result = await validateSession(env, 'test-token');
      expect(result.valid).toBe(false);
    });

    it('returns invalid when session is expired', async () => {
      vi.mocked(db.queryFirst).mockResolvedValue({
        id: 'session-1',
        book_id: 'book-1',
        email: 'user@example.com',
        session_token_hash: 'hash',
        expires_at: new Date(Date.now() - 1000).toISOString(),
        revoked_at: null,
      });
      const result = await validateSession(env, 'test-token');
      expect(result.valid).toBe(false);
    });

    it('returns invalid when session is revoked', async () => {
      // Revoked sessions filtered by WHERE clause
      vi.mocked(db.queryFirst).mockResolvedValue(null);
      const result = await validateSession(env, 'test-token');
      expect(result.valid).toBe(false);
    });

    it('returns valid session with bookId', async () => {
      vi.mocked(db.queryFirst).mockResolvedValue({
        id: 'session-1',
        book_id: 'book-1',
        email: 'user@example.com',
        session_token_hash: 'hash',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        revoked_at: null,
      });
      const result = await validateSession(env, 'test-token');
      expect(result.valid).toBe(true);
      expect(result.bookId).toBe('book-1');
      expect(result.session?.id).toBe('session-1');
    });
  });

  describe('revokeSession', () => {
    it('executes update query', async () => {
      vi.mocked(db.execute).mockResolvedValue({ rows: [] });
      await revokeSession(env, 'test-token');
      expect(db.execute).toHaveBeenCalled();
    });
  });

  describe('hashToken', () => {
    it('returns consistent hash for same input', async () => {
      const h1 = await hashToken('test-token');
      const h2 = await hashToken('test-token');
      expect(h1).toBe(h2);
    });

    it('returns different hashes for different inputs', async () => {
      const h1 = await hashToken('token-1');
      const h2 = await hashToken('token-2');
      expect(h1).not.toBe(h2);
    });

    it('returns 64-char hex string', async () => {
      const hash = await hashToken('test');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('parseAuthHeader', () => {
    it('returns null for null header', () => {
      expect(parseAuthHeader(null)).toBeNull();
    });

    it('returns null for non-Bearer header', () => {
      expect(parseAuthHeader('Basic abc123')).toBeNull();
    });

    it('extracts token from Bearer header', () => {
      expect(parseAuthHeader('Bearer my-token')).toBe('my-token');
    });
  });
});

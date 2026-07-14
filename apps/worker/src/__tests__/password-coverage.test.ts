import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateGrant, computeCapabilities, getGrantByBookAndSession, getGrantsBySession, revokeGrant, createGrant } from '../auth/password';
import * as db from '../db/client';

vi.mock('../db/client', () => ({
  queryFirst: vi.fn(),
  queryAll: vi.fn(),
  execute: vi.fn(),
}));

vi.mock('argon2-wasm-edge', () => ({
  argon2id: vi.fn().mockResolvedValue('hash'),
  argon2Verify: vi.fn().mockResolvedValue(true),
}));

describe('auth/password.ts coverage', () => {
  const env = {
    BOOKS_BUCKET: {} as any,
    DB: { prepare: vi.fn().mockReturnThis(), bind: vi.fn().mockReturnThis(), all: vi.fn().mockResolvedValue({ results: [] }) } as unknown as D1Database,
    SENDER_EMAIL: {} as unknown as SendEmail,
    TURSO_DATABASE_URL: 'file::memory:',
    TURSO_AUTH_TOKEN: 'test-token',
    SESSION_SIGNING_SECRET: 'secret',
    INVITE_TOKEN_SECRET: 'secret',
    APP_BASE_URL: 'url',
    RATE_LIMITER: {} as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateGrant', () => {
    it('handles book not found', async () => {
      vi.mocked(db.queryFirst).mockResolvedValue(null);
      const res = await validateGrant(env, 'slug', 'email');
      expect(res.valid).toBe(false);
      expect(res.error).toBe('Book not found');
    });

    it('handles grant not found', async () => {
      vi.mocked(db.queryFirst)
        .mockResolvedValueOnce({ id: 'b1' })
        .mockResolvedValueOnce(null);
      const res = await validateGrant(env, 'slug', 'email');
      expect(res.valid).toBe(false);
    });

    it('handles expired grant', async () => {
      vi.mocked(db.queryFirst)
        .mockResolvedValueOnce({ id: 'b1' })
        .mockResolvedValueOnce({ id: 'g1', allowed: 1, expires_at: '2000-01-01' });
      const res = await validateGrant(env, 'slug', 'email');
      expect(res.valid).toBe(false);
      expect(res.error).toBe('Access expired');
    });

    it('handles password required', async () => {
      vi.mocked(db.queryFirst)
        .mockResolvedValueOnce({ id: 'b1' })
        .mockResolvedValueOnce({ id: 'g1', allowed: 1, password_hash: 'hash' });
      const res = await validateGrant(env, 'slug', 'email');
      expect(res.valid).toBe(false);
      expect(res.error).toBe('Password required');
    });

    it('handles invalid password', async () => {
      const { argon2Verify } = await import('argon2-wasm-edge');
      vi.mocked(argon2Verify).mockResolvedValue(false);
      vi.mocked(db.queryFirst)
        .mockResolvedValueOnce({ id: 'b1' })
        .mockResolvedValueOnce({ id: 'g1', allowed: 1, password_hash: 'hash' });
      const res = await validateGrant(env, 'slug', 'email', 'wrong');
      expect(res.valid).toBe(false);
      expect(res.error).toBe('Invalid password');
    });

    it('returns valid grant', async () => {
      vi.mocked(db.queryFirst)
        .mockResolvedValueOnce({ id: 'b1' })
        .mockResolvedValueOnce({ id: 'g1', allowed: 1, password_hash: null });
      const res = await validateGrant(env, 'slug', 'email');
      expect(res.valid).toBe(true);
    });
  });

  it('createGrant inserts into DB', async () => {
    vi.mocked(db.execute).mockResolvedValue({} as any);
    const id = await createGrant(env, 'b1', 'e@ex.com', { password: 'p' });
    expect(id).toBeDefined();
    expect(db.execute).toHaveBeenCalled();
  });

  it('revokeGrant updates DB', async () => {
    await revokeGrant(env, 'g1');
    expect(db.execute).toHaveBeenCalled();
  });

  it('computeCapabilities maps fields', () => {
    const caps = computeCapabilities({
      allowed: 1, comments_allowed: 1, offline_allowed: 1
    } as any);
    expect(caps.canRead).toBe(true);
    expect(caps.canComment).toBe(true);
    expect(caps.canDownloadOffline).toBe(true);
  });

  it('getGrantByBookAndSession queries DB', async () => {
    vi.mocked(db.queryFirst).mockResolvedValue({ id: 'g1' });
    const res = await getGrantByBookAndSession(env, 'b1', 'e');
    expect(res?.id).toBe('g1');
  });

  it('getGrantsBySession queries DB', async () => {
    vi.mocked(db.queryAll).mockResolvedValue([{ id: 'g1' }]);
    const res = await getGrantsBySession(env, 'e');
    expect(res).toHaveLength(1);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/client', () => ({
  queryFirst: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
}));

import { queryFirst, execute } from '../db/client';
import {
  createResetToken,
  verifyResetToken,
  bumpResetTokenAttempt,
  claimResetToken,
  revokeTokensForAccount,
  purgeExpiredTokensForAccount,
  MAX_TOKEN_ATTEMPTS,
} from '../auth/reset';
import type { Env } from '../lib/env';

const env = {} as Env;
const mockQueryFirst = queryFirst as ReturnType<typeof vi.fn>;
const mockExecute = execute as ReturnType<typeof vi.fn>;

/** Env with a stubbed D1 DB so claimResetToken's conditional UPDATE is testable. */
function makeClaimEnv(changes: number): Env {
  return {
    DB: {
      prepare: () => ({
        bind: () => ({
          run: vi.fn().mockResolvedValue({ meta: { changes } }),
        }),
      }),
    },
  } as unknown as Env;
}

describe('reset token governance (ADR-232)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createResetToken returns a raw token and persists only its SHA-256 hash', async () => {
    const token = await createResetToken(env, { purpose: 'admin_reset', userId: 'u1', email: 'a@b.com', ipHash: 'ip', traceId: 't' });
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    const [, sql, args] = mockExecute.mock.calls[0];
    expect(sql).toContain('INSERT INTO password_reset_tokens');
    // The raw token must never be persisted — only its hash.
    expect(args).not.toContain(token);
    const storedHash = args?.[3];
    expect(storedHash).toBeDefined();
    expect((storedHash as string)).not.toBe(token);
  });

  it('verifyResetToken returns invalid for an unknown token', async () => {
    mockQueryFirst.mockResolvedValue(null);
    await expect(verifyResetToken(env, 'x', 'admin_reset')).resolves.toEqual({ ok: false, reason: 'invalid' });
  });

  it('verifyResetToken rejects a wrong purpose', async () => {
    mockQueryFirst.mockResolvedValue({ id: 'rt-1', email: null, user_id: 'u1', purpose: 'reader_magic_link', expires_at: '2099-01-01T00:00:00Z', used_at: null, attempt_count: 0 });
    await expect(verifyResetToken(env, 'x', 'admin_reset')).resolves.toEqual({ ok: false, reason: 'purpose' });
  });

  it('verifyResetToken rejects a used (replayed) token', async () => {
    mockQueryFirst.mockResolvedValue({ id: 'rt-1', email: null, user_id: 'u1', purpose: 'admin_reset', expires_at: '2099-01-01T00:00:00Z', used_at: '2026-01-01T00:00:00Z', attempt_count: 0 });
    await expect(verifyResetToken(env, 'x', 'admin_reset')).resolves.toEqual({ ok: false, reason: 'used' });
  });

  it('verifyResetToken rejects an expired token', async () => {
    mockQueryFirst.mockResolvedValue({ id: 'rt-1', email: null, user_id: 'u1', purpose: 'admin_reset', expires_at: '2020-01-01T00:00:00Z', used_at: null, attempt_count: 0 });
    await expect(verifyResetToken(env, 'x', 'admin_reset')).resolves.toEqual({ ok: false, reason: 'expired' });
  });

  it('verifyResetToken rejects a token that exhausted its attempt budget', async () => {
    mockQueryFirst.mockResolvedValue({ id: 'rt-1', email: null, user_id: 'u1', purpose: 'admin_reset', expires_at: '2099-01-01T00:00:00Z', used_at: null, attempt_count: MAX_TOKEN_ATTEMPTS });
    await expect(verifyResetToken(env, 'x', 'admin_reset')).resolves.toEqual({ ok: false, reason: 'invalid' });
  });

  it('verifyResetToken accepts a valid, unused, unexpired token', async () => {
    mockQueryFirst.mockResolvedValue({ id: 'rt-1', email: 'a@b.com', user_id: 'u1', purpose: 'admin_reset', expires_at: '2099-01-01T00:00:00Z', used_at: null, attempt_count: 0 });
    await expect(verifyResetToken(env, 'x', 'admin_reset')).resolves.toEqual({
      ok: true,
      record: { id: 'rt-1', email: 'a@b.com', userId: 'u1', purpose: 'admin_reset' },
    });
  });

  it('bumpResetTokenAttempt / claimResetToken / revokeTokensForAccount issue the right SQL', async () => {
    await bumpResetTokenAttempt(env, 'rt-1');
    expect(mockExecute).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('attempt_count = attempt_count + 1'), ['rt-1']);
  });

  it('claimResetToken returns true only when the row transitioned (single-use atomicity)', async () => {
    const winner = makeClaimEnv(1);
    const loser = makeClaimEnv(0);
    await expect(claimResetToken(winner, 'rt-1')).resolves.toBe(true);
    await expect(claimResetToken(loser, 'rt-1')).resolves.toBe(false);
  });

  it('revokeTokensForAccount invalidates outstanding tokens by userId and email', async () => {
    await revokeTokensForAccount(env, { userId: 'u1', email: 'A@B.com' });
    expect(mockExecute).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('WHERE user_id = ?'), ['u1']);
    expect(mockExecute).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('WHERE email = ?'), ['a@b.com']);
  });

  it('purgeExpiredTokensForAccount deletes expired unused tokens for an account', async () => {
    await purgeExpiredTokensForAccount(env, { userId: 'u1', email: 'a@b.com' });
    const purgeQueries = mockExecute.mock.calls.map((c) => c[1]);
    expect(purgeQueries.some((q) => q.includes('DELETE FROM password_reset_tokens') && q.includes('user_id = ?'))).toBe(true);
    expect(purgeQueries.some((q) => q.includes('DELETE FROM password_reset_tokens') && q.includes('email = ?'))).toBe(true);
  });
});

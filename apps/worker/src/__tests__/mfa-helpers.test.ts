import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRecoveryCodes, hashRecoveryCode, verifyRecoveryCode, consumeChallenge, isChallengeUsable, storeChallenge } from '../auth/mfa';
import type { Env } from '../lib/env';

// ---------------------------------------------------------------------------
// Unit coverage for the real auth/mfa helpers (ADR-234 items 5+6 invariant:
// recovery codes are hashed at rest and single-use by rewrite-on-match).
// The db/client module is stubbed so these exercise the pure logic.
// ---------------------------------------------------------------------------

vi.mock('../db/client', () => ({
  queryFirst: vi.fn(),
  queryAll: vi.fn(),
  execute: vi.fn(),
}));

vi.mock('../auth/admin-middleware', () => ({
  hashToken: vi.fn(async (token: string) => {
    const buf = await crypto.subtle?.digest?.('SHA-256', new TextEncoder().encode(token));
    if (!buf) return `hash:${token}`;
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }),
}));

import { queryFirst, execute } from '../db/client';

function env() {
  return { DB: { prepare: vi.fn() } } as any; // eslint-disable-line @typescript-eslint/no-explicit-any -- test helper
}

describe('recovery codes (real helpers)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createRecoveryCodes returns 10 distinct 20-hex codes whose hashes never equal the plaintext', async () => {
    const { codes, hashes } = await createRecoveryCodes(10);

    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) {
      expect(code).toMatch(/^[0-9a-f]{20}$/);
    }
    expect(hashes).toHaveLength(10);
    // Stored hashes never equal the plaintext codes (SHA-256 at rest).
    for (const h of hashes) {
      expect(codes).not.toContain(h);
    }
  });

  it('validateRecoveryCode is single-use: the matched code is removed on verification', async () => {
    const { codes, hashes } = await createRecoveryCodes(10);

    // First verification round: hashes are stored and returned from DB.
    (queryFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ recovery_codes_hash_json: JSON.stringify(hashes) });

    const ok = await verifyRecoveryCode(env(), 'user-1', codes[0]);
    expect(ok).toBe(true);

    // The remaining hashes written back must NOT include code[0]'s hash.
    const writeCall = (execute as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => typeof c[1] === 'string' && c[1].includes('recovery_codes_hash_json'),
    );
    expect(writeCall).toBeDefined();
    if (!writeCall) throw new Error('expected write call');
    const remainingRaw = (writeCall[2] as string[])[0];
    const remaining = JSON.parse(remainingRaw) as string[];
    const usedHash = await hashRecoveryCode(codes[0]);
    expect(remaining).not.toContain(usedHash);
    expect(remaining).toHaveLength(9);
  });

  it('returns false when no stored codes match', async () => {
    (queryFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ recovery_codes_hash_json: JSON.stringify(['abc']) });
    const ok = await verifyRecoveryCode(env(), 'user-1', 'nope');
    expect(ok).toBe(false);
  });
});

describe('consumeChallenge (real helper)', () => {
  it('returns true only when the UPDATE affected a row (single-use + expiry enforced)', async () => {
    const makeEnvWithChanges = (changes: number) =>
      ({
        DB: {
          prepare: () => ({
            bind: () => ({
              run: () => ({ meta: { changes } }),
            }),
          }),
        },
      } as unknown as Env);

    expect(await consumeChallenge(makeEnvWithChanges(1), 'chal-1')).toBe(true);
    expect(await consumeChallenge(makeEnvWithChanges(0), 'chal-1')).toBe(false);
  });
});

describe('storeChallenge (real helper — opportunistic prune of webauthn_challenges)', () => {
  it('issues the INSERT then a DELETE pruning expired or used rows', async () => {
    await storeChallenge(env(), {
      id: 'c1',
      userId: 'u1',
      purpose: 'authentication',
      rawChallenge: 'c1',
      expiresAt: '2099-01-01T00:00:00.000Z',
    });

    const calls = (execute as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(2);

    expect(calls[0][1]).toContain('INSERT INTO webauthn_challenges');

    const pruneCall = calls[1][1] as string;
    expect(pruneCall).toContain('DELETE FROM webauthn_challenges');
    expect(pruneCall).toContain('used_at IS NOT NULL');
  });
});

describe('isChallengeUsable (real helper — ownership + purpose binding)', () => {
  const chal = (over: { user_id?: string; purpose?: 'registration' | 'authentication'; used_at?: string | null; expires_at?: string } = {}) => ({
    user_id: 'user-1',
    purpose: 'authentication' as const,
    raw_challenge: 'chal',
    expires_at: '2099-01-01T00:00:00.000Z',
    used_at: null,
    ...over,
  });

  it('accepts a fresh challenge owned by the caller with the matching purpose', () => {
    expect(isChallengeUsable(chal(), { userId: 'user-1', purpose: 'authentication' })).toBe(true);
  });

  it('rejects a challenge owned by a different user', () => {
    expect(isChallengeUsable(chal({ user_id: 'user-2' }), { userId: 'user-1', purpose: 'authentication' })).toBe(false);
  });

  it('rejects a challenge minted for a different purpose', () => {
    expect(isChallengeUsable(chal({ purpose: 'registration' }), { userId: 'user-1', purpose: 'authentication' })).toBe(false);
  });

  it('rejects used or expired challenges', () => {
    expect(isChallengeUsable(chal({ used_at: '2026-08-13T00:00:00.000Z' }), { userId: 'user-1', purpose: 'authentication' })).toBe(false);
    expect(isChallengeUsable(chal({ expires_at: '2000-01-01T00:00:00.000Z' }), { userId: 'user-1', purpose: 'authentication' })).toBe(false);
  });

  it('rejects a missing challenge', () => {
    expect(isChallengeUsable(null, { userId: 'user-1', purpose: 'authentication' })).toBe(false);
  });
});

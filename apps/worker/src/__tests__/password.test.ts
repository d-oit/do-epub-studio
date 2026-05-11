/**
 * T-3: Password hashing tests (Argon2id security-critical)
 *
 * `argon2-wasm-edge` is a WASM module compiled for the Cloudflare Workers
 * edge runtime and cannot execute directly in Node.js Vitest.  We mock it
 * with a deterministic substitute that preserves the externally observable
 * behaviour we want to verify:
 *
 *   - The encoded hash is a non-empty string.
 *   - Each call embeds the random salt so two calls with the same password
 *     produce different hashes.
 *   - `argon2Verify` decodes the embedded password and compares it, so
 *     correct/incorrect passwords produce true/false correctly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('argon2-wasm-edge', () => ({
  /**
   * Encode salt as hex and password as base64 so the output is unique per
   * call (random salt) yet still verifiable by our mock `argon2Verify`.
   */
  argon2id: vi.fn(
    async ({ password, salt }: { password: string; salt: Uint8Array }): Promise<string> => {
      const saltHex = Array.from(salt)
        .map((b: number) => b.toString(16).padStart(2, '0'))
        .join('');
      return `$argon2id$v=19$m=65536,t=3,p=4$${saltHex}$${btoa(password)}`;
    },
  ),
  /**
   * Reverse the encoding: extract the base64 password segment and compare.
   * Returns false (not throw) for hashes that do not match the expected
   * format — mirroring how a real corrupted hash would behave.
   */
  argon2Verify: vi.fn(
    async ({ password, hash }: { password: string; hash: string }): Promise<boolean> => {
      // Format: $argon2id$v=19$m=...$<saltHex>$<base64Password>
      const parts = hash.split('$');
      if (parts.length < 6) return false;
      return parts[5] === btoa(password);
    },
  ),
}));

// Isolate password helpers from the database layer; hashPassword and
// verifyPassword never touch the DB, but password.ts imports these at the
// module level.
vi.mock('../db/client', () => ({
  queryFirst: vi.fn(),
  queryAll: vi.fn(),
  execute: vi.fn(),
}));

import { argon2id, argon2Verify } from 'argon2-wasm-edge';
import { hashPassword, verifyPassword } from '../auth/password';

// ---------------------------------------------------------------------------
// hashPassword
// ---------------------------------------------------------------------------

describe('hashPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a non-empty encoded string', async () => {
    const hash = await hashPassword('my-secret-password');
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('produces a unique hash on every call (random salt)', async () => {
    const hash1 = await hashPassword('same-password');
    const hash2 = await hashPassword('same-password');
    expect(hash1).not.toBe(hash2);
  });

  it('handles empty-string password without throwing', async () => {
    await expect(hashPassword('')).resolves.toEqual(expect.any(String));
  });

  it('passes correct Argon2id security parameters to the underlying primitive', async () => {
    const mockArgon2id = vi.mocked(argon2id);

    await hashPassword('test-password');

    expect(mockArgon2id).toHaveBeenCalledOnce();
    const callArg = mockArgon2id.mock.calls[0][0];

    expect(callArg).toMatchObject({
      password: 'test-password',
      iterations: 3,      // ITERATIONS = 3
      parallelism: 4,     // PARALLELISM = 4
      memorySize: 65536,  // MEMORY_COST_KIB = 64 MiB
      hashLength: 32,     // HASH_LENGTH = 32
      outputType: 'encoded',
    });

    // A fresh 16-byte random salt must be generated for every hash
    expect(callArg.salt).toBeInstanceOf(Uint8Array);
    expect(callArg.salt).toHaveLength(16);
  });
});

// ---------------------------------------------------------------------------
// verifyPassword
// ---------------------------------------------------------------------------

describe('verifyPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when the password matches the stored hash', async () => {
    const password = 'correct-password';
    const hash = await hashPassword(password);
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
  });

  it('returns false when the password does not match the stored hash', async () => {
    const hash = await hashPassword('correct-password');
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });

  it('returns false for empty password checked against a non-empty hash', async () => {
    const hash = await hashPassword('some-password');
    await expect(verifyPassword('', hash)).resolves.toBe(false);
  });

  it('returns false (no throw) when the underlying argon2Verify throws a corrupt-hash error', async () => {
    // Simulate a corrupted stored hash that causes argon2Verify to throw.
    // verifyPassword must catch this and return false per TIER-1 security requirements.
    vi.mocked(argon2Verify).mockRejectedValueOnce(new Error('Invalid hash format'));
    await expect(verifyPassword('any-password', 'corrupted-$hash$data')).resolves.toBe(false);
  });
});

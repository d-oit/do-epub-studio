import type { Env } from '../lib/env';
import { hashToken } from './session';
import { execute, queryFirst } from '../db/client';

/**
 * Password reset / magic-link token governance (ADR-232).
 *
 * Tokens are CSPRNG-issued (>= 32 bytes), never stored in plaintext, and
 * persisted only as a SHA-256 hash in `password_reset_tokens`. Each token is
 * single-use (one `used_at` write), short-lived, and attempt-counted so replay
 * and reuse degrade to a generic invalid-token response while still being
 * auditable. Reader magic-link access shares the same table with a distinct
 * purpose, satisfying ADR-232's "persisted single-use magic-link token" rule.
 */

export type ResetPurpose = 'admin_reset' | 'reader_reset' | 'reader_magic_link';

// Static purpose -> TTL lookup (ADRs 231/232: 15 min admin, 30 min reader).
export const RESET_TTL_MS: Record<ResetPurpose, number> = {
  admin_reset: 15 * 60 * 1000,
  reader_reset: 30 * 60 * 1000,
  reader_magic_link: 30 * 60 * 1000,
};

const TOKEN_BYTES = 32;

/** Maximum verification attempts per token before it is considered brute-forced (ADR-232). */
export const MAX_TOKEN_ATTEMPTS = 5;

function generateToken(): string {
  const array = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface CreateResetTokenParams {
  purpose: ResetPurpose;
  email?: string;
  userId?: string;
  ipHash?: string;
  traceId?: string;
}

export interface ResetTokenRecord {
  id: string;
  email?: string;
  userId?: string;
  purpose: ResetPurpose;
}

/**
 * Mint a single-use reset/magic-link token and persist only its SHA-256 hash.
 * Returns the raw token exactly once (for the emailed link). Callers must not
 * store or log the returned value.
 */
export async function createResetToken(env: Env, params: CreateResetTokenParams): Promise<string> {
  const token = generateToken();
  const tokenHash = await hashToken(token);
  const now = Date.now();
  const id = crypto.randomUUID();
  const ttl = RESET_TTL_MS[params.purpose];

  await execute(
    env,
    `INSERT INTO password_reset_tokens
     (id, email, user_id, token_hash, purpose, expires_at, requested_ip_hash, request_trace_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.email ?? null,
      params.userId ?? null,
      tokenHash,
      params.purpose,
      new Date(now + ttl).toISOString(),
      params.ipHash ?? null,
      params.traceId ?? null,
    ],
  );

  return token;
}

/**
 * Validate a token without consuming it (used to distinguish a misused token's
 * failure class so the caller can log the right audit event).
 */
export async function verifyResetToken(
  env: Env,
  rawToken: string,
  purpose: ResetPurpose,
): Promise<
  | { ok: true; record: ResetTokenRecord }
  | { ok: false; reason: 'invalid' | 'expired' | 'used' | 'purpose' }
> {
  const tokenHash = await hashToken(rawToken);
  const row = await queryFirst<{ id: string; email: string | null; user_id: string | null; purpose: string; expires_at: string; used_at: string | null; attempt_count: number }>(
    env,
    `SELECT id, email, user_id, purpose, expires_at, used_at, attempt_count
     FROM password_reset_tokens
     WHERE token_hash = ?`,
    [tokenHash],
  );

  if (!row) return { ok: false, reason: 'invalid' };
  if (row.purpose !== purpose) return { ok: false, reason: 'purpose' };
  if (row.used_at) return { ok: false, reason: 'used' };
  if (new Date(row.expires_at) < new Date()) {
    return { ok: false, reason: 'expired' };
  }
  if (row.attempt_count >= MAX_TOKEN_ATTEMPTS) {
    return { ok: false, reason: 'invalid' };
  }

  return {
    ok: true,
    record: {
      id: row.id,
      email: row.email ?? undefined,
      userId: row.user_id ?? undefined,
      purpose: row.purpose,
    },
  };
}

/** Increment the attempt counter (call once per verification attempt). */
export async function bumpResetTokenAttempt(env: Env, tokenId: string): Promise<void> {
  await execute(
    env,
    `UPDATE password_reset_tokens SET attempt_count = attempt_count + 1 WHERE id = ?`,
    [tokenId],
  );
}

/** Mark a token consumed. Must run in the same operation that changes the password. */
export async function claimResetToken(env: Env, tokenId: string): Promise<boolean> {
  const res = await env.DB.prepare(
    `UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ? AND used_at IS NULL`,
  ).bind(tokenId).run();
  return (res.meta?.changes ?? 0) > 0;
}

/**
 * Opportunistic cleanup of expired/unused tokens for an account (ADR-232:
 * "cleanup job for expired tokens"). Bounded to a single account so the table
 * cannot grow unbounded while avoiding a scheduler dependency in the worker.
 * Note: `expires_at` is stored as ISO-8601 and must be normalized with
 * `datetime()` before comparing against `datetime('now')` (a space-separated
 * SQLite timestamp) to avoid a lexical-format mismatch.
 */
export async function purgeExpiredTokensForAccount(
  env: Env,
  opts: { userId?: string; email?: string },
): Promise<void> {
  if (opts.userId) {
    await execute(
      env,
      `DELETE FROM password_reset_tokens
       WHERE user_id = ? AND used_at IS NULL AND datetime(expires_at) < datetime('now')`,
      [opts.userId],
    );
  }
  if (opts.email) {
    await execute(
      env,
      `DELETE FROM password_reset_tokens
       WHERE email = ? AND used_at IS NULL AND datetime(expires_at) < datetime('now')`,
      [opts.email.toLowerCase()],
    );
  }
}

/** Invalidate all outstanding tokens for an account (e.g. after a password change). */
export async function revokeTokensForAccount(
  env: Env,
  opts: { userId?: string; email?: string },
): Promise<void> {
  if (opts.userId) {
    await execute(
      env,
      `UPDATE password_reset_tokens SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL`,
      [opts.userId],
    );
  }
  if (opts.email) {
    await execute(
      env,
      `UPDATE password_reset_tokens SET used_at = datetime('now') WHERE email = ? AND used_at IS NULL`,
      [opts.email.toLowerCase()],
    );
  }
}

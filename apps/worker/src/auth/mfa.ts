import type { Env } from '../lib/env';
import { execute, queryFirst, queryAll } from '../db/client';
import { hashToken } from './admin-middleware';

// =============================================================================
// ADR-234 items 5+6: WebAuthn passkey + recovery-code governance for admin
// accounts. Pure DB + crypto helpers (no Hono dependency).
//
// Passkey credential material (credential_id / public_key) is stored
// base64url-encoded exactly as SimpleWebAuthn returns it so it round-trips
// losslessly into the verify* calls. Recovery codes are SHA-256 hashed at rest
// in `users.recovery_codes_hash_json` (a JSON array of hex hashes) and are
// single-use by rewrite-on-match.
// =============================================================================

const PASSKEY_BYTES = 32;
const RECOVERY_CODE_BYTES = 10; // 10 bytes -> 20 hex chars (80 bits entropy)

export type PasskeyCredential = {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  credential_device_type: string | null;
  credential_backed_up: number;
  transports: string | null;
  aaguid: string | null;
  display_name: string | null;
  created_at: string;
  last_used_at: string | null;
};

export type ChallengeRecord = {
  user_id: string;
  purpose: 'registration' | 'authentication';
  raw_challenge: string;
  expires_at: string;
  used_at: string | null;
};

export interface NewPasskeyCredential {
  credentialId: string;
  publicKey: string;
  counter: number;
  deviceType: string;
  backedUp: boolean;
  transports?: string[];
  aaguid?: string;
  displayName?: string;
}

/** 32 random bytes as lowercase hex (same CSPRNG pattern as reset.ts). */
export function generateChallenge(): string {
  const array = new Uint8Array(PASSKEY_BYTES);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Encode raw bytes as unpadded base64url (for storing SimpleWebAuthn material). */
export function bufferToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decode unpadded base64url into raw bytes. */
export function decodeBase64UrlToBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, '=');
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Decode the `challenge` field out of a WebAuthn `clientDataJSON` (base64url).
 * Used by the verify path to identify which stored (single-use) challenge a
 * ceremony belongs to before running SimpleWebAuthn's verifier. Returns null
 * when the payload cannot be decoded / has no challenge.
 */
export function decodeClientDataChallenge(clientDataJSON: string): string | null {
  try {
    const text = new TextDecoder().decode(decodeBase64UrlToBytes(clientDataJSON));
    const parsed = JSON.parse(text) as { challenge?: unknown };
    return typeof parsed.challenge === 'string' ? parsed.challenge : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Passkey credentials
// ---------------------------------------------------------------------------

export async function listPasskeys(env: Env, userId: string): Promise<PasskeyCredential[]> {
  return queryAll<PasskeyCredential>(
    env,
    `SELECT id, user_id, credential_id, public_key, counter, credential_device_type,
            credential_backed_up, transports, aaguid, display_name, created_at, last_used_at
     FROM passkey_credentials
     WHERE user_id = ?
     ORDER BY created_at ASC`,
    [userId],
  );
}

export async function getPasskeyById(env: Env, id: string, userId: string): Promise<PasskeyCredential | null> {
  return queryFirst<PasskeyCredential>(
    env,
    `SELECT id, user_id, credential_id, public_key, counter, credential_device_type,
            credential_backed_up, transports, aaguid, display_name, created_at, last_used_at
     FROM passkey_credentials
     WHERE id = ? AND user_id = ?`,
    [id, userId],
  );
}

export async function getPasskeyByCredentialId(env: Env, credentialId: string): Promise<PasskeyCredential | null> {
  return queryFirst<PasskeyCredential>(
    env,
    `SELECT id, user_id, credential_id, public_key, counter, credential_device_type,
            credential_backed_up, transports, aaguid, display_name, created_at, last_used_at
     FROM passkey_credentials
     WHERE credential_id = ?`,
    [credentialId],
  );
}

export async function insertPasskey(
  env: Env,
  userId: string,
  cred: NewPasskeyCredential,
): Promise<void> {
  const id = crypto.randomUUID();
  await execute(
    env,
    `INSERT INTO passkey_credentials
       (id, user_id, credential_id, public_key, counter, credential_device_type,
        credential_backed_up, transports, aaguid, display_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      cred.credentialId,
      cred.publicKey,
      cred.counter,
      cred.deviceType,
      cred.backedUp ? 1 : 0,
      cred.transports ? JSON.stringify(cred.transports) : null,
      cred.aaguid ?? null,
      cred.displayName ?? null,
    ],
  );
}

export async function updatePasskeyCounter(env: Env, credentialId: string, counter: number): Promise<void> {
  await execute(
    env,
    `UPDATE passkey_credentials
     SET counter = ?, last_used_at = datetime('now')
     WHERE credential_id = ?`,
    [counter, credentialId],
  );
}

export async function deletePasskey(env: Env, id: string, userId: string): Promise<void> {
  await execute(
    env,
    `DELETE FROM passkey_credentials WHERE id = ? AND user_id = ?`,
    [id, userId],
  );
}

// ---------------------------------------------------------------------------
// WebAuthn ceremony challenges (single-use, short expiry)
// ---------------------------------------------------------------------------

export async function findChallenge(env: Env, id: string): Promise<ChallengeRecord | null> {
  return queryFirst<ChallengeRecord>(
    env,
    `SELECT user_id, purpose, raw_challenge, expires_at, used_at
     FROM webauthn_challenges
     WHERE id = ?`,
    [id],
  );
}

export async function storeChallenge(
  env: Env,
  args: { id: string; userId: string; purpose: 'registration' | 'authentication'; rawChallenge: string; expiresAt: string },
): Promise<void> {
  await execute(
    env,
    `INSERT INTO webauthn_challenges (id, user_id, purpose, raw_challenge, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [args.id, args.userId, args.purpose, args.rawChallenge, args.expiresAt],
  );

  // Opportunistic prune: bound table growth by removing expired/consumed
  // challenges whenever a new ceremony starts. Expired/used rows are never
  // usable (consumeChallenge/isChallengeUsable enforce expiry + single-use), so
  // deletion can never weaken a ceremony. The just-inserted row (future
  // expires_at, used_at NULL) is unaffected.
  await execute(
    env,
    `DELETE FROM webauthn_challenges
     WHERE datetime(expires_at) < datetime('now') OR used_at IS NOT NULL`,
  );
}

/**
 * Atomically mark a challenge used iff it is still unconsumed and unexpired.
 * Enforces single-use + expiry in one UPDATE (ADR-234 hardening).
 */
export async function consumeChallenge(env: Env, id: string): Promise<boolean> {
  const res = await env.DB.prepare(
    `UPDATE webauthn_challenges
     SET used_at = datetime('now')
     WHERE id = ? AND used_at IS NULL AND datetime(expires_at) > datetime('now')`,
  ).bind(id).run();
  return (res.meta?.changes ?? 0) > 0;
}

/**
 * True iff the challenge exists, is unconsumed, unexpired, was issued to the
 * acting user, and matches the ceremony purpose. Ownership + purpose binding
 * close the cross-user/cross-purpose reuse gap (ADR-234 hardening): a
 * challenge minted for user A or for registration can never satisfy a session
 * that belongs to user B or an authentication ceremony.
 */
export function isChallengeUsable(
  challenge: ChallengeRecord | null,
  opts: { userId: string; purpose: 'registration' | 'authentication' },
): challenge is ChallengeRecord {
  if (!challenge) return false;
  if (challenge.user_id !== opts.userId) return false;
  if (challenge.purpose !== opts.purpose) return false;
  if (challenge.used_at) return false;
  if (new Date(challenge.expires_at) < new Date()) return false;
  return true;
}

/**
 * True when the account has MFA enrolled (mfa_method === 'passkey'), i.e. a
 * login second factor must be presented before a usable `mfa` session exists.
 * `mfa_method` is the single source of truth for enrollment.
 */
export async function userHasMfa(env: Env, userId: string): Promise<boolean> {
  const st = await getMfaState(env, userId);
  return st.method === 'passkey';
}

// ---------------------------------------------------------------------------
// Recovery codes (SHA-256 hashed at rest, single-use)
// ---------------------------------------------------------------------------

export async function createRecoveryCodes(count = 10): Promise<{ codes: string[]; hashes: string[] }> {
  const codes: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = generateChallenge().slice(0, RECOVERY_CODE_BYTES * 2); // 20 hex chars
    codes.push(code);
    hashes.push(await hashRecoveryCode(code));
  }
  return { codes, hashes };
}

export async function hashRecoveryCode(code: string): Promise<string> {
  return hashToken(code);
}

export async function writeRecoveryHashes(env: Env, userId: string, hashes: string[]): Promise<void> {
  await execute(
    env,
    `UPDATE users SET recovery_codes_hash_json = ? WHERE id = ?`,
    [JSON.stringify(hashes), userId],
  );
}

export async function clearRecoveryHashes(env: Env, userId: string): Promise<void> {
  await execute(env, `UPDATE users SET recovery_codes_hash_json = NULL WHERE id = ?`, [userId]);
}

export async function getMfaState(env: Env, userId: string): Promise<{ method: string | null; enrolledAt: string | null }> {
  const row = await queryFirst<{ mfa_method: string | null; mfa_enrolled_at: string | null }>(
    env,
    `SELECT mfa_method, mfa_enrolled_at FROM users WHERE id = ?`,
    [userId],
  );
  return { method: row?.mfa_method ?? null, enrolledAt: row?.mfa_enrolled_at ?? null };
}

export async function hasRecoveryCodes(env: Env, userId: string): Promise<boolean> {
  const row = await queryFirst<{ recovery_codes_hash_json: string | null }>(
    env,
    `SELECT recovery_codes_hash_json FROM users WHERE id = ?`,
    [userId],
  );
  return Boolean(row?.recovery_codes_hash_json && row.recovery_codes_hash_json !== '[]');
}

export async function setMfaEnrolled(env: Env, userId: string, method: string): Promise<void> {
  await execute(
    env,
    `UPDATE users SET mfa_method = ?, mfa_enrolled_at = datetime('now') WHERE id = ?`,
    [method, userId],
  );
}

export async function clearMfaEnrolled(env: Env, userId: string): Promise<void> {
  await execute(
    env,
    `UPDATE users SET mfa_method = NULL, mfa_enrolled_at = NULL WHERE id = ?`,
    [userId],
  );
}

/**
 * Verify a single-use recovery code against the hashed set stored on the
 * account. On match, re-writes the array with the used code removed, then
 * returns true. Returns false if no code matches or none are stored.
 *
 * NOTE: consumption is a read-modify-write, so under concurrent redemptions
 * two requests could theoretically clobber each other and leave a code
 * replayable. This is accepted: the recovery path is per-email rate-limited
 * (5/300 s) and there is no real-D1 integration harness in this repo to safely
 * validate an atomic SQLite JSON1 rewrite on this critical locked-out-admin
 * fallback — an untested single-statement rewrite is worse than the narrow,
 * mitigated race it would close. Re-evaluate if a real-D1 test layer lands.
 */
export async function verifyRecoveryCode(env: Env, userId: string, code: string): Promise<boolean> {
  const row = await queryFirst<{ recovery_codes_hash_json: string | null }>(
    env,
    `SELECT recovery_codes_hash_json FROM users WHERE id = ?`,
    [userId],
  );
  const raw = row?.recovery_codes_hash_json;
  if (!raw) return false;

  let hashes: string[];
  try {
    hashes = JSON.parse(raw) as string[];
  } catch {
    return false;
  }
  if (!Array.isArray(hashes) || hashes.length === 0) return false;

  const candidate = await hashRecoveryCode(code);
  const idx = hashes.indexOf(candidate);
  if (idx === -1) return false;

  hashes = hashes.filter((_, i) => i !== idx);
  await writeRecoveryHashes(env, userId, hashes);
  return true;
}

// ---------------------------------------------------------------------------
// Login-time MFA tickets (ADR-234 review hardening)
//
// A short-lived single-use ticket binds the public passkey second-factor
// ceremony to a prior successful password /login, so a passkey alone can never
// mint an `mfa` session (MFA = password + passkey). /login issues one after it
// verifies the password; /login/mfa/verify consumes it atomically immediately
// before minting the session.
// ---------------------------------------------------------------------------

const MFA_LOGIN_TICKET_TTL_MS = 5 * 60 * 1000; // match challenge window

export type LoginTicketRecord = {
  user_id: string;
  expires_at: string;
  used_at: string | null;
};

/** Mint a short-lived single-use login ticket for an account whose password was just verified. */
export async function createLoginTicket(env: Env, userId: string): Promise<string> {
  const id = generateChallenge();
  const expiresAt = new Date(Date.now() + MFA_LOGIN_TICKET_TTL_MS).toISOString();
  await execute(
    env,
    `INSERT INTO mfa_login_tickets (id, user_id, expires_at) VALUES (?, ?, ?)`,
    [id, userId, expiresAt],
  );
  return id;
}

export async function findLoginTicket(env: Env, id: string): Promise<LoginTicketRecord | null> {
  return queryFirst<LoginTicketRecord>(
    env,
    `SELECT user_id, expires_at, used_at FROM mfa_login_tickets WHERE id = ?`,
    [id],
  );
}

/** True iff the ticket exists, is unconsumed, and unexpired. */
export function isLoginTicketUsable(ticket: LoginTicketRecord | null): ticket is LoginTicketRecord {
  if (!ticket) return false;
  if (ticket.used_at) return false;
  if (new Date(ticket.expires_at) < new Date()) return false;
  return true;
}

/**
 * Atomically consume a login ticket iff it is still unused and unexpired.
 * Returns true only if this caller won the single-use right to mint the `mfa`
 * session. Enforced in one UPDATE (single-use + expiry), like consumeChallenge.
 */
export async function consumeLoginTicket(env: Env, id: string): Promise<boolean> {
  const res = await env.DB.prepare(
    `UPDATE mfa_login_tickets
     SET used_at = datetime('now')
     WHERE id = ? AND used_at IS NULL AND datetime(expires_at) > datetime('now')`,
  ).bind(id).run();
  return (res.meta?.changes ?? 0) > 0;
}

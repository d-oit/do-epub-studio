import type { Env } from '../lib/env';
import { queryFirst, queryAll, execute } from '../db/client';
import { verifyPassword } from './password';
import { logAppError } from '../lib/observability';

export interface AdminAuthContext {
  userId: string;
  email: string;
  globalRole: 'admin' | 'editor' | 'reader';
  token: string;
}

interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  global_role: 'admin' | 'editor' | 'reader';
  password_hash: string | null;
  disabled_at: string | null;
  compromised_at: string | null;
}

interface AdminSessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
  last_used_at: string;
}

const ADMIN_SESSION_TOKEN_BYTES = 32;
const ADMIN_SESSION_TTL_HOURS = 8;

function parseAdminAuthHeader(header: string | null): string | null {
  if (!header) return null;
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7);
}

export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function requireAdminAuth(
  env: Env,
  request: Request,
): Promise<{ ok: true; context: AdminAuthContext } | { ok: false; status: number; error: string }> {
  const authHeader = request.headers.get('Authorization');
  const token = parseAdminAuthHeader(authHeader);

  if (!token) {
    return { ok: false, status: 401, error: 'Missing authorization token' };
  }

  const tokenHash = await hashToken(token);

  const session = (await queryFirst(
    env,
    `SELECT id, user_id, token_hash, expires_at, revoked_at, created_at, last_used_at
     FROM admin_sessions
     WHERE token_hash = ? AND revoked_at IS NULL`,
    [tokenHash],
  )) as AdminSessionRow | null;

  if (!session) {
    return { ok: false, status: 401, error: 'Invalid or expired token' };
  }

  if (new Date(session.expires_at) < new Date()) {
    return { ok: false, status: 401, error: 'Token expired' };
  }

  const user = await queryFirst<{ id: string; email: string; global_role: 'admin' | 'editor' | 'reader'; disabled_at: string | null; compromised_at: string | null }>(
    env,
    `SELECT id, email, global_role, disabled_at, compromised_at
     FROM users
     WHERE id = ?`,
    [session.user_id],
  );

  if (!user) {
    return { ok: false, status: 401, error: 'User not found' };
  }

  if (user.global_role !== 'admin') {
    return { ok: false, status: 403, error: 'Admin access required' };
  }

  // Fail closed on disabled/compromised accounts (ADR-231/234): no admin
  // capability is granted while an account is disabled or marked compromised.
  if (user.disabled_at || user.compromised_at) {
    return { ok: false, status: 403, error: 'Account disabled' };
  }

  // Update last used time (non-blocking)
  execute(
    env,
    `UPDATE admin_sessions SET last_used_at = datetime('now') WHERE id = ?`,
    [session.id],
  ).catch((err: unknown) => {
    logAppError('admin_session.last_used_update_failed', err, { sessionId: session.id });
  });

  return {
    ok: true,
    context: {
      userId: user.id,
      email: user.email,
      globalRole: user.global_role,
      token,
    },
  };
}

export async function createAdminSession(
  env: Env,
  email: string,
  password: string,
): Promise<{ ok: true; token: string; user: { id: string; email: string; role: string } } | { ok: false; status: number; error: string }> {
  const user = (await queryFirst(
    env,
    `SELECT id, email, global_role, password_hash
     FROM users
     WHERE email = ?`,
    [email.toLowerCase()],
  )) as UserRow | null;

  if (!user) {
    return { ok: false, status: 401, error: 'Invalid credentials' };
  }

  if (!user.password_hash) {
    return { ok: false, status: 401, error: 'Invalid credentials' };
  }

  if (user.disabled_at || user.compromised_at) {
    return { ok: false, status: 403, error: 'Account disabled' };
  }

  const validPassword = await verifyPassword(password, user.password_hash);
  if (!validPassword) {
    return { ok: false, status: 401, error: 'Invalid credentials' };
  }

  if (user.global_role !== 'admin') {
    return { ok: false, status: 403, error: 'Admin access required' };
  }

  const token = generateAdminToken();
  const tokenHash = await hashToken(token);
  const sessionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();

  await execute(
    env,
    `INSERT INTO admin_sessions (id, user_id, token_hash, expires_at, created_at, last_used_at, assurance_level)
     VALUES (?, ?, ?, ?, ?, ?, 'password')`,
    [sessionId, user.id, tokenHash, expiresAt, now, now],
  );

  // Record the authenticated login timestamp (non-critical update).
  execute(
    env,
    `UPDATE users SET last_login_at = datetime('now') WHERE id = ?`,
    [user.id],
  ).catch((err: unknown) => {
    logAppError('admin_session.login_timestamp_update_failed', err, { userId: user.id });
  });

  return {
    ok: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.global_role,
    },
  };
}

export async function revokeAdminSession(
  env: Env,
  token: string,
): Promise<{ ok: boolean }> {
  const tokenHash = await hashToken(token);

  await execute(
    env,
    `UPDATE admin_sessions SET revoked_at = datetime('now') WHERE token_hash = ?`,
    [tokenHash],
  );

  return { ok: true };
}

export function generateAdminToken(): string {
  const array = new Uint8Array(ADMIN_SESSION_TOKEN_BYTES);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// =============================================================================
// ADR-234: session lifecycle — account-wide revocation, step-up assurance,
// rotation tracking, and session inventory.
// =============================================================================

export type AdminAssuranceLevel = 'none' | 'password' | 'step_up' | 'mfa';

export async function revokeAllAdminSessionsForUser(
  env: Env,
  userId: string,
  opts?: { exceptTokenHash?: string },
): Promise<void> {
  if (opts?.exceptTokenHash) {
    await execute(
      env,
      `UPDATE admin_sessions SET revoked_at = datetime('now')
       WHERE user_id = ? AND revoked_at IS NULL AND token_hash != ?`,
      [userId, opts.exceptTokenHash],
    );
  } else {
    await execute(
      env,
      `UPDATE admin_sessions SET revoked_at = datetime('now')
       WHERE user_id = ? AND revoked_at IS NULL`,
      [userId],
    );
  }
}

export async function revokeAllReaderSessionsForUser(env: Env, userId: string): Promise<void> {
  await execute(
    env,
    `UPDATE reader_sessions SET revoked_at = datetime('now')
     WHERE user_id = ? AND revoked_at IS NULL`,
    [userId],
  );
}

/**
 * Raise the current admin session's assurance level (step-up reauth). Optionally
 * rotates the session token for rotation-on-reauth (ADR-234). Returns the new
 * (possibly rotated) raw session token.
 */
export async function raiseAdminAssurance(
  env: Env,
  currentToken: string,
  level: Exclude<AdminAssuranceLevel, 'none'>,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const tokenHash = await hashToken(currentToken);
  const session = (await queryFirst<{ id: string; user_id: string }>(
    env,
    `SELECT id, user_id FROM admin_sessions WHERE token_hash = ? AND revoked_at IS NULL`,
    [tokenHash],
  ));

  if (!session) {
    return { ok: false, error: 'Invalid session' };
  }

  const rotatedToken = generateAdminToken();
  const rotatedHash = await hashToken(rotatedToken);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();

  await execute(
    env,
    `INSERT INTO admin_sessions
       (id, user_id, token_hash, expires_at, created_at, last_used_at, assurance_level, rotated_from, step_up_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      session.user_id,
      rotatedHash,
      expiresAt,
      now,
      now,
      level,
      session.id,
      now,
    ],
  );
  await execute(
    env,
    `UPDATE admin_sessions SET revoked_at = datetime('now') WHERE id = ?`,
    [session.id],
  );

  return { ok: true, token: rotatedToken };
}

export interface AdminSessionSummary {
  id: string;
  created_at: string;
  last_used_at: string;
  expires_at: string;
  assurance_level: AdminAssuranceLevel;
  device_label_hash: string | null;
  current: boolean;
}

export async function listAdminSessionsForUser(
  env: Env,
  userId: string,
  currentTokenHash: string,
): Promise<AdminSessionSummary[]> {
  const rows = await queryAll<{
    id: string;
    created_at: string;
    last_used_at: string;
    expires_at: string;
    assurance_level: string;
    device_label_hash: string | null;
    token_hash: string;
  }>(
    env,
    `SELECT id, created_at, last_used_at, expires_at, assurance_level, device_label_hash, token_hash
     FROM admin_sessions
     WHERE user_id = ? AND revoked_at IS NULL
     ORDER BY last_used_at DESC`,
    [userId],
  );

  return rows.map((r) => ({
    id: r.id,
    created_at: r.created_at,
    last_used_at: r.last_used_at,
    expires_at: r.expires_at,
    assurance_level: r.assurance_level as AdminAssuranceLevel,
    device_label_hash: r.device_label_hash,
    current: r.token_hash === currentTokenHash,
  }));
}


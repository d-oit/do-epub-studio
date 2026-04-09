import type { Env } from '../lib/env';
import { queryFirst, execute } from '../db/client';
import { hashPassword, verifyPassword } from './password';
import { createRequestContext as _createRequestContext } from '../lib/observability';

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

async function hashToken(token: string): Promise<string> {
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

  const user = await queryFirst<{ id: string; email: string; global_role: 'admin' | 'editor' | 'reader' }>(
    env,
    `SELECT id, email, global_role
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

  // Update last used time (non-blocking)
  execute(
    env,
    `UPDATE admin_sessions SET last_used_at = datetime('now') WHERE id = ?`,
    [session.id],
  ).catch(() => {});

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
    `INSERT INTO admin_sessions (id, user_id, token_hash, expires_at, created_at, last_used_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, user.id, tokenHash, expiresAt, now, now],
  );

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

export async function initializeAdminUser(
  env: Env,
  email: string,
  password: string,
  displayName?: string,
): Promise<string> {
  const existing = await queryFirst<{ id: string }>(
    env,
    `SELECT id FROM users WHERE email = ?`,
    [email.toLowerCase()],
  );

  if (existing) {
    return existing.id;
  }

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  await execute(
    env,
    `INSERT INTO users (id, email, display_name, global_role, password_hash, created_at, updated_at)
     VALUES (?, ?, ?, 'admin', ?, ?, ?)`,
    [id, email.toLowerCase(), displayName || 'Admin', passwordHash, now, now],
  );

  return id;
}

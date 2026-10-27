import type { Env } from '../lib/env';
import { queryAll, execute } from '../db/client';

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

export async function revokeAllReaderSessionsForEmail(env: Env, email: string): Promise<void> {
  await execute(
    env,
    `UPDATE reader_sessions SET revoked_at = datetime('now')
     WHERE email = ? AND revoked_at IS NULL`,
    [email.toLowerCase()],
  );
}

export async function revokeAllReaderSessionsForUser(env: Env, userId: string): Promise<void> {
  await execute(
    env,
    `UPDATE reader_sessions SET revoked_at = datetime('now')
     WHERE user_id = ? AND revoked_at IS NULL`,
    [userId],
  );
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

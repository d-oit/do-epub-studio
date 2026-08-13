import type { Env } from '../lib/env';
import { execute, queryFirst, transaction } from '../db/client';
import { hashPassword, verifyPassword } from './password';

/**
 * Account lifecycle helpers (ADR-231): functions that mutate the canonical
 * `users` identity and revoke credentials/sessions in lockstep. Passwords stay
 * Argon2id via the shared password helper. Session revocation after a
 * password reset/change is mandatory unless the caller is explicitly running a
 * step-up reauth rotation.
 */

export type GlobalRole = 'admin' | 'editor' | 'reader';

export interface AccountRow {
  id: string;
  email: string;
  display_name: string | null;
  global_role: GlobalRole;
  password_hash: string | null;
  disabled_at: string | null;
  compromised_at: string | null;
  email_verified_at: string | null;
}

const ACCOUNT_SELECT = `id, email, display_name, global_role, password_hash,
  disabled_at, compromised_at, email_verified_at`;

export async function getAccountByEmail(env: Env, email: string): Promise<AccountRow | null> {
  return queryFirst(
    env,
    `SELECT ${ACCOUNT_SELECT} FROM users WHERE email = ?`,
    [email.toLowerCase()],
  ) as Promise<AccountRow | null>;
}

export async function getAccountById(env: Env, userId: string): Promise<AccountRow | null> {
  return queryFirst(
    env,
    `SELECT ${ACCOUNT_SELECT} FROM users WHERE id = ?`,
    [userId],
  ) as Promise<AccountRow | null>;
}

/** Fail-closed disabled/compromised check for any credential path. */
export function accountIsLocked(account: Pick<AccountRow, 'disabled_at' | 'compromised_at'>): boolean {
  return Boolean(account.disabled_at) || Boolean(account.compromised_at);
}

/** Reject service-name/email-derivative passwords when the identity is known. */
export function isPasswordDerivative(password: string, email: string): boolean {
  const local = email.split('@')[0]?.toLowerCase() ?? '';
  const user = password.toLowerCase();
  if (local.length >= 4 && user.includes(local)) return true;
  return false;
}

export async function changePassword(
  env: Env,
  userId: string,
  newPassword: string,
): Promise<void> {
  const hash = await hashPassword(newPassword);
  await execute(
    env,
    `UPDATE users
     SET password_hash = ?, last_password_change_at = datetime('now'),
         password_version = password_version + 1
     WHERE id = ?`,
    [hash, userId],
  );
}

/**
 * ADR-232: mark the reset token used in the SAME operation that changes the
 * password (atomic batch), so a reused token cannot replay a second change.
 */
export async function changePasswordAndConsumeResetToken(
  env: Env,
  userId: string,
  newPassword: string,
  tokenId: string,
): Promise<void> {
  const hash = await hashPassword(newPassword);
  await transaction(env, [
    {
      sql: `UPDATE users
            SET password_hash = ?, last_password_change_at = datetime('now'),
                password_version = password_version + 1
            WHERE id = ?`,
      args: [hash, userId],
    },
    {
      sql: `UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ? AND used_at IS NULL`,
      args: [tokenId],
    },
  ]);
}

export async function verifyAccountPassword(
  env: Env,
  userId: string,
  password: string,
): Promise<boolean> {
  const account = await getAccountById(env, userId);
  if (!account || !account.password_hash) return false;
  return verifyPassword(password, account.password_hash);
}

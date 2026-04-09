import type { Env } from '../lib/env';
import { queryFirst, execute } from '../db/client';
import { argon2id, argon2Verify } from 'argon2-wasm-edge';

interface GrantRow {
  id: string;
  book_id: string;
  email: string;
  password_hash: string | null;
  mode: string;
  allowed: number;
  comments_allowed: number;
  offline_allowed: number;
  expires_at: string | null;
  revoked_at: string | null;
}

interface BookRow {
  id: string;
  slug: string;
  title: string;
  author_name: string | null;
  visibility: string;
  cover_image_url: string | null;
}

const MEMORY_COST_KIB = 65536; // 64 MiB
const ITERATIONS = 3;
const PARALLELISM = 4;
const HASH_LENGTH = 32;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const hash = await argon2id({
    password,
    salt,
    iterations: ITERATIONS,
    parallelism: PARALLELISM,
    memorySize: MEMORY_COST_KIB,
    hashLength: HASH_LENGTH,
    outputType: 'encoded',
  });

  return hash;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    return await argon2Verify({
      password,
      hash: storedHash,
    });
  } catch {
    return false;
  }
}

export async function validateGrant(
  env: Env,
  bookSlug: string,
  email: string,
  password?: string,
): Promise<{ valid: boolean; grant?: GrantRow; book?: BookRow; error?: string }> {
  const book = (await queryFirst(
    env,
    `SELECT id, slug, title, author_name, visibility, cover_image_url 
     FROM books WHERE slug = ?`,
    [bookSlug],
  )) as BookRow | null;

  if (!book) {
    return { valid: false, error: 'Book not found' };
  }

  const grant = (await queryFirst(
    env,
    `SELECT id, book_id, email, password_hash, mode, allowed, comments_allowed, 
            offline_allowed, expires_at, revoked_at
     FROM book_access_grants 
     WHERE book_id = ? AND email = ? AND revoked_at IS NULL`,
    [book.id, email.toLowerCase()],
  )) as GrantRow | null;

  if (!grant) {
    return { valid: false, error: 'Access denied' };
  }

  if (!grant.allowed) {
    return { valid: false, error: 'Access denied' };
  }

  if (grant.expires_at && new Date(grant.expires_at) < new Date()) {
    return { valid: false, error: 'Access expired' };
  }

  if (grant.password_hash) {
    if (!password) {
      return { valid: false, error: 'Password required' };
    }
    const valid = await verifyPassword(password, grant.password_hash);
    if (!valid) {
      return { valid: false, error: 'Invalid password' };
    }
  }

  return { valid: true, grant, book };
}

export async function createGrant(
  env: Env,
  bookId: string,
  email: string,
  options?: {
    password?: string;
    mode?: string;
    commentsAllowed?: boolean;
    offlineAllowed?: boolean;
    expiresAt?: string;
    invitedByUserId?: string;
  },
): Promise<string> {
  const id = crypto.randomUUID();
  const passwordHash = options?.password ? await hashPassword(options.password) : null;

  await execute(
    env,
    `INSERT INTO book_access_grants 
     (id, book_id, email, password_hash, mode, comments_allowed, offline_allowed, 
      expires_at, invited_by_user_id, allowed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      id,
      bookId,
      email.toLowerCase(),
      passwordHash,
      options?.mode ?? 'private',
      options?.commentsAllowed ? 1 : 0,
      options?.offlineAllowed ? 1 : 0,
      options?.expiresAt ?? null,
      options?.invitedByUserId ?? null,
    ],
  );

  return id;
}

export async function revokeGrant(env: Env, grantId: string): Promise<void> {
  await execute(env, `UPDATE book_access_grants SET revoked_at = datetime('now') WHERE id = ?`, [
    grantId,
  ]);
}

export function computeCapabilities(grant: GrantRow) {
  return {
    canRead: grant.allowed === 1,
    canComment: grant.comments_allowed === 1,
    canHighlight: grant.comments_allowed === 1,
    canBookmark: true,
    canDownloadOffline: grant.offline_allowed === 1,
    canExportNotes: grant.comments_allowed === 1,
    canManageAccess: false,
  };
}

export async function getGrantByBookAndSession(
  env: Env,
  bookId: string,
  email: string,
): Promise<GrantRow | null> {
  return queryFirst(
    env,
    `SELECT id, book_id, email, password_hash, mode, allowed, comments_allowed, 
            offline_allowed, expires_at, revoked_at
     FROM book_access_grants 
     WHERE book_id = ? AND email = ? AND allowed = 1`,
    [bookId, email.toLowerCase()],
  ) as Promise<GrantRow | null>;
}

export async function getGrantsBySession(env: Env, email: string): Promise<GrantRow[]> {
  const { queryAll } = await import('../db/client');
  return queryAll(
    env,
    `SELECT id, book_id, email, password_hash, mode, allowed, comments_allowed, 
            offline_allowed, expires_at, revoked_at
     FROM book_access_grants 
     WHERE email = ?`,
    [email.toLowerCase()],
  ) as unknown as Promise<GrantRow[]>;
}

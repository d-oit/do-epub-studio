import type { Env } from '../lib/env';
import { queryFirst, execute } from '../db/client';

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

const ALGORITHM = 'argon2id';
const MEMORY_KIB = 65536;
const ITERATIONS = 3;
const PARALLELISM = 4;

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', passwordBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `$argon2id$v=19$m=${MEMORY_KIB},t=${ITERATIONS},p=${PARALLELISM}$${hashHex.substring(0, 22)}$${hashHex.substring(22)}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  if (!storedHash.startsWith(`$${ALGORITHM}$`)) {
    return false;
  }

  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', passwordBuffer);
  const hashArray = new Uint8Array(hashBuffer);
  const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');

  const parts = storedHash.split('$');
  const storedParams = parts[2];
  const storedSalt = parts[3];
  const storedDigest = parts[4];

  const computedDigest = hashHex.substring(22);
  
  return storedSalt + storedDigest === hashHex.substring(0, 22) + computedDigest;
}

export async function validateGrant(
  env: Env,
  bookSlug: string,
  email: string,
  password?: string
): Promise<{ valid: boolean; grant?: GrantRow; book?: BookRow; error?: string }> {
  const book = await queryFirst(
    env,
    `SELECT id, slug, title, author_name, visibility, cover_image_url 
     FROM books WHERE slug = ?`,
    [bookSlug]
  ) as BookRow | null;

  if (!book) {
    return { valid: false, error: 'Book not found' };
  }

  const grant = await queryFirst(
    env,
    `SELECT id, book_id, email, password_hash, mode, allowed, comments_allowed, 
            offline_allowed, expires_at, revoked_at
     FROM book_access_grants 
     WHERE book_id = ? AND email = ? AND revoked_at IS NULL`,
    [book.id, email.toLowerCase()]
  ) as GrantRow | null;

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
  }
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
    ]
  );

  return id;
}

export async function revokeGrant(env: Env, grantId: string): Promise<void> {
  await execute(
    env,
    `UPDATE book_access_grants SET revoked_at = datetime('now') WHERE id = ?`,
    [grantId]
  );
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

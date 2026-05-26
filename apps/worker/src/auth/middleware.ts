import type { Env } from '../lib/env';
import { queryFirst } from '../db/client';
import { validateSession, parseAuthHeader } from './session';
export { validateSession };

export interface AuthContext {
  sessionId: string;
  bookId: string;
  email: string;
  capabilities: {
    canRead: boolean;
    canComment: boolean;
    canHighlight: boolean;
    canBookmark: boolean;
    canDownloadOffline: boolean;
    canExportNotes: boolean;
    canManageAccess: boolean;
  };
}

interface GrantRow {
  id: string;
  book_id: string;
  email: string;
  mode: string;
  allowed: number;
  comments_allowed: number;
  offline_allowed: number;
  expires_at: string | null;
}

const SESSION_TOKEN_BYTES = 32;

export async function requireAuth(env: Env, request: Request): Promise<AuthContext | null> {
  const authHeader = request.headers.get('Authorization');
  const token = parseAuthHeader(authHeader);

  if (!token) {
    return null;
  }

  const result = await validateSession(env, token);

  if (!result.valid || !result.session) {
    return null;
  }

  const grant = (await queryFirst(
    env,
    `SELECT id, book_id, email, mode, allowed, comments_allowed, offline_allowed, expires_at
     FROM book_access_grants
     WHERE book_id = ? AND email = ? AND revoked_at IS NULL`,
    [result.bookId ?? null, result.session.email],
  )) as GrantRow | null;

  if (!grant || !grant.allowed) {
    return null;
  }

  // Enforce grant expiration
  if (grant.expires_at && new Date(grant.expires_at) < new Date()) {
    return null;
  }

  return {
    sessionId: result.session.id,
    bookId: result.bookId!,
    email: result.session.email,
    capabilities: {
      canRead: grant.allowed === 1,
      canComment: grant.comments_allowed === 1,
      canHighlight: grant.comments_allowed === 1,
      canBookmark: true,
      canDownloadOffline: grant.offline_allowed === 1,
      canExportNotes: grant.comments_allowed === 1,
      canManageAccess: false,
    },
  };
}

export function generateToken(): string {
  const array = new Uint8Array(SESSION_TOKEN_BYTES);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

import type { Env } from '../lib/env';
import type { JsonRow } from '../lib/env';
import { queryFirst } from '../db/client';

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
}

interface SessionRow {
  id: string;
  book_id: string;
  email: string;
  session_token_hash: string;
  expires_at: string;
  revoked_at: string | null;
}

const SESSION_TOKEN_BYTES = 32;

function parseAuthHeader(header: string | null): string | null {
  if (!header) return null;
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7);
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function validateSession(
  env: Env,
  token: string
): Promise<{ valid: boolean; session?: SessionRow; bookId?: string }> {
  const tokenHash = await hashToken(token);
  
  const session = await queryFirst(
    env,
    `SELECT id, book_id, email, session_token_hash, expires_at, revoked_at
     FROM reader_sessions 
     WHERE session_token_hash = ? AND revoked_at IS NULL`,
    [tokenHash]
  ) as SessionRow | null;

  if (!session) {
    return { valid: false };
  }

  if (new Date(session.expires_at) < new Date()) {
    return { valid: false };
  }

  return { valid: true, session, bookId: session.book_id };
}

export async function requireAuth(
  env: Env,
  request: Request
): Promise<AuthContext | null> {
  const authHeader = request.headers.get('Authorization');
  const token = parseAuthHeader(authHeader);
  
  if (!token) {
    return null;
  }

  const result = await validateSession(env, token);
  
  if (!result.valid || !result.session) {
    return null;
  }

  const grant = await queryFirst(
    env,
    `SELECT id, book_id, email, mode, allowed, comments_allowed, offline_allowed
     FROM book_access_grants 
     WHERE book_id = ? AND email = ? AND revoked_at IS NULL`,
    [result.bookId ?? null, result.session.email]
  ) as (GrantRow & JsonRow) | null;

  if (!grant || !grant.allowed) {
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
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

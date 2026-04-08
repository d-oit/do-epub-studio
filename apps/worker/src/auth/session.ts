import type { Env } from '../lib/env';
import { execute, queryFirst } from '../db/client';

interface SessionRow {
  id: string;
  book_id: string;
  email: string;
  session_token_hash: string;
  expires_at: string;
  revoked_at: string | null;
}

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_TOKEN_BYTES = 32;

export async function createSession(
  env: Env,
  bookId: string,
  email: string
): Promise<string> {
  const token = generateToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
  const id = crypto.randomUUID();

  await execute(
    env,
    `INSERT INTO reader_sessions (id, book_id, email, session_token_hash, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, bookId, email.toLowerCase(), tokenHash, expiresAt]
  );

  return token;
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

export async function revokeSession(
  env: Env,
  token: string
): Promise<void> {
  const tokenHash = await hashToken(token);
  
  await execute(
    env,
    `UPDATE reader_sessions SET revoked_at = datetime('now') WHERE session_token_hash = ?`,
    [tokenHash]
  );
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateToken(): string {
  const array = new Uint8Array(SESSION_TOKEN_BYTES);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function parseAuthHeader(header: string | null): string | null {
  if (!header) return null;
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7);
}

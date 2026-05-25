import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/client', () => ({
  queryFirst: vi.fn(),
  queryAll: vi.fn(),
  execute: vi.fn(),
}));

vi.mock('../auth/session', () => ({
  validateSession: vi.fn(),
  parseAuthHeader: vi.fn((h: string | null) => h?.replace('Bearer ', '') ?? null),
}));

import type { Mock } from 'vitest';
import { requireAuth } from '../auth/middleware';
import { queryFirst } from '../db/client';
import { validateSession, parseAuthHeader } from '../auth/session';
import type { Env } from '../lib/env';

function makeEnv(): Env {
  return {
    BOOKS_BUCKET: {
      get: async () => null,
      put: async () => null as any,
      delete: async () => undefined,
      list: async () => ({ objects: [], truncated: false }),
    },
    TURSO_DATABASE_URL: 'libsql://test.turso.io',
    TURSO_AUTH_TOKEN: 'test-token',
    SESSION_SIGNING_SECRET: 'test-secret',
    INVITE_TOKEN_SECRET: 'test-invite-secret',
    APP_BASE_URL: 'https://test.example.com',
    RATE_LIMITER: {
      idFromName: vi.fn().mockReturnValue({ toString: () => 'mock-id' }),
      get: vi.fn().mockReturnValue({
        fetch: vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ allowed: true, remaining: 99, resetAt: Date.now() + 60000 }),
        }),
      }),
    } as unknown as DurableObjectNamespace,
  };
}

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://test.example.com/api/test', {
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function makeSessionRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'session-1',
    book_id: 'book-1',
    email: 'user@example.com',
    session_token_hash: 'hash',
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    created_at: new Date().toISOString(),
    revoked_at: null,
    ...overrides,
  };
}

const mockQueryFirst = queryFirst as Mock;
const mockValidateSession = validateSession as Mock;
const mockParseAuthHeader = parseAuthHeader as Mock;

describe('requireAuth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no Authorization header', async () => {
    mockParseAuthHeader.mockReturnValue(null);
    const req = makeRequest();
    const result = await requireAuth(makeEnv(), req);
    expect(result).toBeNull();
  });

  it('returns null for invalid session', async () => {
    mockParseAuthHeader.mockReturnValue('invalid');
    mockValidateSession.mockResolvedValue({ valid: false });
    const req = makeRequest({ Authorization: 'Bearer invalid' });
    const result = await requireAuth(makeEnv(), req);
    expect(result).toBeNull();
  });

  it('returns null for expired session', async () => {
    mockParseAuthHeader.mockReturnValue('expired-session');
    mockValidateSession.mockResolvedValue({ valid: false });
    const req = makeRequest({ Authorization: 'Bearer expired-session' });
    const result = await requireAuth(makeEnv(), req);
    expect(result).toBeNull();
  });

  it('returns null for expired grant', async () => {
    mockParseAuthHeader.mockReturnValue('valid');
    mockValidateSession.mockResolvedValue({
      valid: true,
      session: makeSessionRow() as any,
      bookId: 'book-1',
    });
    mockQueryFirst.mockResolvedValue({
      id: 'grant-1',
      book_id: 'book-1',
      email: 'user@example.com',
      mode: 'private',
      allowed: 1,
      comments_allowed: 0,
      offline_allowed: 0,
      expires_at: new Date(Date.now() - 3600000).toISOString(),
    });

    const req = makeRequest({ Authorization: 'Bearer valid' });
    const result = await requireAuth(makeEnv(), req);
    expect(result).toBeNull();
  });

  it('returns context for valid session and active grant', async () => {
    mockParseAuthHeader.mockReturnValue('valid');
    mockValidateSession.mockResolvedValue({
      valid: true,
      session: makeSessionRow() as any,
      bookId: 'book-1',
    });
    mockQueryFirst.mockResolvedValue({
      id: 'grant-1',
      book_id: 'book-1',
      email: 'user@example.com',
      mode: 'private',
      allowed: 1,
      comments_allowed: 0,
      offline_allowed: 0,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    });

    const req = makeRequest({ Authorization: 'Bearer valid' });
    const result = await requireAuth(makeEnv(), req);
    expect(result).not.toBeNull();
    expect(result?.email).toBe('user@example.com');
  });

  it('returns context for valid session and grant with no expiration', async () => {
    mockParseAuthHeader.mockReturnValue('valid');
    mockValidateSession.mockResolvedValue({
      valid: true,
      session: makeSessionRow() as any,
      bookId: 'book-1',
    });
    mockQueryFirst.mockResolvedValue({
      id: 'grant-1',
      book_id: 'book-1',
      email: 'user@example.com',
      mode: 'private',
      allowed: 1,
      comments_allowed: 0,
      offline_allowed: 0,
    });

    const req = makeRequest({ Authorization: 'Bearer valid' });
    const result = await requireAuth(makeEnv(), req);
    expect(result).not.toBeNull();
    expect(result?.email).toBe('user@example.com');
  });
});

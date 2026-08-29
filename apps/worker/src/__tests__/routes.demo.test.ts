import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  makePassThroughContext,
  mockQueryFirst,
  mockGetGrantByBookAndSession,
  mockComputeCapabilities,
  mockCreateSession,
  mockCreateAdminDemoSession,
  mockLogAudit,
  mockAccountIsLocked,
} from './fixtures';
import { app } from '../app';

// Mock rate-limit-client so tests can control rate-limit behaviour.
vi.mock('../lib/rate-limit-client', () => ({
  checkRateLimitDO: vi.fn().mockResolvedValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60_000 }),
  deleteRateLimitKey: vi.fn().mockResolvedValue(undefined),
}));

import { checkRateLimitDO } from '../lib/rate-limit-client';
const mockCheckRateLimitDO = checkRateLimitDO as ReturnType<typeof vi.fn>;

import type { Env } from '../lib/env';

function makeDemoEnv(overrides: Partial<Env> = {}): Env {
  return {
    ...makeEnv(),
    DEMO_LOGIN_ENABLED: '1',
    DEMO_BOOK_SLUG: 'demo',
    ENVIRONMENT: 'development',
    ...overrides,
  };
}

const DEMO_READER_USER = {
  id: 'demo-reader-id',
  email: 'demo.reader@example.local',
  global_role: 'reader',
  created_by_demo: 1,
  disabled_at: null,
  compromised_at: null,
};

const DEMO_ADMIN_USER = {
  id: 'demo-admin-id',
  email: 'demo.admin@example.local',
  global_role: 'admin',
  created_by_demo: 1,
  disabled_at: null,
  compromised_at: null,
};

const DEMO_BOOK = {
  id: 'book-demo',
  slug: 'demo',
  title: 'Demo Book',
  author_name: 'Demo Author',
  visibility: 'public',
  cover_image_url: null,
};

const DEMO_GRANT = {
  id: 'grant-demo',
  book_id: 'book-demo',
  email: 'demo.reader@example.local',
  password_hash: null,
  mode: 'public',
  allowed: 1,
  comments_allowed: 1,
  offline_allowed: 1,
  expires_at: null,
  revoked_at: null,
};

describe('Demo Routes — POST /api/demo/reader-login', () => {
  let env: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimitDO.mockResolvedValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60_000 });
    mockAccountIsLocked.mockReturnValue(false);
    mockComputeCapabilities.mockReturnValue({
      canRead: true,
      canComment: true,
      canHighlight: true,
      canBookmark: true,
      canDownloadOffline: true,
      canExportNotes: true,
      canManageAccess: false,
    });
    env = makeDemoEnv();
  });

  it('returns 403 DEMO_DISABLED when DEMO_LOGIN_ENABLED is not "1"', async () => {
    env.DEMO_LOGIN_ENABLED = '';

    const res = await app.fetch(
      new Request('http://localhost/api/demo/reader-login', { method: 'POST' }),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(403);
    const body: { ok: boolean; data: Record<string, unknown>; error: { code: string; message?: string } } = await res.json();
    expect(body.error.code).toBe('DEMO_DISABLED');
  });

  it('returns 403 DEMO_DISABLED in production-like environment', async () => {
    env.ENVIRONMENT = 'production';

    const res = await app.fetch(
      new Request('http://localhost/api/demo/reader-login', { method: 'POST' }),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(403);
    const body: { ok: boolean; data: Record<string, unknown>; error: { code: string; message?: string } } = await res.json();
    expect(body.error.code).toBe('DEMO_DISABLED');
  });

  it('returns 403 DEMO_DISABLED when production detected via TURSO_DATABASE_URL', async () => {
    env.TURSO_DATABASE_URL = 'libsql://production-db.example.com';

    const res = await app.fetch(
      new Request('http://localhost/api/demo/reader-login', { method: 'POST' }),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(403);
    const body: { ok: boolean; data: Record<string, unknown>; error: { code: string; message?: string } } = await res.json();
    expect(body.error.code).toBe('DEMO_DISABLED');
  });

  // Fail-closed matrix pin — ADR-233 Acceptance + ADR-244 decision 3 ("refuses
  // production-like environments even when the frontend flag is enabled") and
  // ADR-244 Acceptance ("Worker tests cover ... production-like environment").
  // DEMO_ACCOUNTS_PROD_ALLOWLIST must ONLY bypass the CF_PAGES signal; it must
  // never demote ENVIRONMENT=production or a production TURSO_DATABASE_URL.
  it('returns 403 DEMO_DISABLED when ENVIRONMENT=production AND DEMO_ACCOUNTS_PROD_ALLOWLIST is set (allowlist must not bypass ENVIRONMENT)', async () => {
    env.ENVIRONMENT = 'production';
    env.DEMO_ACCOUNTS_PROD_ALLOWLIST = 'demo-preview';

    const res = await app.fetch(
      new Request('http://localhost/api/demo/reader-login', { method: 'POST' }),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(403);
    const body: { ok: boolean; data: Record<string, unknown>; error: { code: string; message?: string } } = await res.json();
    expect(body.error.code).toBe('DEMO_DISABLED');
    // App-level middleware (middleware/rate-limit.ts) calls checkRateLimitDO once
    // per request before route gates run; a second call would mean checkDemoGates
    // passed the env gate and reached its own rate-limit step. Exactly one call
    // therefore pins that the production gate fired before any route work.
    expect(mockCheckRateLimitDO).toHaveBeenCalledTimes(1);
    // No DB lookups or session minting may happen when the env gate fires.
    expect(mockQueryFirst).not.toHaveBeenCalled();
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('returns 403 DEMO_DISABLED when a production TURSO_DATABASE_URL is set alongside DEMO_ACCOUNTS_PROD_ALLOWLIST', async () => {
    env.TURSO_DATABASE_URL = 'libsql://production-db.example.com';
    env.DEMO_ACCOUNTS_PROD_ALLOWLIST = 'demo-preview';

    const res = await app.fetch(
      new Request('http://localhost/api/demo/reader-login', { method: 'POST' }),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(403);
    const body: { ok: boolean; data: Record<string, unknown>; error: { code: string; message?: string } } = await res.json();
    expect(body.error.code).toBe('DEMO_DISABLED');
    expect(mockQueryFirst).not.toHaveBeenCalled();
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('still mints a reader session when CF_PAGES=1 is explicitly allowlisted (legitimate bypass stays live)', async () => {
    env.CF_PAGES = '1';
    env.DEMO_ACCOUNTS_PROD_ALLOWLIST = 'demo-preview';
    mockQueryFirst.mockResolvedValueOnce(DEMO_READER_USER); // user lookup
    mockQueryFirst.mockResolvedValueOnce(DEMO_BOOK); // book lookup
    mockGetGrantByBookAndSession.mockResolvedValue(DEMO_GRANT);
    mockCreateSession.mockResolvedValue({ token: 'demo-session-token', expiresAt: '2030-01-01T00:00:00.000Z' });

    const res = await app.fetch(
      new Request('http://localhost/api/demo/reader-login', { method: 'POST' }),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(200);
    const body: {
      ok: boolean;
      data: {
        sessionToken: string;
        book: { slug: string };
      };
    } = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.sessionToken).toBe('demo-session-token');
    expect(body.data.book.slug).toBe('demo');
  });

  it('returns 403 DEMO_DISABLED when demo reader account does not exist', async () => {
    mockQueryFirst.mockResolvedValueOnce(null);

    const res = await app.fetch(
      new Request('http://localhost/api/demo/reader-login', { method: 'POST' }),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(403);
    const body: { ok: boolean; data: Record<string, unknown>; error: { code: string; message?: string } } = await res.json();
    expect(body.error.code).toBe('DEMO_DISABLED');
  });

  it('returns 403 DEMO_DISABLED when account is not marked created_by_demo', async () => {
    mockQueryFirst.mockResolvedValueOnce({ ...DEMO_READER_USER, created_by_demo: 0 });

    const res = await app.fetch(
      new Request('http://localhost/api/demo/reader-login', { method: 'POST' }),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(403);
    const body: { ok: boolean; data: Record<string, unknown>; error: { code: string; message?: string } } = await res.json();
    expect(body.error.code).toBe('DEMO_DISABLED');
  });

  it('returns 403 DEMO_DISABLED when account is locked (disabled)', async () => {
    mockAccountIsLocked.mockReturnValue(true);
    mockQueryFirst.mockResolvedValueOnce({
      ...DEMO_READER_USER,
      disabled_at: '2026-01-01T00:00:00Z',
    });

    const res = await app.fetch(
      new Request('http://localhost/api/demo/reader-login', { method: 'POST' }),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(403);
    const body: { ok: boolean; data: Record<string, unknown>; error: { code: string; message?: string } } = await res.json();
    expect(body.error.code).toBe('DEMO_DISABLED');
  });

  it('returns 403 DEMO_DISABLED when demo book or grant is missing', async () => {
    mockQueryFirst.mockResolvedValueOnce(DEMO_READER_USER); // user lookup
    mockQueryFirst.mockResolvedValueOnce(null); // book lookup — not found

    const res = await app.fetch(
      new Request('http://localhost/api/demo/reader-login', { method: 'POST' }),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(403);
    const body: { ok: boolean; data: Record<string, unknown>; error: { code: string; message?: string } } = await res.json();
    expect(body.error.code).toBe('DEMO_DISABLED');
  });

  it('returns 403 DEMO_DISABLED when demo reader grant is missing', async () => {
    mockQueryFirst.mockResolvedValueOnce(DEMO_READER_USER); // user lookup
    mockQueryFirst.mockResolvedValueOnce(DEMO_BOOK); // book lookup
    mockGetGrantByBookAndSession.mockResolvedValue(null); // no live grant

    const res = await app.fetch(
      new Request('http://localhost/api/demo/reader-login', { method: 'POST' }),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(403);
    const body: { ok: boolean; data: Record<string, unknown>; error: { code: string; message?: string } } = await res.json();
    expect(body.error.code).toBe('DEMO_DISABLED');
  });

  it('mints a reader session via direct grant lookup even when the demo grant has a password hash (no password shipped)', async () => {
    mockQueryFirst.mockResolvedValueOnce(DEMO_READER_USER); // user lookup
    mockQueryFirst.mockResolvedValueOnce(DEMO_BOOK); // book lookup
    // Password-protected demo grant (ADR-233 seeds a reader password) — the demo
    // login must still mint a session without the operator password (server-minted).
    mockGetGrantByBookAndSession.mockResolvedValue({ ...DEMO_GRANT, password_hash: 'argon2-hash', mode: 'password_protected' });
    mockCreateSession.mockResolvedValue({ token: 'demo-session-token', expiresAt: '2030-01-01T00:00:00.000Z' });

    const res = await app.fetch(
      new Request('http://localhost/api/demo/reader-login', { method: 'POST' }),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(200);
    const body: {
      ok: boolean;
      data: {
        sessionToken: string;
        book: { slug: string; title: string };
        capabilities: { canRead: boolean } | null;
      };
    } = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.sessionToken).toBe('demo-session-token');
    expect(body.data.book.slug).toBe('demo');
    expect(body.data.book.title).toBe('Demo Book');
    expect(body.data.capabilities).toBeDefined();

    // Audit log must record the demo login event
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'demo_reader_login',
        actorEmail: 'demo.reader@example.local',
      }),
      expect.anything(),
    );
  });

  it('returns 429 when rate-limited', async () => {
    mockCheckRateLimitDO.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 });

    const res = await app.fetch(
      new Request('http://localhost/api/demo/reader-login', { method: 'POST' }),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(429);
    const body: { ok: boolean; data: Record<string, unknown>; error: { code: string; message?: string } } = await res.json();
    expect(body.error.code).toBe('TOO_MANY_REQUESTS');
  });
});

describe('Demo Routes — POST /api/demo/admin-login', () => {
  let env: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimitDO.mockResolvedValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60_000 });
    mockAccountIsLocked.mockReturnValue(false);
    env = makeDemoEnv();
  });

  it('returns 403 DEMO_DISABLED when DEMO_LOGIN_ENABLED is not "1"', async () => {
    env.DEMO_LOGIN_ENABLED = '';

    const res = await app.fetch(
      new Request('http://localhost/api/demo/admin-login', { method: 'POST' }),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(403);
    const body: { ok: boolean; data: Record<string, unknown>; error: { code: string; message?: string } } = await res.json();
    expect(body.error.code).toBe('DEMO_DISABLED');
  });

  it('returns 403 DEMO_DISABLED in production-like environment', async () => {
    env.ENVIRONMENT = 'production';

    const res = await app.fetch(
      new Request('http://localhost/api/demo/admin-login', { method: 'POST' }),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(403);
    const body: { ok: boolean; data: Record<string, unknown>; error: { code: string; message?: string } } = await res.json();
    expect(body.error.code).toBe('DEMO_DISABLED');
  });

  it('returns 403 DEMO_DISABLED when ENVIRONMENT=production AND DEMO_ACCOUNTS_PROD_ALLOWLIST is set (allowlist must not bypass ENVIRONMENT)', async () => {
    env.ENVIRONMENT = 'production';
    env.DEMO_ACCOUNTS_PROD_ALLOWLIST = 'demo-preview';

    const res = await app.fetch(
      new Request('http://localhost/api/demo/admin-login', { method: 'POST' }),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(403);
    const body: { ok: boolean; data: Record<string, unknown>; error: { code: string; message?: string } } = await res.json();
    expect(body.error.code).toBe('DEMO_DISABLED');
    // App-level middleware (middleware/rate-limit.ts) calls checkRateLimitDO once
    // per request before route gates run; a second call would mean checkDemoGates
    // passed the env gate and reached its own rate-limit step. Exactly one call
    // therefore pins that the production gate fired before any route work.
    expect(mockCheckRateLimitDO).toHaveBeenCalledTimes(1);
    expect(mockQueryFirst).not.toHaveBeenCalled();
    expect(mockCreateAdminDemoSession).not.toHaveBeenCalled();
  });

  it('returns 403 DEMO_DISABLED when demo admin account does not exist', async () => {
    mockQueryFirst.mockResolvedValueOnce(null);

    const res = await app.fetch(
      new Request('http://localhost/api/demo/admin-login', { method: 'POST' }),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(403);
    const body: { ok: boolean; data: Record<string, unknown>; error: { code: string; message?: string } } = await res.json();
    expect(body.error.code).toBe('DEMO_DISABLED');
  });

  it('returns 403 DEMO_DISABLED when account is not marked created_by_demo', async () => {
    mockQueryFirst.mockResolvedValueOnce({ ...DEMO_ADMIN_USER, created_by_demo: 0 });

    const res = await app.fetch(
      new Request('http://localhost/api/demo/admin-login', { method: 'POST' }),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(403);
    const body: { ok: boolean; data: Record<string, unknown>; error: { code: string; message?: string } } = await res.json();
    expect(body.error.code).toBe('DEMO_DISABLED');
  });

  it('returns 403 DEMO_DISABLED when account is locked (compromised)', async () => {
    mockAccountIsLocked.mockReturnValue(true);
    mockQueryFirst.mockResolvedValueOnce({
      ...DEMO_ADMIN_USER,
      compromised_at: '2026-01-01T00:00:00Z',
    });

    const res = await app.fetch(
      new Request('http://localhost/api/demo/admin-login', { method: 'POST' }),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(403);
    const body: { ok: boolean; data: Record<string, unknown>; error: { code: string; message?: string } } = await res.json();
    expect(body.error.code).toBe('DEMO_DISABLED');
  });

  it('returns 403 DEMO_DISABLED when account role is not admin', async () => {
    mockQueryFirst.mockResolvedValueOnce({ ...DEMO_ADMIN_USER, global_role: 'reader' });

    const res = await app.fetch(
      new Request('http://localhost/api/demo/admin-login', { method: 'POST' }),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(403);
    const body: { ok: boolean; data: Record<string, unknown>; error: { code: string; message?: string } } = await res.json();
    expect(body.error.code).toBe('DEMO_DISABLED');
  });

  it('mints an admin session and returns the same DTO as /api/admin/login', async () => {
    mockQueryFirst.mockResolvedValueOnce(DEMO_ADMIN_USER);
    mockCreateAdminDemoSession.mockResolvedValue({
      ok: true,
      token: 'demo-admin-token',
      user: { id: DEMO_ADMIN_USER.id, email: DEMO_ADMIN_USER.email, role: 'admin' },
    });

    const res = await app.fetch(
      new Request('http://localhost/api/demo/admin-login', { method: 'POST' }),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(200);
    const body: {
      ok: boolean;
      data: {
        token: string;
        user: { id: string; email: string; role: string };
      };
    } = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.token).toBe('demo-admin-token');
    expect(body.data.user.email).toBe('demo.admin@example.local');
    expect(body.data.user.role).toBe('admin');

    expect(mockCreateAdminDemoSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: DEMO_ADMIN_USER.id, email: DEMO_ADMIN_USER.email, role: 'admin' }),
      expect.objectContaining({ ipHash: expect.any(String) }),
    );

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'demo_admin_login',
        actorEmail: 'demo.admin@example.local',
      }),
      expect.anything(),
    );
  });

  it('returns 429 when rate-limited', async () => {
    mockCheckRateLimitDO.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 });

    const res = await app.fetch(
      new Request('http://localhost/api/demo/admin-login', { method: 'POST' }),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(429);
    const body: { ok: boolean; data: Record<string, unknown>; error: { code: string; message?: string } } = await res.json();
    expect(body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('returns 403 DEMO_DISABLED when a demo admin is MFA-enrolled (no password-assurance bypass)', async () => {
    mockQueryFirst.mockResolvedValueOnce(DEMO_ADMIN_USER); // user lookup
    // createAdminDemoSession refuses when the account is MFA-enrolled.
    mockCreateAdminDemoSession.mockResolvedValue({ ok: false, status: 403, error: 'Demo admin must complete multi-factor authentication.' });

    const res = await app.fetch(
      new Request('http://localhost/api/demo/admin-login', { method: 'POST' }),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(403);
    const body: { ok: boolean; data: Record<string, unknown>; error: { code: string; message?: string } } = await res.json();
    expect(body.error.code).toBe('DEMO_DISABLED');
  });
});

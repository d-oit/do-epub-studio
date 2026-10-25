import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateGrant } from '../auth/password';
import { createAdminSession } from '../auth/admin-middleware';
import { DEMO_ADMIN_EMAIL, DEMO_READER_EMAIL } from '../lib/demo-policy';
import type { Env } from '../lib/env';
import * as db from '../db/client';

const queryFirst = vi.hoisted(() => vi.fn());
vi.mock('../db/client', () => ({
  queryFirst,
  queryAll: vi.fn().mockResolvedValue([]),
  execute: vi.fn().mockResolvedValue({ rows: [] }),
  transaction: vi.fn(),
}));
vi.mock('argon2-wasm-edge', () => ({ argon2Verify: vi.fn().mockResolvedValue(true) }));

function prepareAccounts(
  email = DEMO_ADMIN_EMAIL,
  createdByDemo = 1,
  accountState: { disabled_at?: string; compromised_at?: string } = {},
): void {
  queryFirst.mockImplementation((_env: Env, sql: string) => {
    if (sql.includes('FROM books')) {
      return Promise.resolve({ id: 'book-demo', slug: 'demo' });
    }
    if (sql.includes('FROM book_access_grants')) {
      return Promise.resolve({
        id: 'grant-demo',
        book_id: 'book-demo',
        allowed: 1,
        password_hash: 'test-hash',
        expires_at: null,
        revoked_at: null,
      });
    }
    if (sql.includes('created_by_demo') && sql.includes('FROM users')) {
      return Promise.resolve({
        id: 'user-demo',
        email,
        global_role: 'admin',
        password_hash: 'test-hash',
        created_by_demo: createdByDemo,
        disabled_at: null,
        compromised_at: null,
        ...accountState,
      });
    }
    return Promise.resolve(null);
  });
}

describe('published demo credentials obey deployment policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prepareAccounts();
  });

  it.each([
    { ENVIRONMENT: 'production', DEMO_LOGIN_ENABLED: '1', DEMO_ACCOUNTS_PROD_ALLOWLIST: 'preview' },
    { ENVIRONMENT: 'Production', DEMO_LOGIN_ENABLED: '1' },
    { ENVIRONMENT: 'preview', DEMO_LOGIN_ENABLED: '' },
    { CF_PAGES: '1', DEMO_LOGIN_ENABLED: '1' },
    { DEMO_LOGIN_ENABLED: '1', TURSO_DATABASE_URL: 'libsql://production.example' },
  ])('rejects normal-form demo sign-in when the deployment disables it: %j', async (config) => {
    const env = config as Env;
    const reader = await validateGrant(env, 'demo', DEMO_READER_EMAIL, 'public-demo-password');
    const admin = await createAdminSession(env, DEMO_ADMIN_EMAIL, 'public-demo-password');
    expect(reader).toEqual({ valid: false, error: 'Access denied' });
    expect(admin).toEqual({ ok: false, status: 401, error: 'Invalid credentials' });
    expect(db.execute).not.toHaveBeenCalled();
  });

  it.each([
    { ENVIRONMENT: 'local', DEMO_LOGIN_ENABLED: '1' },
    {
      ENVIRONMENT: 'preview',
      CF_PAGES: '1',
      DEMO_LOGIN_ENABLED: '1',
      DEMO_ACCOUNTS_PROD_ALLOWLIST: 'demo-preview',
    },
  ])('allows normal-form demo sign-in on an eligible deployment: %j', async (config) => {
    const env = config as Env;
    expect((await validateGrant(env, 'demo', DEMO_READER_EMAIL, 'demo-password')).valid).toBe(true);
    const admin = await createAdminSession(env, DEMO_ADMIN_EMAIL, 'demo-password');
    expect(admin.ok).toBe(true);
    expect(db.execute).toHaveBeenCalledWith(
      env,
      expect.stringContaining('INSERT INTO admin_sessions'),
      expect.any(Array),
    );
  });

  it('rejects a marked demo administrator even when its email is not reserved', async () => {
    prepareAccounts('renamed-demo@example.local');
    const result = await createAdminSession(
      { ENVIRONMENT: 'production' } as Env,
      'renamed-demo@example.local',
      'demo-password',
    );
    expect(result).toEqual({ ok: false, status: 401, error: 'Invalid credentials' });
    expect(db.execute).not.toHaveBeenCalled();
  });

  it.each([
    { createdByDemo: 0, state: {} },
    { createdByDemo: 1, state: { disabled_at: 'disabled' } },
    { createdByDemo: 1, state: { compromised_at: 'compromised' } },
  ])(
    'does not bypass reader demo account state through the normal form: %j',
    async ({ createdByDemo, state }) => {
      prepareAccounts(DEMO_READER_EMAIL, createdByDemo, state);
      const env = { ENVIRONMENT: 'local', DEMO_LOGIN_ENABLED: '1' } as Env;
      expect(await validateGrant(env, 'demo', DEMO_READER_EMAIL, 'demo-password')).toEqual({
        valid: false,
        error: 'Access denied',
      });
      expect(db.execute).not.toHaveBeenCalled();
    },
  );

  it('preserves ordinary reader and admin sign-in when demos are disabled', async () => {
    prepareAccounts('admin@example.com', 0);
    const env = { ENVIRONMENT: 'production' } as Env;
    expect((await validateGrant(env, 'demo', 'reader@example.com', 'reader-password')).valid).toBe(
      true,
    );
    expect((await createAdminSession(env, 'admin@example.com', 'admin-password')).ok).toBe(true);
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  seedDemoAccounts,
  checkGuards,
  isProductionLike,
  RESERVED,
} from '../seed-demo-accounts.mjs';

// Test-only fixture credentials — never real secrets. Demo users are provisioned
// with documented public passwords (demo-admin-password / demo-reader-password)
// that operators may override via DEMO_ADMIN_PASSWORD/DEMO_READER_PASSWORD env
// vars. Passwords are only ever stored as Argon2id hashes (ADR-233), and the
// seed refuses production-like environments.
const ADMIN_SECRET = 'TEST-ONLY-admin-fixture-pass';
const READER_SECRET = 'TEST-ONLY-reader-fixture-pass';
const MOCK_HASH = 'argon2id$MOCK$hash';

function env(overrides = {}) {
  return {
    DEMO_ACCOUNTS_ENABLED: '1',
    ENVIRONMENT: 'local',
    DEMO_ADMIN_PASSWORD: ADMIN_SECRET,
    DEMO_READER_PASSWORD: READER_SECRET,
    ...overrides,
  };
}

function makeDb() {
  const calls = [];
  const db = async (sql, args = []) => {
    calls.push({ sql, args });
    if (sql.includes('FROM books')) return { rows: [{ id: 'book-1' }] };
    if (sql.includes('FROM users')) return { rows: [] };
    return { rows: [] };
  };
  return { db, calls };
}

const mockHash = async () => MOCK_HASH;

describe('seed-demo-accounts.mjs (ADR-233)', () => {
  let prevExitCode;
  beforeEach(() => {
    prevExitCode = process.exitCode;
  });
  afterEach(() => {
    process.exitCode = prevExitCode;
  });

  describe('isProductionLike', () => {
    it('flags ENVIRONMENT === production', () => {
      expect(isProductionLike({ ENVIRONMENT: 'production' })).toBe(true);
    });
    it('flags TURSO_DATABASE_URL containing production', () => {
      expect(
        isProductionLike({
          TURSO_DATABASE_URL: 'https://production-instance.turso.io',
        }),
      ).toBe(true);
    });
    it('flags CF_PAGES=1 without an explicit allowlist', () => {
      expect(isProductionLike({ CF_PAGES: '1' })).toBe(true);
      expect(
        isProductionLike({ CF_PAGES: '1', DEMO_ACCOUNTS_PROD_ALLOWLIST: 'staging' }),
      ).toBe(false);
    });
    it('does not flag a local env', () => {
      expect(isProductionLike({ ENVIRONMENT: 'local' })).toBe(false);
    });
  });

  describe('fail-closed guards', () => {
    it('refuses when DEMO_ACCOUNTS_ENABLED !== "1" and writes nothing', async () => {
      const { db, calls } = makeDb();
      const result = await seedDemoAccounts({
        db,
        hasPassword: mockHash,
        env: env({ DEMO_ACCOUNTS_ENABLED: '0' }),
      });
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/DEMO_ACCOUNTS_ENABLED/);
      expect(process.exitCode).toBe(1);
      expect(calls).toHaveLength(0);
    });

    it('refuses when the environment is production', async () => {
      const { db, calls } = makeDb();
      const result = await seedDemoAccounts({
        db,
        hasPassword: mockHash,
        env: env({ ENVIRONMENT: 'production' }),
      });
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/production/i);
      expect(process.exitCode).toBe(1);
      expect(calls).toHaveLength(0);
    });

    it('flagging a production TURSO_DATABASE_URL fails closed', async () => {
      const result = await seedDemoAccounts({
        db: makeDb().db,
        hasPassword: mockHash,
        env: env({ TURSO_DATABASE_URL: 'libsql://production.x.turso.io' }),
      });
      expect(result.ok).toBe(false);
    });

    it('provisions with documented default demo passwords when env passwords are absent', async () => {
      const { db, calls } = makeDb();
      const result = await seedDemoAccounts({
        db,
        hasPassword: mockHash,
        env: env({ DEMO_ADMIN_PASSWORD: undefined, DEMO_READER_PASSWORD: undefined }),
      });
      expect(result.ok).toBe(true);

      // Both demo users always get password hashes (never passwordless).
      const userWrites = calls.filter(({ sql }) => sql.includes('INSERT INTO users'));
      expect(userWrites).toHaveLength(2);
      const allArgs = JSON.stringify(calls.map((c) => c.args));
      expect(allArgs).toContain(MOCK_HASH);
    });
  });

  describe('demo account provisioning', () => {
    it('writes hashed passwords (never plaintext) and marks created_by_demo=1', async () => {
      const { db, calls } = makeDb();
      const result = await seedDemoAccounts({ db, hasPassword: mockHash, env: env() });
      expect(result.ok).toBe(true);

      const userWrites = calls.filter(({ sql }) => sql.includes('INSERT INTO users'));
      expect(userWrites).toHaveLength(2);

      const allSql = calls.map((c) => c.sql).join('\n');
      const allArgs = JSON.stringify(calls.map((c) => c.args));

      // created_by_demo forced to 1 on insert and on conflict-update.
      expect(allSql).toContain('created_by_demo');
      expect(allSql).toMatch(/created_by_demo = 1/);

      // The hashed value is written...
      expect(allArgs).toContain(MOCK_HASH);
      // ...and neither plaintext password ever reaches SQL or args.
      expect(allArgs).not.toContain(ADMIN_SECRET);
      expect(allArgs).not.toContain(READER_SECRET);
      expect(allSql).not.toContain(ADMIN_SECRET);
      expect(allSql).not.toContain(READER_SECRET);
    });

    it('uses both reserved demo emails', async () => {
      const { db, calls } = makeDb();
      await seedDemoAccounts({ db, hasPassword: mockHash, env: env() });
      const emails = calls
        .filter(({ sql }) => sql.includes('INSERT INTO users'))
        .flatMap(({ args }) => args)
        .filter((a) => typeof a === 'string' && a.includes('example.local'));
      expect(emails).toEqual(
        expect.arrayContaining([RESERVED.reader.email, RESERVED.admin.email]),
      );
    });

    it('upserts a reader grant against the demo book', async () => {
      const { db, calls } = makeDb();
      await seedDemoAccounts({ db, hasPassword: mockHash, env: env() });
      const grant = calls.find(({ sql }) => sql.includes('INSERT INTO book_access_grants'));
      expect(grant).toBeTruthy();
      expect(grant.sql).toContain('book_id');
      expect(grant.sql).toContain('mode');
    });

    it('disables the demo admin by default in non-local environments', async () => {
      const { db, calls } = makeDb();
      await seedDemoAccounts({
        db,
        hasPassword: mockHash,
        env: env({ ENVIRONMENT: 'staging' }),
      });
      const adminWrite = calls.find(
        ({ sql, args }) =>
          sql.includes('INSERT INTO users') && args.includes(RESERVED.admin.email),
      );
      // disabled_at is passed as a real timestamp for the admin in non-local.
      expect(typeof adminWrite.args[5]).toBe('string');
      expect(adminWrite.args[5]).not.toBeNull();
    });
  });

  describe('idempotent reseed', () => {
    it('revokes prior demo sessions', async () => {
      const { db, calls } = makeDb();
      await seedDemoAccounts({ db, hasPassword: mockHash, env: env() });

      const adminRevoke = calls.find(({ sql }) => sql.includes('UPDATE admin_sessions'));
      const readerRevoke = calls.find(({ sql }) => sql.includes('UPDATE reader_sessions'));

      expect(adminRevoke).toBeTruthy();
      expect(adminRevoke.sql).toContain('revoked_at');
      expect(adminRevoke.sql).toContain('user_id = ?');

      expect(readerRevoke).toBeTruthy();
      expect(readerRevoke.sql).toContain('revoked_at');
      expect(readerRevoke.sql).toContain('email = ?');
    });

    it('is safe to re-run (second run still succeeds)', async () => {
      const { db } = makeDb();
      const first = await seedDemoAccounts({ db, hasPassword: mockHash, env: env() });
      const second = await seedDemoAccounts({ db, hasPassword: mockHash, env: env() });
      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
    });
  });

  it('checkGuards is a pure predicate (returns reason string, no side effect)', () => {
    expect(checkGuards({})).toMatch(/ENABLED/);
    expect(checkGuards(env())).toBeNull();
  });
});

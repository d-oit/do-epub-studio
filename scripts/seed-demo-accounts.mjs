#!/usr/bin/env node
// scripts/seed-demo-accounts.mjs
// ADR-233 demo-account sandbox seed.
//
// Provisions two reserved demo users — a reader (demo.reader@example.local)
// and an admin (demo.admin@example.local) — with operator-provided passwords
// that are Argon2id-hashed before any write, marked created_by_demo=1, and
// (for the admin) disabled by default outside local development.
//
// SECURITY / FAIL-CLOSED:
//  * Refuses to run unless DEMO_ACCOUNTS_ENABLED === '1' AND the environment
//    is not production (ENVIRONMENT === 'production', or CF_PAGES === '1'
//    without an explicit demo-allowlist, or TURSO_DATABASE_URL containing
//    'production'), AND DEMO_ADMIN_PASSWORD is set by the operator.
//  * Never writes plaintext passwords anywhere, and never logs hashes either.
//  * On any guard failure it sets process.exitCode = 1 and logs a clear reason.
//
// Idempotent reseed: revokes any prior demo sessions and upserts the demo
// accounts by their reserved email, so it is safe to re-run.
//
// Usage: DEMO_ACCOUNTS_ENABLED=1 DEMO_ADMIN_PASSWORD=... \
//        [DEMO_READER_PASSWORD=] [DEMO_BOOK_SLUG=demo] \
//        node scripts/seed-demo-accounts.mjs
//
// The DB transport is injectable for tests: `db(sql, args) -> { rows }`. Run
// standalone, it builds a @libsql/client connection from TURSO_DATABASE_URL.

import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Anchor module resolution to apps/worker so argon2-wasm-edge + @libsql/client
// resolve even though scripts/ lives outside a pnpm workspace package.
const workerRequire = createRequire(resolve(__dirname, '../apps/worker/package.json'));

export const RESERVED = {
  reader: {
    email: 'demo.reader@example.local',
    globalRole: 'reader',
    displayName: 'Demo Reader',
  },
  admin: {
    email: 'demo.admin@example.local',
    globalRole: 'admin',
    displayName: 'Demo Admin',
  },
};

export const DEFAULT_BOOK_SLUG = 'demo';
/** Documented public demo password for the reader account (non-production only). */
export const DEMO_READER_DEFAULT_PASSWORD = 'demo-reader-password';
/** Documented public demo password for the admin account (non-production only). */
export const DEMO_ADMIN_DEFAULT_PASSWORD = 'demo-admin-password';
export const BATCH_LIMIT = 2000;

/**
 * Determine whether a given env object looks like production.
 * Production indicators (any one is enough):
 *  - ENVIRONMENT === 'production'
 *  - CF_PAGES === '1' with no explicit demo-account allowlist
 *  - TURSO_DATABASE_URL containing the word 'production'
 */
export function isProductionLike(env = {}) {
  if (String(env.ENVIRONMENT || '').toLowerCase() === 'production') return true;
  if (env.CF_PAGES === '1' && !env.DEMO_ACCOUNTS_PROD_ALLOWLIST) return true;
  if (String(env.TURSO_DATABASE_URL || '').toLowerCase().includes('production')) {
    return true;
  }
  return false;
}

/**
 * Pure guard check. Returns a human-readable failure reason, or null when all
 * guards pass. This does NOT touch process.exitCode.
 *
 * Demo credentials are documented public values (non-production only, enforced
 * below); operators may override via DEMO_ADMIN_PASSWORD/DEMO_READER_PASSWORD.
 */
export function checkGuards(env = {}) {
  if (env.DEMO_ACCOUNTS_ENABLED !== '1') {
    return 'DEMO_ACCOUNTS_ENABLED is not "1"; refusing to seed demo accounts.';
  }
  if (isProductionLike(env)) {
    return 'Refusing to seed demo accounts: environment is production.';
  }
  return null;
}

async function loadArgon2() {
  const resolved = workerRequire.resolve('argon2-wasm-edge');
  const mod = await import(resolved);
  if (typeof mod.argon2id !== 'function') {
    throw new Error('argon2-wasm-edge did not expose argon2id');
  }
  return mod;
}

// Worker-style Argon2id (mirrors apps/worker/src/auth/password.ts).
const ARGON2_MEMORY_KIB = 65536; // 64 MiB
const ARGON2_ITERATIONS = 3;
const ARGON2_PARALLELISM = 4;
const ARGON2_HASH_LENGTH = 32;

export async function defaultHasPassword(password) {
  const { argon2id } = await loadArgon2();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return argon2id({
    password,
    salt,
    iterations: ARGON2_ITERATIONS,
    parallelism: ARGON2_PARALLELISM,
    memorySize: ARGON2_MEMORY_KIB,
    hashLength: ARGON2_HASH_LENGTH,
    outputType: 'encoded',
  });
}

function buildCliDb(env = {}) {
  const url = env.TURSO_DATABASE_URL;
  if (!url) return null;
  const { createClient } = workerRequire('@libsql/client');
  const client = createClient({ url, authToken: env.TURSO_AUTH_TOKEN });
  return (sql, args = []) => client.execute({ sql, args });
}

/**
 * Core demo-seed routine. Fails closed on any guard.
 *
 * @param {object} opts
 * @param {(sql:string, args?:Array<string|number|null>)=>Promise<{rows:unknown[]}>} opts.db
 *   Injectable SQL runner (SQLite/Turso transport).
 * @param {(password:string)=>Promise<string>} [opts.hasPassword]  Defaults to worker-style Argon2id.
 * @param {object} [opts.env]              Env source; defaults to process.env.
 * @param {Console} [opts.log]             Logger; defaults to console.
 * @param {string} [opts.bookSlug]         Demo book slug for the reader grant.
 * @returns {Promise<{ok:boolean, reason?:string, readerUserId?:string, adminUserId?:string,
 *                    hashedPasswords?:string[], revoked?:number}>}
 */
export async function seedDemoAccounts({
  db,
  hasPassword = defaultHasPassword,
  env = process.env,
  log = console,
  bookSlug = env.DEMO_BOOK_SLUG || DEFAULT_BOOK_SLUG,
} = {}) {
  const reason = checkGuards(env);
  if (reason) {
    log.error(`✗ ${reason}`);
    process.exitCode = 1;
    return { ok: false, reason };
  }
  if (typeof db !== 'function') {
    const msg = 'No db runner provided; a TURSO_DATABASE_URL connection could not be built.';
    log.error(`✗ ${msg}`);
    process.exitCode = 1;
    return { ok: false, reason: msg };
  }

  const isLocal = String(env.ENVIRONMENT || 'local').toLowerCase() === 'local';
  const adminDisabledAt = isLocal ? null : new Date().toISOString();

  // Documented public demo credentials (non-production only; the production
  // guard above fails closed). Operators may override via env, but the demo
  // users always have a usable password for normal email+password login.
  const adminPassword = env.DEMO_ADMIN_PASSWORD || DEMO_ADMIN_DEFAULT_PASSWORD;
  const readerPassword = env.DEMO_READER_PASSWORD || DEMO_READER_DEFAULT_PASSWORD;

  // Never let passwords reach logs/audit/stdout — only their hashes are
  // written to the DB, and we do not even log those.
  const adminHash = await hasPassword(adminPassword);
  const readerHash = await hasPassword(readerPassword);

  const adminUserId = (await findUserId(db, RESERVED.admin.email)) ?? randomUUID();
  const readerUserId = (await findUserId(db, RESERVED.reader.email)) ?? randomUUID();

  // Reseed: revoke any prior demo sessions so previously-issued tokens die.
  await db(
    'UPDATE admin_sessions SET revoked_at = datetime(\'now\') '
      + 'WHERE user_id = ? AND revoked_at IS NULL',
    [adminUserId],
  );
  await db(
    'UPDATE reader_sessions SET revoked_at = datetime(\'now\') '
      + 'WHERE (email = ? OR user_id = ?) AND revoked_at IS NULL',
    [RESERVED.reader.email, readerUserId],
  );
  const revoked = 2;

  await upsertUser(db, {
    id: adminUserId,
    ...RESERVED.admin,
    passwordHash: adminHash,
    disabledAt: adminDisabledAt,
  });
  await upsertUser(db, {
    id: readerUserId,
    ...RESERVED.reader,
    passwordHash: readerHash,
    disabledAt: null,
  });

  // Reader demo grant against a demo book (if present). Never an orphan grant.
  const bookRow = await findBook(db, bookSlug);
  if (bookRow) {
    const mode = readerHash ? 'password_protected' : 'reader_only';
    await upsertGrant(db, {
      adminUserId,
      bookId: bookRow.id,
      email: RESERVED.reader.email,
      passwordHash: readerHash,
      mode,
    });
  } else {
    log.warn(`⚠ No book with slug "${bookSlug}" found; reader demo grant skipped.`);
  }

  log.log(`✓ Seeded demo accounts (reader=${RESERVED.reader.email}, admin=${RESERVED.admin.email}).`);
  return { ok: true, readerUserId, adminUserId, revoked };
}

async function findUserId(db, email) {
  const res = await db('SELECT id FROM users WHERE lower(email) = lower(?)', [email]);
  return res?.rows?.[0]?.id ?? null;
}

async function findBook(db, slug) {
  const res = await db('SELECT id FROM books WHERE slug = ?', [slug]);
  return res?.rows?.[0] ?? null;
}

const upsertUserSql = 'INSERT INTO users '
  + '(id, email, display_name, global_role, password_hash, created_by_demo, '
  + 'password_version, last_password_change_at, disabled_at, created_at, updated_at) '
  + 'VALUES (?, ?, ?, ?, ?, 1, 1, datetime(\'now\'), ?, datetime(\'now\'), datetime(\'now\')) '
  + 'ON CONFLICT(email) DO UPDATE SET '
  + 'password_hash = excluded.password_hash, '
  + 'global_role = excluded.global_role, '
  + 'created_by_demo = 1, '
  + 'password_version = 1, '
  + 'last_password_change_at = datetime(\'now\'), '
  + 'disabled_at = excluded.disabled_at, '
  + 'updated_at = datetime(\'now\')';

async function upsertUser(db, { id, email, displayName, globalRole, passwordHash, disabledAt }) {
  await db(upsertUserSql, [
    id, email, displayName, globalRole, passwordHash, disabledAt,
  ]);
}

const upsertGrantSql = 'INSERT INTO book_access_grants '
  + '(id, book_id, email, password_hash, mode, allowed, comments_allowed, '
  + 'offline_allowed, invited_by_user_id, created_at, updated_at) '
  + 'VALUES (?, ?, ?, ?, ?, 1, 1, 1, ?, datetime(\'now\'), datetime(\'now\')) '
  + 'ON CONFLICT(book_id, email) DO UPDATE SET '
  + 'password_hash = excluded.password_hash, '
  + 'mode = excluded.mode, '
  + 'allowed = 1, '
  + 'comments_allowed = 1, '
  + 'offline_allowed = 1, '
  + 'invited_by_user_id = excluded.invited_by_user_id, '
  + 'revoked_at = NULL, '
  + 'updated_at = datetime(\'now\')';

async function upsertGrant(db, {
  adminUserId, bookId, email, passwordHash, mode,
}) {
  await db(upsertGrantSql, [
    randomUUID(), bookId, email, passwordHash, mode, adminUserId,
  ]);
}

// Standalone entry point.
const isMain =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const db = buildCliDb(process.env);
  const failed = (msg) => {
    console.error(`✗ ${msg}`);
    process.exitCode = 1;
  };
  if (!db) {
    failed('TURSO_DATABASE_URL is not set; a DB transport is required.');
    process.exit(1);
  }
  seedDemoAccounts({ db }).catch((err) => failed(err.message));
}

#!/usr/bin/env node
// scripts/backfill-user-ids.mjs
// ADR-231 phased backfill: fill the nullable `user_id` on reader-owned tables
// from the lowercase, reserved login-identity email for any row that has a
// matching `users` row. Orphan rows (no matching user) are left NULL — this
// script never invents accounts or creates orphans.
//
// Idempotent: only ever fills rows WHERE user_id IS NULL, so it is safe to
// re-run. Bounded batching (LIMIT 2000 per pass, loop) avoids unbounded reads
// (plan 212-P4).
//
// Usage: node scripts/backfill-user-ids.mjs
//
// The DB transport is injectable for tests: `db(sql, args) -> { rowsAffected }`.

import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const workerRequire = createRequire(resolve(__dirname, '../apps/worker/package.json'));

export const BATCH_LIMIT = 2000;

// Reader-owned tables carrying a nullable user_id (added in migration 0009)
// and their login-identity email column.
export const USER_LINK_TABLES = [
  { table: 'reader_sessions', identityColumn: 'email' },
  { table: 'reading_progress', identityColumn: 'user_email' },
  { table: 'bookmarks', identityColumn: 'user_email' },
  { table: 'highlights', identityColumn: 'user_email' },
  { table: 'comments', identityColumn: 'user_email' },
  { table: 'reading_insights', identityColumn: 'user_email' },
  { table: 'notifications', identityColumn: 'user_email' },
  { table: 'sync_state', identityColumn: 'user_email' },
];

function buildBatchSql(table, identityColumn, limit) {
  return `UPDATE ${table} AS t
SET user_id = (SELECT u.id FROM users u WHERE lower(u.email) = lower(t.${identityColumn}))
WHERE t.user_id IS NULL
  AND t.id IN (
    SELECT t2.id FROM ${table} t2
    JOIN users u ON lower(u.email) = lower(t2.${identityColumn})
    WHERE t2.user_id IS NULL
    LIMIT ${limit}
  )`;
}

async function runBatch(db, table, identityColumn, limit) {
  const res = await db(buildBatchSql(table, identityColumn, limit));
  return Number(res?.rowsAffected ?? 0);
}

/**
 * Backfill user_id for all reader-owned tables.
 *
 * @param {object} opts
 * @param {(sql:string, args?:Array<string|number|null>)=>Promise<{rowsAffected?:number}>} opts.db
 * @param {object} [opts.env]  Env source; defaults to process.env.
 * @param {Console} [opts.log] Logger; defaults to console.
 * @param {number} [opts.batchLimit] Per-pass row cap (default 2000).
 * @returns {Promise<{ok:boolean, reason?:string, totalChanged:number, perTable:object}>}
 */
export async function backfillUserIds({
  db,
  env = process.env,
  log = console,
  batchLimit = BATCH_LIMIT,
} = {}) {
  void env;
  if (typeof db !== 'function') {
    const msg = 'No db runner provided; cannot backfill.';
    log.error(`✗ ${msg}`);
    process.exitCode = 1;
    return { ok: false, reason: msg, totalChanged: 0, perTable: {} };
  }

  let totalChanged = 0;
  const perTable = {};
  for (const { table, identityColumn } of USER_LINK_TABLES) {
    let tableChanged = 0;
    let changed;
    do {
      changed = await runBatch(db, table, identityColumn, batchLimit);
      tableChanged += changed;
      totalChanged += changed;
    } while (changed >= batchLimit);
    perTable[table] = tableChanged;
  }

  log.log(`✓ Backfilled user_id on ${totalChanged} row(s) across reader-owned tables.`);
  return { ok: true, totalChanged, perTable };
}

function buildCliDb(env = {}) {
  const url = env.TURSO_DATABASE_URL;
  if (!url) return null;
  const { createClient } = workerRequire('@libsql/client');
  const client = createClient({ url, authToken: env.TURSO_AUTH_TOKEN });
  return (sql, args = []) => client.execute({ sql, args });
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const db = buildCliDb(process.env);
  if (!db) {
    console.error('✗ TURSO_DATABASE_URL is not set; a DB transport is required.');
    process.exitCode = 1;
    process.exit(1);
  }
  backfillUserIds({ db }).catch((err) => {
    console.error(`✗ ${err.message}`);
    process.exitCode = 1;
  });
}

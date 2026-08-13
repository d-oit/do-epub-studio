import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { backfillUserIds, USER_LINK_TABLES, BATCH_LIMIT } from '../backfill-user-ids.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const workerRequire = createRequire(resolve(__dirname, '../../apps/worker/package.json'));

// Mocked db that captures SQL and returns a full batch on the first pass per
// table (to exercise the loop) and 0 on subsequent passes (drain).
function makeMockDb() {
  const calls = [];
  const counters = {};
  const db = async (sql) => {
    calls.push(sql);
    const hit = USER_LINK_TABLES.find((t) => sql.includes(`UPDATE ${t.table} AS t`));
    if (!hit) return { rowsAffected: 0 };
    const key = hit.table;
    counters[key] = (counters[key] ?? 0) + 1;
    return { rowsAffected: counters[key] === 1 ? BATCH_LIMIT : 0 };
  };
  return { db, calls, counters };
}

describe('backfill-user-ids.mjs (ADR-231)', () => {
  let prevExitCode;
  beforeEach(() => {
    prevExitCode = process.exitCode;
  });
  afterEach(() => {
    process.exitCode = prevExitCode;
  });

  it('processes every reader-owned table with bounded batching', async () => {
    const { db, calls, counters } = makeMockDb();
    const result = await backfillUserIds({ db });
    expect(result.ok).toBe(true);
    // One full batch + one drain pass per table.
    expect(calls).toHaveLength(USER_LINK_TABLES.length * 2);
    for (const { table } of USER_LINK_TABLES) {
      expect(counters[table]).toBe(2);
      expect(calls.filter((s) => s.includes(`UPDATE ${table} AS t`))).toHaveLength(2);
    }
    expect(result.totalChanged).toBe(USER_LINK_TABLES.length * BATCH_LIMIT);
  });

  it('only fills rows where user_id IS NULL (idempotent)', async () => {
    const { db, calls } = makeMockDb();
    await backfillUserIds({ db });
    for (const sql of calls) {
      expect(sql).toContain('WHERE t.user_id IS NULL');
    }
  });

  it('joins against users so orphan rows stay NULL', async () => {
    const { db, calls } = makeMockDb();
    await backfillUserIds({ db });
    for (const sql of calls) {
      expect(sql).toMatch(/JOIN users u ON lower\(u\.email\) = lower\(t2\./);
      expect(sql).toContain('LIMIT 2000');
    }
  });

  it('errors when no db runner is provided', async () => {
    const result = await backfillUserIds({});
    expect(result.ok).toBe(false);
    expect(process.exitCode).toBe(1);
  });

  describe('behavioural (in-memory libsql)', () => {
    // Real Turso-compatible SQLite so we can assert actual row outcomes.
    function setup() {
      const { createClient } = workerRequire('@libsql/client');
      const client = createClient({ url: 'file::memory:' });
      const db = async (sql, args = []) => client.execute({ sql, args });
      return { client, db };
    }

    it('fills matches, leaves orphans NULL, and is safe to re-run', async () => {
      const { client, db } = setup();
      await client.execute(
        'CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE);',
      );
      for (const { table, identityColumn } of USER_LINK_TABLES) {
        await client.execute(
          `CREATE TABLE ${table} (id TEXT PRIMARY KEY, ${identityColumn} TEXT, user_id TEXT);`,
        );
      }
      await client.execute("INSERT INTO users VALUES ('u1', 'reader@example.com');");
      await client.execute(
        "INSERT INTO highlights VALUES ('h-match', 'READER@example.com', NULL);",
      );
      await client.execute(
        "INSERT INTO highlights VALUES ('h-orphan', 'nobody@example.com', NULL);",
      );

      const first = await backfillUserIds({ db });
      expect(first.ok).toBe(true);

      const rows = (await client.execute('SELECT id, user_id FROM highlights ORDER BY id'))
        .rows;
      const byId = Object.fromEntries(rows.map((r) => [r.id, r.user_id]));
      // Matched (case-insensitively) got the user id; orphan stayed NULL.
      expect(byId['h-match']).toBe('u1');
      expect(byId['h-orphan']).toBeNull();

      // Re-run is idempotent: nothing else changes, no errors, zero rows touched.
      const second = await backfillUserIds({ db });
      expect(second.ok).toBe(true);
      const rows2 = (await client.execute('SELECT id, user_id FROM highlights ORDER BY id'))
        .rows;
      const byId2 = Object.fromEntries(rows2.map((r) => [r.id, r.user_id]));
      expect(byId2['h-match']).toBe('u1');
      expect(byId2['h-orphan']).toBeNull();
      expect(second.totalChanged).toBe(0);
    });

    it('only touches rows with a NULL user_id (never overwrites existing)', async () => {
      const { client, db } = setup();
      await client.execute(
        'CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE);',
      );
      for (const { table, identityColumn } of USER_LINK_TABLES) {
        await client.execute(
          `CREATE TABLE ${table} (id TEXT PRIMARY KEY, ${identityColumn} TEXT, user_id TEXT);`,
        );
      }
      await client.execute("INSERT INTO users VALUES ('u9', 'keep@example.com');");
      await client.execute(
        "INSERT INTO bookmarks VALUES ('b-keep', 'keep@example.com', 'u9');",
      );
      await backfillUserIds({ db });
      const row = (
        await client.execute("SELECT user_id FROM bookmarks WHERE id = 'b-keep'")
      ).rows[0];
      // Existing link is preserved and not rewritten.
      expect(row.user_id).toBe('u9');
    });
  });
});

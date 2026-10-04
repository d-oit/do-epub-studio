/**
 * Grant re-issue contract: `book_access_grants` is UNIQUE on (book_id, email),
 * so granting access to an email that already has a row must not attempt a
 * second INSERT. The admin UI's "revoke access, then grant again" flow hit
 * exactly that: a raw INSERT raised SQLITE_CONSTRAINT, which surfaced as a 500
 * ("An unexpected error occurred") with no way to restore the reader.
 *
 * Applies the real migration set to in-memory SQLite and exercises the real
 * `createGrant`, so the UNIQUE constraint is the production one. Argon2id is
 * mocked (as in `password-coverage.test.ts`): the real hasher runs 64 MiB × 3
 * per call, which pushed two hashes past the default 5 s test timeout on CI
 * runners and has nothing to do with the SQL contract under test.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createGrant } from '../auth/password';
import type { Env } from '../lib/env';

vi.mock('argon2-wasm-edge', () => ({
  argon2id: vi.fn(({ password }: { password: string }) => Promise.resolve(`argon2id:${password}`)),
  argon2Verify: vi.fn(({ password, hash }: { password: string; hash: string }) =>
    Promise.resolve(hash === `argon2id:${password}`),
  ),
}));

const MIGRATIONS_DIR = resolve(import.meta.dirname, '../../../../packages/schema/migrations');
const BOOK_ID = 'book-grants-reissue';
const EMAIL = 'reader@example.com';

let db: DatabaseSync;
let env: Env;

/** Minimal D1 surface used by `db/client.ts` (prepare/bind/all). */
function makeSqliteEnv(database: DatabaseSync): Env {
  const prepare = (sql: string) => ({
    bind: (...args: unknown[]) => ({
      all: () => ({ results: database.prepare(sql).all(...(args as never[])) }),
    }),
  });
  return { DB: { prepare } } as unknown as Env;
}

beforeAll(() => {
  db = new DatabaseSync(':memory:');
  for (const file of readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    db.exec(readFileSync(resolve(MIGRATIONS_DIR, file), 'utf8'));
  }
  env = makeSqliteEnv(db);
  db.prepare(
    `INSERT INTO books (id, slug, title, language, visibility) VALUES (?, ?, ?, ?, ?)`,
  ).run(BOOK_ID, 'grants-reissue', 'Grants Reissue', 'en', 'public');
});

afterAll(() => {
  db?.close();
});

function grantRows(email = EMAIL): Record<string, unknown>[] {
  return db
    .prepare('SELECT * FROM book_access_grants WHERE book_id = ? AND email = ?')
    .all(BOOK_ID, email);
}

describe('createGrant re-issue', () => {
  it('revives a revoked grant instead of inserting a duplicate', async () => {
    const originalId = await createGrant(env, BOOK_ID, EMAIL, {
      password: 'first-password',
      mode: 'password_protected',
      commentsAllowed: true,
    });
    db.prepare(`UPDATE book_access_grants SET revoked_at = ? WHERE id = ?`).run(
      new Date().toISOString(),
      originalId,
    );

    const reissuedId = await createGrant(env, BOOK_ID, EMAIL, {
      password: 'second-password',
      mode: 'password_protected',
      commentsAllowed: false,
    });

    const rows = grantRows();
    expect(rows).toHaveLength(1);
    expect(reissuedId).toBe(originalId);
    expect(rows[0].revoked_at).toBeNull();
    expect(rows[0].allowed).toBe(1);
    expect(rows[0].comments_allowed).toBe(0);
    expect(rows[0].password_hash).toBe('argon2id:second-password');
  });

  it('rejects a second active grant for the same email as a conflict', async () => {
    const email = 'conflict@example.com';
    await createGrant(env, BOOK_ID, email, { password: 'kept-password' });

    await expect(
      createGrant(env, BOOK_ID, email, { password: 'another-password' }),
    ).rejects.toMatchObject({ code: 'GRANT_EXISTS', statusCode: 409 });

    const rows = grantRows(email);
    expect(rows).toHaveLength(1);
    expect(rows[0].revoked_at).toBeNull();
    expect(rows[0].password_hash).toBe('argon2id:kept-password');
  });
});

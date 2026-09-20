/**
 * Grant re-issue contract: `book_access_grants` is UNIQUE on (book_id, email),
 * so granting access to an email that already has a row must not attempt a
 * second INSERT. The admin UI's "revoke access, then grant again" flow hit
 * exactly that: a raw INSERT raised SQLITE_CONSTRAINT, which surfaced as a 500
 * ("An unexpected error occurred") with no way to restore the reader.
 *
 * Applies the real migration set to in-memory SQLite and exercises the real
 * `createGrant`, so the UNIQUE constraint is the production one.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createGrant, verifyPassword } from '../auth/password';
import type { Env } from '../lib/env';

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
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
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

function grantRows(): Record<string, unknown>[] {
  return db
    .prepare('SELECT * FROM book_access_grants WHERE book_id = ? AND email = ?')
    .all(BOOK_ID, EMAIL);
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
    expect(await verifyPassword('second-password', String(rows[0].password_hash))).toBe(true);
    expect(await verifyPassword('first-password', String(rows[0].password_hash))).toBe(false);
  });

  it('rejects a second active grant for the same email as a conflict', async () => {
    await expect(
      createGrant(env, BOOK_ID, EMAIL, { password: 'another-password' }),
    ).rejects.toMatchObject({ code: 'GRANT_EXISTS', statusCode: 409 });

    const rows = grantRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].revoked_at).toBeNull();
    expect(await verifyPassword('another-password', String(rows[0].password_hash))).toBe(false);
  });
});

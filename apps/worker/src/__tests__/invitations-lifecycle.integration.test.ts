/**
 * Real-SQLite invitation lifecycle coverage.
 *
 * The route tests mock the D1 boundary, so this test deliberately exercises the
 * production SQL, foreign keys, token hashing, transaction batching, and
 * Argon2id call shape together. Only the expensive KDF is mocked; its input and
 * output contract remains visible to the invitation service.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  acceptBookInvitation,
  createBookInvitation,
  revokeBookInvitation,
} from '../auth/invitations';
import { createSession } from '../auth/session';
import type { Env } from '../lib/env';

vi.mock('argon2-wasm-edge', () => ({
  argon2id: vi.fn(({ password }: { password: string }) => Promise.resolve(`argon2id:${password}`)),
  argon2Verify: vi.fn(({ password, hash }: { password: string; hash: string }) =>
    Promise.resolve(hash === `argon2id:${password}`),
  ),
}));

const MIGRATIONS_DIR = resolve(import.meta.dirname, '../../../../packages/schema/migrations');
const ACCEPTED_PASSWORD = 'correct-horse-battery-staple';
const INVITEE_EMAIL = 'creator-onboarding@example.com';

type SqlValue = string | number | null;
type SqlRow = Record<string, SqlValue>;
type RunnableStatement = { run: () => unknown };

let db: DatabaseSync;
let env: Env;
let adminId: string;
let bookId: string;

function makeSqliteEnv(database: DatabaseSync): Env {
  const prepare = (sql: string) => {
    const statement = database.prepare(sql);
    return {
      bind: (...args: SqlValue[]) => ({
        all: () => ({
          results: statement.all(...args) as SqlRow[],
        }),
        run: () => {
          const result = statement.run(...args);
          return { meta: { changes: Number(result.changes) } };
        },
      }),
    };
  };

  const batch = async (statements: RunnableStatement[]) => {
    database.exec('BEGIN IMMEDIATE');
    try {
      const results: unknown[] = [];
      for (const statement of statements) {
        results.push(await statement.run());
      }
      database.exec('COMMIT');
      return results;
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  };

  return { DB: { prepare, batch } } as unknown as Env;
}

function queryRows(sql: string, ...args: SqlValue[]): SqlRow[] {
  return db.prepare(sql).all(...args) as SqlRow[];
}

function queryRow(sql: string, ...args: SqlValue[]): SqlRow | undefined {
  return db.prepare(sql).get(...args) as SqlRow | undefined;
}

beforeAll(() => {
  db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const file of readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    db.exec(readFileSync(resolve(MIGRATIONS_DIR, file), 'utf8'));
  }
  env = makeSqliteEnv(db);

  adminId = randomUUID();
  bookId = randomUUID();
  db.prepare(
    `INSERT INTO users (id, email, global_role, created_at, updated_at)
     VALUES (?, ?, 'admin', ?, ?)`,
  ).run(
    adminId,
    'onboarding-admin@example.com',
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z',
  );
  db.prepare(
    `INSERT INTO books (id, slug, title, language, visibility, created_at, updated_at)
     VALUES (?, ?, ?, 'en', 'private', ?, ?)`,
  ).run(
    bookId,
    `onboarding-${bookId}`,
    'Onboarding Verification Book',
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z',
  );
});

afterAll(() => {
  db?.close();
});

describe('book invitation lifecycle with real SQLite', () => {
  it('provisions a creator, blocks replay, and revokes all access', async () => {
    const created = await createBookInvitation(
      env,
      {
        bookId,
        email: INVITEE_EMAIL,
        role: 'creator',
        mode: 'private',
        commentsAllowed: true,
        offlineAllowed: true,
      },
      adminId,
    );

    expect(queryRows('SELECT * FROM users WHERE email = ?', INVITEE_EMAIL)).toHaveLength(0);
    expect(
      queryRows(
        'SELECT * FROM book_access_grants WHERE book_id = ? AND email = ?',
        bookId,
        INVITEE_EMAIL,
      ),
    ).toHaveLength(0);
    expect(queryRows('SELECT * FROM book_creators WHERE book_id = ?', bookId)).toHaveLength(0);

    const accepted = await acceptBookInvitation(env, {
      token: created.rawToken,
      newPassword: ACCEPTED_PASSWORD,
      newPasswordConfirm: ACCEPTED_PASSWORD,
    });

    expect(accepted).toMatchObject({
      invitationId: created.invitation.id,
      bookId,
      email: INVITEE_EMAIL,
      role: 'creator',
    });
    expect(
      queryRow('SELECT global_role, password_hash FROM users WHERE id = ?', accepted.userId),
    ).toEqual({
      global_role: 'reader',
      password_hash: null,
    });

    const grant = queryRow(
      `SELECT id, allowed, comments_allowed, offline_allowed, password_hash, revoked_at
       FROM book_access_grants WHERE id = ?`,
      accepted.grantId,
    );
    expect(grant).toMatchObject({
      id: accepted.grantId,
      allowed: 1,
      comments_allowed: 1,
      offline_allowed: 1,
      password_hash: `argon2id:${ACCEPTED_PASSWORD}`,
      revoked_at: null,
    });
    expect(
      queryRow(
        'SELECT user_id, grant_id, status FROM book_invitations WHERE id = ?',
        created.invitation.id,
      ),
    ).toMatchObject({
      user_id: accepted.userId,
      grant_id: accepted.grantId,
      status: 'accepted',
    });
    expect(
      queryRow(
        'SELECT user_id, assigned_by_user_id FROM book_creators WHERE book_id = ? AND user_id = ?',
        bookId,
        accepted.userId,
      ),
    ).toEqual({
      user_id: accepted.userId,
      assigned_by_user_id: adminId,
    });

    await expect(
      acceptBookInvitation(env, {
        token: created.rawToken,
        newPassword: ACCEPTED_PASSWORD,
        newPasswordConfirm: ACCEPTED_PASSWORD,
      }),
    ).rejects.toMatchObject({ code: 'INVITATION_INVALID', statusCode: 410 });
    expect(queryRows('SELECT * FROM users WHERE email = ?', INVITEE_EMAIL)).toHaveLength(1);
    expect(
      queryRows(
        'SELECT * FROM book_access_grants WHERE book_id = ? AND email = ?',
        bookId,
        INVITEE_EMAIL,
      ),
    ).toHaveLength(1);

    const session = await createSession(env, bookId, INVITEE_EMAIL);
    expect(session.token).toHaveLength(64);

    await revokeBookInvitation(env, bookId, created.invitation.id);

    expect(
      queryRow(
        'SELECT status, revoked_at FROM book_invitations WHERE id = ?',
        created.invitation.id,
      ),
    ).toMatchObject({
      status: 'revoked',
    });
    expect(
      queryRow('SELECT allowed, revoked_at FROM book_access_grants WHERE id = ?', accepted.grantId),
    ).toMatchObject({
      allowed: 0,
    });
    expect(
      queryRow(
        'SELECT revoked_at FROM reader_sessions WHERE session_token_hash = (SELECT session_token_hash FROM reader_sessions WHERE email = ? AND book_id = ?)',
        INVITEE_EMAIL,
        bookId,
      ),
    ).toMatchObject({
      revoked_at: expect.any(String),
    });
    expect(
      queryRows(
        'SELECT * FROM book_creators WHERE book_id = ? AND user_id = ?',
        bookId,
        accepted.userId,
      ),
    ).toHaveLength(0);
    expect(queryRows('SELECT * FROM users WHERE id = ?', accepted.userId)).toHaveLength(1);
  });
});

import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

const MIGRATIONS_DIR = resolve(import.meta.dirname, '../../../../packages/schema/migrations');
let db: DatabaseSync;

beforeAll(() => {
  db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const file of readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    db.exec(readFileSync(resolve(MIGRATIONS_DIR, file), 'utf8'));
  }
});

afterAll(() => db?.close());

function seedBookAndUser(): { bookId: string; userId: string } {
  const bookId = randomUUID();
  const userId = randomUUID();
  db.prepare(
    `INSERT INTO books (id, slug, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(bookId, `book-${bookId}`, 'Test Book', '2026-01-01', '2026-01-01');
  db.prepare(`INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)`).run(
    userId,
    `reader-${userId}@example.com`,
    '2026-01-01',
    '2026-01-01',
  );
  return { bookId, userId };
}

function insertInvitation(bookId: string, userId: string, tokenHash: string): void {
  db.prepare(
    `INSERT INTO book_invitations
      (id, book_id, email, role, token_hash, expires_at, created_by_user_id)
     VALUES (?, ?, ?, 'reader', ?, ?, ?)`,
  ).run(randomUUID(), bookId, `reader-${userId}@example.com`, tokenHash, '2099-01-01', userId);
}

describe('book invitation migration', () => {
  it('creates the invitation table and accepts the audit entity', () => {
    const table = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'book_invitations'`)
      .get();
    expect(table).toBeDefined();

    const columns = db.prepare('PRAGMA table_info(book_invitations)').all() as Array<{
      name: string;
    }>;
    expect(columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        'token_hash',
        'status',
        'delivery_status',
        'role',
        'expires_at',
        'grant_id',
      ]),
    );

    const { bookId, userId } = seedBookAndUser();
    db.prepare(
      `INSERT INTO audit_log (id, actor_email, entity_type, entity_id, action)
       VALUES (?, ?, 'book-invitation', ?, 'created')`,
    ).run(randomUUID(), 'admin@example.com', bookId);
    expect(userId).toBeTruthy();
  });

  it('allows only one pending invitation per book and email', () => {
    const { bookId, userId } = seedBookAndUser();
    insertInvitation(bookId, userId, 'hash-one');
    expect(() => insertInvitation(bookId, userId, 'hash-two')).toThrow();

    db.prepare(
      `UPDATE book_invitations SET status = 'revoked' WHERE book_id = ? AND email = ?`,
    ).run(bookId, `reader-${userId}@example.com`);
    expect(() => insertInvitation(bookId, userId, 'hash-three')).not.toThrow();
  });
});

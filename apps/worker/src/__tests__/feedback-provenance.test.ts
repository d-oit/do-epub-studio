/**
 * Provenance contract (Wave 3, COL-03): the states a reader/creator sees for an
 * item are derived at read time from the migrated schema, so they are exercised
 * here against real SQLite rather than a mocked client.
 *
 * The two facts:
 *  - `anchorState` — does the passage still match the source file it was
 *    captured from? (`resolved` / `source_changed` / `unresolved`)
 *  - `referencesDrifted` — were the reference revisions pinned at submission
 *    edited since? Items that pinned nothing never claim drift.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  computeAnchorState,
  currentReferenceRevisions,
  parseReferenceRevisions,
  referencesDrifted,
  resolveProvenance,
} from '../lib/feedback-provenance';
import type { Env } from '../lib/env';

const MIGRATIONS_DIR = resolve(import.meta.dirname, '../../../../packages/schema/migrations');
const BOOK_ID = 'book-provenance';
const FILE_ID = 'file-provenance';
const SHA = 'a'.repeat(64);

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
  ).run(BOOK_ID, 'provenance', 'Provenance', 'en', 'public');
  db.prepare(
    `INSERT INTO book_files (id, book_id, storage_key, original_filename, file_size_bytes, sha256)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(FILE_ID, BOOK_ID, 'key', 'book.epub', 1024, SHA);
  db.prepare(
    `INSERT INTO book_references (id, book_id, kind, content, origin, revision, created_by)
     VALUES (?, ?, 'glossary_term', 'Harbour terms.', 'creator', 1, 'creator@example.com')`,
  ).run('ref-1', BOOK_ID);
});

afterAll(() => {
  db?.close();
});

describe('computeAnchorState', () => {
  it('resolves when the stored evidence sha still matches the book file', async () => {
    await expect(computeAnchorState(env, {
      book_id: BOOK_ID, book_file_id: FILE_ID, source_sha256: SHA, reference_revisions: null,
    })).resolves.toBe('resolved');
  });

  it('reports source_changed when the file was replaced, and when it is gone', async () => {
    await expect(computeAnchorState(env, {
      book_id: BOOK_ID, book_file_id: FILE_ID, source_sha256: 'b'.repeat(64), reference_revisions: null,
    })).resolves.toBe('source_changed');
    await expect(computeAnchorState(env, {
      book_id: BOOK_ID, book_file_id: 'file-gone', source_sha256: SHA, reference_revisions: null,
    })).resolves.toBe('source_changed');
  });

  it('reports unresolved when the item has no source identity', async () => {
    await expect(computeAnchorState(env, {
      book_id: BOOK_ID, book_file_id: null, source_sha256: null, reference_revisions: null,
    })).resolves.toBe('unresolved');
  });
});

describe('reference revision pins', () => {
  it('lists the book\u2019s current references and their revisions', async () => {
    await expect(currentReferenceRevisions(env, BOOK_ID)).resolves.toEqual({ 'ref-1': 1 });
  });

  it('treats an edit, a deletion and an unpinned item honestly', () => {
    expect(referencesDrifted({ 'ref-1': 1 }, { 'ref-1': 1 })).toBe(false);
    expect(referencesDrifted({ 'ref-1': 1 }, { 'ref-1': 2 })).toBe(true);
    expect(referencesDrifted({ 'ref-1': 1 }, {})).toBe(true);
    expect(referencesDrifted({}, { 'ref-1': 9 })).toBe(false);
  });

  it('parses stored pins and ignores malformed payloads', () => {
    expect(parseReferenceRevisions({
      book_id: BOOK_ID, book_file_id: null, source_sha256: null,
      reference_revisions: JSON.stringify({ 'ref-1': 2 }),
    })).toEqual({ 'ref-1': 2 });
    expect(parseReferenceRevisions({
      book_id: BOOK_ID, book_file_id: null, source_sha256: null, reference_revisions: 'not json',
    })).toEqual({});
    expect(parseReferenceRevisions({
      book_id: BOOK_ID, book_file_id: null, source_sha256: null, reference_revisions: null,
    })).toEqual({});
  });

  it('resolves both facts in one pass for a pinned item', async () => {
    const provenance = await resolveProvenance(env, {
      book_id: BOOK_ID,
      book_file_id: FILE_ID,
      source_sha256: SHA,
      reference_revisions: JSON.stringify({ 'ref-1': 1 }),
    });

    expect(provenance).toEqual({
      anchorState: 'resolved',
      referencesDrifted: false,
      pinnedReferences: { 'ref-1': 1 },
    });
  });
});

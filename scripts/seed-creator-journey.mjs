#!/usr/bin/env node
// scripts/seed-creator-journey.mjs
// GOAP-1003 E3 follow-up: local-only fixtures for the real-stack creator
// authorization journey (apps/tests/creator-real-stack.spec.ts).
//
// Writes into the local D1 sqlite file that `wrangler dev` reads. It provisions:
//  * a book (slug CREATOR_JOURNEY_BOOK_SLUG, default "creator-journey"),
//  * a creator user assigned to that book via book_creators,
//  * a submitter reader grant + live reader session (token hashed with SHA-256,
//    the same scheme as apps/worker/src/auth/session.ts hashToken),
//  * one private editorial_feedback row authored by the submitter,
//  * an outsider user with no assignment and no grant.
//
// FAIL-CLOSED: refuses production-like environments and any non-file DB URL.
// The fixed session tokens are test-only and are never valid outside this local
// database. Idempotent: reruns reset the fixture rows it owns.
//
// Usage: TURSO_DATABASE_URL=file:<path-to-d1-sqlite> node scripts/seed-creator-journey.mjs

import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const BOOK_SLUG = process.env.CREATOR_JOURNEY_BOOK_SLUG ?? 'creator-journey';
export const CREATOR_EMAIL = 'journey.creator@example.local';
export const SUBMITTER_EMAIL = 'journey.submitter@example.local';
export const OUTSIDER_EMAIL = 'journey.outsider@example.local';
export const CREATOR_SESSION_TOKEN = 'journey-creator-session-token';
export const SUBMITTER_SESSION_TOKEN = 'journey-submitter-session-token';
export const OUTSIDER_SESSION_TOKEN = 'journey-outsider-session-token';
export const FEEDBACK_ID = 'journey-feedback-private-1';
export const FEEDBACK_MUTATION_ID = 'journey-feedback-mutation-1';
const BOOK_ID = 'journey-book-1';

export function sha256Hex(token) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function checkGuards(env = {}) {
  const url = env.TURSO_DATABASE_URL ?? '';
  if (env.ENVIRONMENT === 'production' || env.CF_PAGES === '1') {
    return 'refusing: production-like environment';
  }
  if (!url.startsWith('file:')) {
    return 'refusing: TURSO_DATABASE_URL must be a local file: URL';
  }
  if (/production/i.test(url)) {
    return 'refusing: database URL names production';
  }
  return null;
}

export function seed(db) {
  const now = "datetime('now')";
  const future = "datetime('now', '+1 day')";
  db.exec('BEGIN');
  try {
    // Reset fixture rows this script owns (idempotent reseed).
    db.prepare('DELETE FROM editorial_feedback WHERE id = ?').run(FEEDBACK_ID);
    db.prepare('DELETE FROM book_creators WHERE book_id = ?').run(BOOK_ID);
    db.prepare('DELETE FROM book_access_grants WHERE book_id = ?').run(BOOK_ID);
    db.prepare('DELETE FROM reader_sessions WHERE book_id = ?').run(BOOK_ID);
    db.prepare('DELETE FROM books WHERE id = ?').run(BOOK_ID);

    db.prepare(
      `INSERT INTO books (id, slug, title, visibility, created_at, updated_at)
       VALUES (?, ?, 'Creator Journey Book', 'private', ${now}, ${now})
       ON CONFLICT(id) DO UPDATE SET slug = excluded.slug`,
    ).run(BOOK_ID, BOOK_SLUG);

    for (const [id, email] of [
      ['journey-user-creator', CREATOR_EMAIL],
      ['journey-user-submitter', SUBMITTER_EMAIL],
      ['journey-user-outsider', OUTSIDER_EMAIL],
    ]) {
      db.prepare(
        `INSERT INTO users (id, email, global_role, created_at, updated_at)
         VALUES (?, ?, 'reader', ${now}, ${now})
         ON CONFLICT(email) DO NOTHING`,
      ).run(id, email);
    }

    const userId = (email) => db.prepare('SELECT id FROM users WHERE email = ?').get(email).id;

    db.prepare(
      `INSERT INTO book_creators (id, book_id, user_id, created_at)
       VALUES ('journey-assign-creator', ?, ?, ${now})`,
    ).run(BOOK_ID, userId(CREATOR_EMAIL));

    // The submitter reads the book through a grant plus a live session.
    // Every journey identity needs a live grant: requireAuth rejects a session
    // whose email has no grant on the book (apps/worker/src/auth/middleware.ts).
    // Creator-vs-submitter-vs-outsider is then decided only by book_creators and
    // by the feedback row's submitter_email, which is what the journey proves.
    const insertGrant = db.prepare(
      `INSERT INTO book_access_grants
         (id, book_id, email, password_hash, mode, allowed, comments_allowed, offline_allowed, created_at, updated_at)
       VALUES (?, ?, ?, 'journey-no-password', 'reader_only', 1, 1, 1, ${now}, ${now})`,
    );
    insertGrant.run('journey-grant-creator', BOOK_ID, CREATOR_EMAIL);
    insertGrant.run('journey-grant-submitter', BOOK_ID, SUBMITTER_EMAIL);
    insertGrant.run('journey-grant-outsider', BOOK_ID, OUTSIDER_EMAIL);

    const insertSession = db.prepare(
      `INSERT INTO reader_sessions (id, book_id, email, session_token_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, ${future}, ${now})`,
    );
    insertSession.run(
      'journey-session-creator',
      BOOK_ID,
      CREATOR_EMAIL,
      sha256Hex(CREATOR_SESSION_TOKEN),
    );
    insertSession.run(
      'journey-session-submitter',
      BOOK_ID,
      SUBMITTER_EMAIL,
      sha256Hex(SUBMITTER_SESSION_TOKEN),
    );
    insertSession.run(
      'journey-session-outsider',
      BOOK_ID,
      OUTSIDER_EMAIL,
      sha256Hex(OUTSIDER_SESSION_TOKEN),
    );

    db.prepare(
      `INSERT INTO editorial_feedback
         (id, book_id, kind, category, body, visibility, submitter_email, status, mutation_id, created_at, updated_at)
       VALUES (?, ?, 'comment', 'general', 'journey private feedback', 'private', ?, 'open', ?, ${now}, ${now})`,
    ).run(FEEDBACK_ID, BOOK_ID, SUBMITTER_EMAIL, FEEDBACK_MUTATION_ID);

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return { bookId: BOOK_ID, bookSlug: BOOK_SLUG, feedbackId: FEEDBACK_ID };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const refusal = checkGuards(process.env);
  if (refusal) {
    console.error(`✗ ${refusal}`);
    process.exitCode = 1;
  } else {
    const path = process.env.TURSO_DATABASE_URL.slice('file:'.length);
    const db = new DatabaseSync(path);
    try {
      const out = seed(db);
      console.log(`✓ creator journey seeded: ${JSON.stringify(out)}`);
    } finally {
      db.close();
    }
  }
}

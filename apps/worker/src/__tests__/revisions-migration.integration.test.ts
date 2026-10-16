import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import type { Env } from '../lib/env';
import type { AuthContext } from '../auth/middleware';
import { booksRouter } from '../routes/admin/books';
import { commentsRouter } from '../routes/comments';
import { highlightsRouter } from '../routes/reader/highlights';
import { toApiError, isAppError } from '@do-epub-studio/shared';
import { vi } from 'vitest';
import { makePassThroughContext } from './fixtures';

let currentTestBookId = '';
vi.mock('../auth/middleware', () => ({
  requireAuth: vi.fn(() =>
    Promise.resolve({
      sessionId: 'session-id',
      email: 'reader@example.com',
      bookId: currentTestBookId,
      capabilities: {
        canRead: true,
        canHighlight: true,
        canComment: true,
        canBookmark: true,
        canDownloadOffline: true,
        canExportNotes: true,
        canManageAccess: true,
      },
    }),
  ),
}));

vi.mock('../auth/admin-middleware', () => ({
  requireAdminAuth: vi.fn(() =>
    Promise.resolve({
      ok: true,
      context: { userId: 'admin-id', email: 'admin@example.com', globalRole: 'admin' },
    }),
  ),
  hashToken: vi.fn(() => 'hashed-token'),
}));

vi.mock('../middleware/step-up', () => ({
  requireStepUp: vi.fn((_c, next) => next()),
}));

const MIGRATIONS_DIR = resolve(import.meta.dirname, '../../../../packages/schema/migrations');

type SqlValue = string | number | null;
type SqlRow = Record<string, SqlValue>;
type RunnableStatement = { run: () => unknown };

let db: DatabaseSync;
let env: Env;
let bookId: string;
let initialFileId: string;
let newRevisionFileId: string;
const adminEmail = 'admin@example.com';
const readerEmail = 'reader@example.com';

function makeSqliteEnv(database: DatabaseSync): Env {
  const prepare = (sql: string) => {
    const statement = database.prepare(sql);
    return {
      bind: (...args: SqlValue[]) => ({
        all: () => {
          try {
            const results = statement.all(...args) as SqlRow[];
            return { results };
          } catch {
            const result = statement.run(...args);
            return { results: [], meta: { changes: Number(result.changes) } };
          }
        },
        run: () => {
          const result = statement.run(...args);
          return { meta: { changes: Number(result.changes) } };
        },
      }),
    };
  };

  const batch = (statements: RunnableStatement[]) => {
    database.exec('BEGIN IMMEDIATE');
    try {
      const results: unknown[] = [];
      for (const stmt of statements) {
        results.push(stmt.run());
      }
      database.exec('COMMIT');
      return results;
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  };

  return {
    DB: { prepare, batch },
    BOOKS_BUCKET: {
      delete: async () => {},
    },
  } as unknown as Env;
}

function createTestApp() {
  const app = new Hono<{
    Bindings: Env;
    Variables: {
      auth: AuthContext;
      adminUser: { email: string; id: string; role: string };
      recentStepUp: boolean;
    };
  }>();

  app.onError((err, c) => {
    const apiError = toApiError(err, 'trace-test');
    const status = isAppError(err) ? err.statusCode : 500;
    return c.json({ ok: false, error: apiError } as never, status as 400);
  });

  app.use('*', async (c, next) => {
    c.set('adminUser', { email: adminEmail, id: 'admin-id', role: 'admin' });
    c.set('recentStepUp', true);
    c.set('auth', {
      sessionId: 'session-id',
      email: readerEmail,
      bookId,
      capabilities: {
        canRead: true,
        canHighlight: true,
        canComment: true,
        canBookmark: true,
        canDownloadOffline: true,
        canExportNotes: true,
        canManageAccess: true,
      },
    });
    await next();
  });

  app.route('/api/admin/books', booksRouter);
  app.route('/api', commentsRouter);
  app.route('/api/books', highlightsRouter);

  return app;
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

  bookId = randomUUID();
  currentTestBookId = bookId;
  initialFileId = randomUUID();
  newRevisionFileId = randomUUID();

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO books (id, slug, title, language, visibility, created_at, updated_at)
     VALUES (?, ?, 'Test Architecture Book', 'en', 'private', ?, ?)`,
  ).run(bookId, `book-${bookId}`, now, now);

  db.prepare(
    `INSERT INTO book_files (id, book_id, storage_provider, storage_key, original_filename, file_size_bytes, sha256, epub_version, created_at)
     VALUES (?, ?, 'r2', 'books/1/initial.epub', 'initial.epub', 1024, 'sha-initial', '3.0', ?)`,
  ).run(initialFileId, bookId, now);

  const rev2Time = new Date(Date.now() + 60000).toISOString();
  db.prepare(
    `INSERT INTO book_files (id, book_id, storage_provider, storage_key, original_filename, file_size_bytes, sha256, epub_version, created_at)
     VALUES (?, ?, 'r2', 'books/1/rev2.epub', 'rev2.epub', 2048, 'sha-rev2', '3.0', ?)`,
  ).run(newRevisionFileId, bookId, rev2Time);
});

afterAll(() => {
  db.close();
});

describe('EPUB Revisions & Annotation Migration Integration', () => {
  it('GET /api/admin/books/:id/revisions lists all book revisions with metadata', async () => {
    const app = createTestApp();
    const res = await app.request(
      `/api/admin/books/${bookId}/revisions`,
      { method: 'GET' },
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    const body = await res.json<{
      ok: boolean;
      data: Array<{ id: string; original_filename: string }>;
    }>();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0]?.id).toBe(newRevisionFileId);
    expect(body.data[1]?.id).toBe(initialFileId);
  });

  it('migrates annotations across revisions, preserving prior anchors and reporting outcomes', async () => {
    const commentId = randomUUID();
    const movedHighlightId = randomUUID();
    const deletedCommentId = randomUUID();
    const now = new Date().toISOString();

    // Seed prior annotations
    db.prepare(
      `INSERT INTO comments (id, book_id, user_email, chapter_ref, cfi_range, selected_text, body, revision_id, created_at, updated_at)
       VALUES (?, ?, ?, 'ch1.xhtml', 'epubcfi(/6/2!/4/2)', 'Text that stays in chapter one', 'Initial comment', ?, ?, ?)`,
    ).run(commentId, bookId, readerEmail, initialFileId, now, now);

    db.prepare(
      `INSERT INTO highlights (id, book_id, user_email, chapter_ref, cfi_range, selected_text, revision_id, created_at, updated_at)
       VALUES (?, ?, ?, 'ch1.xhtml', 'epubcfi(/6/2!/4/4)', 'Text that moved to chapter two', ?, ?, ?)`,
    ).run(movedHighlightId, bookId, readerEmail, initialFileId, now, now);

    db.prepare(
      `INSERT INTO comments (id, book_id, user_email, chapter_ref, cfi_range, selected_text, body, revision_id, created_at, updated_at)
       VALUES (?, ?, ?, 'ch1.xhtml', 'epubcfi(/6/2!/4/6)', 'Text completely deleted in revision', 'Orphaned comment', ?, ?, ?)`,
    ).run(deletedCommentId, bookId, readerEmail, initialFileId, now, now);

    const app = createTestApp();

    const newSpineChapters = [
      {
        chapterRef: 'ch1.xhtml',
        content: 'Chapter 1 text here. Text that stays in chapter one is present.',
      },
      {
        chapterRef: 'ch2.xhtml',
        content: 'Chapter 2 text here. Text that moved to chapter two relocated here.',
      },
    ];

    const res = await app.request(
      `/api/admin/books/${bookId}/revisions/${newRevisionFileId}/migrate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapters: newSpineChapters }),
      },
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    const body = await res.json<{
      ok: boolean;
      data: {
        totalCount: number;
        migratedCount: number;
        orphanedCount: number;
        needsReviewCount: number;
        outcomes: Record<string, number>;
      };
    }>();

    expect(body.ok).toBe(true);
    expect(body.data.totalCount).toBe(3);
    expect(body.data.migratedCount).toBe(2);
    expect(body.data.orphanedCount).toBe(1);
    expect(body.data.needsReviewCount).toBe(0);
    expect(body.data.outcomes.exact_match).toBe(1);
    expect(body.data.outcomes.moved_text).toBe(1);
    expect(body.data.outcomes.deleted_text).toBe(1);

    // Verify comment 1 preserved original anchor metadata and updated revision
    const comment1 = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId) as Record<
      string,
      unknown
    >;
    expect(comment1.anchor_status).toBe('anchored');
    expect(comment1.migration_outcome).toBe('exact_match');
    expect(comment1.revision_id).toBe(newRevisionFileId);
    expect(comment1.original_cfi).toBe('epubcfi(/6/2!/4/2)');
    expect(comment1.original_chapter_ref).toBe('ch1.xhtml');
    expect(comment1.original_selected_text).toBe('Text that stays in chapter one');

    // Verify moved highlight relocated to ch2
    const highlight = db
      .prepare('SELECT * FROM highlights WHERE id = ?')
      .get(movedHighlightId) as Record<string, unknown>;
    expect(highlight.anchor_status).toBe('migrated');
    expect(highlight.migration_outcome).toBe('moved_text');
    expect(highlight.chapter_ref).toBe('ch2.xhtml');
    expect(highlight.original_chapter_ref).toBe('ch1.xhtml');

    // Verify deleted comment was orphaned without being silently dropped
    const deleted = db
      .prepare('SELECT * FROM comments WHERE id = ?')
      .get(deletedCommentId) as Record<string, unknown>;
    expect(deleted.anchor_status).toBe('orphaned');
    expect(deleted.confidence).toBe(0);
    expect(deleted.migration_outcome).toBe('deleted_text');
    expect(deleted.original_selected_text).toBe('Text completely deleted in revision');

    // Verify migration record was inserted
    const migrationRecord = db
      .prepare('SELECT * FROM annotation_migrations WHERE target_revision_id = ?')
      .get(newRevisionFileId) as Record<string, unknown>;
    expect(migrationRecord).toBeDefined();
    expect(migrationRecord.migrated_count).toBe(2);
    expect(migrationRecord.orphaned_count).toBe(1);

    // Verify idempotent re-run
    const retryRes = await app.request(
      `/api/admin/books/${bookId}/revisions/${newRevisionFileId}/migrate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapters: newSpineChapters }),
      },
      env,
      makePassThroughContext(),
    );
    expect(retryRes.status).toBe(200);
    const retryBody = await retryRes.json<{
      ok: boolean;
      data: { outcomes: Record<string, number> };
    }>();
    expect(retryBody.data.outcomes.already_migrated).toBe(3);
  });

  it('GET /api/books/:bookId/comments returns anchor status and filters by unanchored', async () => {
    const app = createTestApp();
    const res = await app.request(
      `/api/books/${bookId}/comments?anchorStatus=orphaned`,
      { method: 'GET' },
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    const body = await res.json<{
      ok: boolean;
      data: Array<{ anchorStatus: string; originalSelectedText: string }>;
    }>();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.anchorStatus).toBe('orphaned');
    expect(body.data[0]?.originalSelectedText).toBe('Text completely deleted in revision');
  });

  it('GET /api/books/:bookId/highlights supports filtering by anchorStatus', async () => {
    const app = createTestApp();
    const res = await app.request(
      `/api/books/${bookId}/highlights?anchorStatus=migrated`,
      { method: 'GET' },
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    const body = await res.json<{
      ok: boolean;
      data: Array<{ anchorStatus: string; chapterRef: string }>;
    }>();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.anchorStatus).toBe('migrated');
    expect(body.data[0]?.chapterRef).toBe('ch2.xhtml');
  });
});

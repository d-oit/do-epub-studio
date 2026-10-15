import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../lib/env';
import type { AuthContext } from '../auth/middleware';
import * as authMiddleware from '../auth/middleware';
import { highlightsRouter } from '../routes/reader/highlights';
import { commentsRouter } from '../routes/comments';
import { bookmarksRouter } from '../routes/reader/bookmarks';
import { progressRouter } from '../routes/reader/progress';
import { isAppError, toApiError } from '@do-epub-studio/shared';
import { makePassThroughContext } from './fixtures';
let currentTestAuth: AuthContext | null = null;
vi.spyOn(authMiddleware, 'requireAuth').mockImplementation(() => Promise.resolve(currentTestAuth));
const MIGRATIONS_DIR = resolve(import.meta.dirname, '../../../../packages/schema/migrations');

type SqlValue = string | number | null;
type SqlRow = Record<string, SqlValue>;
type RunnableStatement = { run: () => unknown };

let db: DatabaseSync;
let env: Env;
let bookId1: string;
let bookId2: string;
const user1 = 'reader-one@example.com';
const user2 = 'reader-two@example.com';

const HighlightResponseSchema = z.object({
  ok: z.boolean(),
  data: z.object({
    id: z.string(),
    chapterRef: z.string().nullable().optional(),
    cfiRange: z.string().nullable().optional(),
    selectedText: z.string(),
    note: z.string().nullable(),
    color: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
});

const CommentResponseSchema = z.object({
  ok: z.boolean(),
  data: z.object({
    id: z.string(),
    displayName: z.string(),
    isOwn: z.boolean(),
    body: z.string(),
    visibility: z.string(),
    status: z.string(),
    parentCommentId: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
});

const BookmarkResponseSchema = z.object({
  ok: z.boolean(),
  data: z.object({
    id: z.string(),
    locator: z.object({
      cfi: z.string(),
      selectedText: z.string(),
      chapterRef: z.string(),
    }),
    label: z.string().optional(),
    createdAt: z.string(),
  }),
});
const ProgressResponseSchema = z.object({
  ok: z.boolean(),
  data: z.object({
    locator: z.object({ cfi: z.string() }).nullable(),
    progressPercent: z.number(),
    updatedAt: z.string().nullable(),
    revision: z.number(),
  }),
});

const CountRowSchema = z.object({
  cnt: z.number(),
});

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

interface TestHarnessOptions {
  auth?: Partial<AuthContext>;
}

const FULL_CAPABILITIES: AuthContext['capabilities'] = {
  canRead: true,
  canHighlight: true,
  canComment: true,
  canBookmark: true,
  canDownloadOffline: true,
  canExportNotes: true,
  canManageAccess: false,
};

function createHarness(options?: TestHarnessOptions) {
  const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

  app.onError((err, c) => {
    const apiError = toApiError(err, 'trace-test');
    const status = isAppError(err) ? err.statusCode : 500;
    return c.json({ ok: false, error: apiError, status } as never, status as 400);
  });

  app.use('*', async (_c, next) => {
    const defaultAuth: AuthContext = {
      sessionId: 'test-session',
      email: user1,
      bookId: bookId1,
      capabilities: FULL_CAPABILITIES,
    };
    currentTestAuth = {
      ...defaultAuth,
      ...(options?.auth ?? {}),
      capabilities: { ...FULL_CAPABILITIES, ...(options?.auth?.capabilities ?? {}) },
    };
    await next();
  });

  app.route('/api/books', highlightsRouter);
  app.route('/api/books', bookmarksRouter);
  app.route('/api/books', progressRouter);
  app.route('/api', commentsRouter);

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

  bookId1 = randomUUID();
  bookId2 = randomUUID();

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO books (id, slug, title, language, visibility, created_at, updated_at)
     VALUES (?, ?, 'Book 1', 'en', 'private', ?, ?)`,
  ).run(bookId1, `book-${bookId1}`, now, now);

  db.prepare(
    `INSERT INTO books (id, slug, title, language, visibility, created_at, updated_at)
     VALUES (?, ?, 'Book 2', 'en', 'private', ?, ?)`,
  ).run(bookId2, `book-${bookId2}`, now, now);
});

afterAll(() => {
  db.close();
});

describe('Reader Mutation Idempotency Integration', () => {
  it('bookmarks: replays a mutation once and rejects cross-tenant reuse', async () => {
    const app = createHarness();
    const mutationId = randomUUID();
    const payload = {
      mutationId,
      locator: {
        chapterRef: 'chapter1.xhtml',
        cfi: 'epubcfi(/6/2!/4/2/1:0)',
        selectedText: 'Bookmark passage',
      },
      label: 'Original label',
    };
    const path = `/api/books/${bookId1}/bookmarks`;
    const first = await app.request(
      path,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      env,
      makePassThroughContext(),
    );
    expect(first.status).toBe(201);
    const original = BookmarkResponseSchema.parse(await first.json());

    const replay = await app.request(
      path,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, label: 'Changed label' }),
      },
      env,
      makePassThroughContext(),
    );
    expect(replay.status).toBe(200);
    const replayed = BookmarkResponseSchema.parse(await replay.json());
    expect(replayed.data.id).toBe(original.data.id);
    expect(replayed.data.label).toBe('Original label');

    const crossUserApp = createHarness({ auth: { email: user2, bookId: bookId1 } });
    const crossUserReplay = await crossUserApp.request(
      path,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      env,
      makePassThroughContext(),
    );
    expect(crossUserReplay.status).toBe(403);

    const crossBookApp = createHarness({ auth: { email: user1, bookId: bookId2 } });
    const crossBookReplay = await crossBookApp.request(
      `/api/books/${bookId2}/bookmarks`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      env,
      makePassThroughContext(),
    );
    expect(crossBookReplay.status).toBe(403);
    expect(
      db.prepare('SELECT * FROM bookmarks WHERE mutation_id = ?').all(mutationId),
    ).toHaveLength(1);
  });
  it('progress: rejects stale revisions, accepts chained updates, and replays old mutations', async () => {
    const progressEmail = `progress-${randomUUID()}@example.com`;
    const app = createHarness({ auth: { email: progressEmail, bookId: bookId1 } });
    const path = `/api/books/${bookId1}/progress`;
    const request = (method: 'GET' | 'PUT', body?: object) =>
      app.request(
        path,
        {
          method,
          ...(body
            ? {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              }
            : {}),
        },
        env,
        makePassThroughContext(),
      );

    const initial = await request('GET');
    expect(ProgressResponseSchema.parse(await initial.json()).data.revision).toBe(0);

    const firstMutationId = randomUUID();
    const firstPayload = {
      mutationId: firstMutationId,
      baseRevision: 0,
      locator: { cfi: 'epubcfi(/6/2!/4/2/1:0)' },
      progressPercent: 20,
    };
    const first = await request('PUT', firstPayload);
    expect(first.status).toBe(200);
    const firstResult = ProgressResponseSchema.parse(await first.json());
    expect(firstResult.data.revision).toBe(1);
    expect(firstResult.data.progressPercent).toBe(20);

    const replay = await request('PUT', {
      ...firstPayload,
      locator: { cfi: 'epubcfi(/6/4!/4/4/1:0)' },
      progressPercent: 95,
    });
    expect(replay.status).toBe(200);
    const replayed = ProgressResponseSchema.parse(await replay.json());
    expect(replayed.data.revision).toBe(1);
    expect(replayed.data.progressPercent).toBe(20);

    const stale = await request('PUT', {
      mutationId: randomUUID(),
      baseRevision: 0,
      locator: { cfi: 'epubcfi(/6/4!/4/4/1:0)' },
      progressPercent: 50,
    });
    expect(stale.status).toBe(409);

    const dependent = await request('PUT', {
      mutationId: randomUUID(),
      baseRevision: 0,
      dependsOnMutationId: firstMutationId,
      locator: { cfi: 'epubcfi(/6/4!/4/4/1:0)' },
      progressPercent: 70,
    });
    expect(dependent.status).toBe(200);
    expect(ProgressResponseSchema.parse(await dependent.json()).data.revision).toBe(2);

    const newest = await request('PUT', {
      mutationId: randomUUID(),
      baseRevision: 2,
      locator: { cfi: 'epubcfi(/6/6!/4/2/1:0)' },
      progressPercent: 90,
    });
    expect(newest.status).toBe(200);
    expect(ProgressResponseSchema.parse(await newest.json()).data.revision).toBe(3);

    const delayedReplay = await request('PUT', firstPayload);
    expect(delayedReplay.status).toBe(200);
    const delayedResult = ProgressResponseSchema.parse(await delayedReplay.json());
    expect(delayedResult.data.revision).toBe(1);
    expect(delayedResult.data.progressPercent).toBe(20);

    const final = ProgressResponseSchema.parse(await (await request('GET')).json());
    expect(final.data.revision).toBe(3);
    expect(final.data.progressPercent).toBe(90);
    const mutationCount = CountRowSchema.parse(
      db
        .prepare(
          'SELECT count(*) AS cnt FROM reading_progress_mutations WHERE book_id = ? AND user_email = ?',
        )
        .get(bookId1, progressEmail),
    );
    expect(mutationCount.cnt).toBe(3);
  });

  it('highlights: creates on first POST and idempotently returns existing on duplicate mutationId', async () => {
    const app = createHarness();
    const mutationId = randomUUID();
    const payload = {
      mutationId,
      locator: {
        chapterRef: 'chapter1.xhtml',
        cfi: 'epubcfi(/6/2!/4/2/1:0)',
        selectedText: 'Passage one',
      },
      note: 'My note',
      color: '#ffff00',
    };

    const res1 = await app.request(
      `/api/books/${bookId1}/highlights`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      env,
      makePassThroughContext(),
    );

    expect(res1.status).toBe(201);
    const parsed1 = HighlightResponseSchema.parse(await res1.json());
    expect(parsed1.ok).toBe(true);
    expect(parsed1.data.selectedText).toBe('Passage one');
    expect(parsed1.data.id).toBeDefined();

    const auditCountBeforeRow = CountRowSchema.parse(
      db.prepare(`SELECT count(*) as cnt FROM audit_log WHERE entity_type = 'highlight'`).get(),
    );
    const auditCountBefore = auditCountBeforeRow.cnt;
    // Repeat POST with same mutationId
    const res2 = await app.request(
      `/api/books/${bookId1}/highlights`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          note: 'Different note attempting overwrite',
        }),
      },
      env,
      makePassThroughContext(),
    );

    expect(res2.status).toBe(200);
    const parsed2 = HighlightResponseSchema.parse(await res2.json());
    expect(parsed2.ok).toBe(true);
    expect(parsed2.data.id).toBe(parsed1.data.id);
    expect(parsed2.data.note).toBe('My note'); // Preserved original

    const auditCountAfterRow = CountRowSchema.parse(
      db.prepare(`SELECT count(*) as cnt FROM audit_log WHERE entity_type = 'highlight'`).get(),
    );
    expect(auditCountAfterRow.cnt).toBe(auditCountBefore); // No double-notify/audit

    const rows = db.prepare(`SELECT * FROM highlights WHERE mutation_id = ?`).all(mutationId);
    expect(rows.length).toBe(1);
  });

  it('highlights: rejects cross-user or cross-book mutationId reuse with 403', async () => {
    const app1 = createHarness({ auth: { email: user1, bookId: bookId1 } });
    const mutationId = randomUUID();
    const payload = {
      mutationId,
      locator: {
        chapterRef: 'chapter1.xhtml',
        cfi: 'epubcfi(/6/2!/4/2/1:0)',
        selectedText: 'Passage one',
      },
    };

    const res1 = await app1.request(
      `/api/books/${bookId1}/highlights`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      env,
      makePassThroughContext(),
    );
    expect(res1.status).toBe(201);

    // Cross-user reuse
    const app2 = createHarness({ auth: { email: user2, bookId: bookId1 } });
    const res2 = await app2.request(
      `/api/books/${bookId1}/highlights`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      env,
      makePassThroughContext(),
    );
    expect(res2.status).toBe(403);

    // Cross-book reuse
    const app3 = createHarness({ auth: { email: user1, bookId: bookId2 } });
    const res3 = await app3.request(
      `/api/books/${bookId2}/highlights`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      env,
      makePassThroughContext(),
    );
    expect(res3.status).toBe(403);
  });

  it('highlights: rejects when capability is lost even on replay', async () => {
    const app1 = createHarness({
      auth: { email: user1, bookId: bookId1, capabilities: FULL_CAPABILITIES },
    });
    const mutationId = randomUUID();
    const payload = {
      mutationId,
      locator: {
        chapterRef: 'chapter1.xhtml',
        cfi: 'epubcfi(/6/2!/4/2/1:0)',
        selectedText: 'Passage one',
      },
    };

    const res1 = await app1.request(
      `/api/books/${bookId1}/highlights`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      env,
      makePassThroughContext(),
    );
    expect(res1.status).toBe(201);

    const appNoCapability = createHarness({
      auth: {
        email: user1,
        bookId: bookId1,
        capabilities: { ...FULL_CAPABILITIES, canHighlight: false },
      },
    });
    const res2 = await appNoCapability.request(
      `/api/books/${bookId1}/highlights`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      env,
      makePassThroughContext(),
    );
    expect(res2.status).toBe(403);
  });

  it('highlights: invalid UUID returns 400 and omitted mutationId creates independent rows', async () => {
    const app = createHarness();
    const resBadUuid = await app.request(
      `/api/books/${bookId1}/highlights`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mutationId: 'not-a-uuid',
          locator: {
            chapterRef: 'chapter1.xhtml',
            cfi: 'epubcfi(/6/2!/4/2/1:0)',
            selectedText: 'Passage',
          },
        }),
      },
      env,
      makePassThroughContext(),
    );
    expect(resBadUuid.status).toBe(400);

    const resNoMutation1 = await app.request(
      `/api/books/${bookId1}/highlights`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locator: {
            chapterRef: 'chapter1.xhtml',
            cfi: 'epubcfi(/6/2!/4/2/1:0)',
            selectedText: 'Passage',
          },
        }),
      },
      env,
      makePassThroughContext(),
    );
    expect(resNoMutation1.status).toBe(201);

    const resNoMutation2 = await app.request(
      `/api/books/${bookId1}/highlights`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locator: {
            chapterRef: 'chapter1.xhtml',
            cfi: 'epubcfi(/6/2!/4/2/1:0)',
            selectedText: 'Passage',
          },
        }),
      },
      env,
      makePassThroughContext(),
    );
    expect(resNoMutation2.status).toBe(201);

    const parsedNoMut1 = HighlightResponseSchema.parse(await resNoMutation1.json());
    const parsedNoMut2 = HighlightResponseSchema.parse(await resNoMutation2.json());
    expect(parsedNoMut1.data.id).not.toBe(parsedNoMut2.data.id);
  });

  it('comments: creates on first POST and idempotently returns existing on duplicate mutationId', async () => {
    const app = createHarness();
    const mutationId = randomUUID();
    const payload = {
      mutationId,
      body: 'Offline shared comment',
      locator: {
        chapterRef: 'chapter1.xhtml',
        cfi: 'epubcfi(/6/2!/4/2/1:0)',
        selectedText: 'Passage one',
      },
      visibility: 'shared',
    };

    const res1 = await app.request(
      `/api/books/${bookId1}/comments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      env,
      makePassThroughContext(),
    );

    expect(res1.status).toBe(201);
    const parsed1 = CommentResponseSchema.parse(await res1.json());
    expect(parsed1.ok).toBe(true);
    expect(parsed1.data.body).toBe('Offline shared comment');

    const auditCountBeforeRow = CountRowSchema.parse(
      db.prepare(`SELECT count(*) as cnt FROM audit_log WHERE entity_type = 'comment'`).get(),
    );
    const auditCountBefore = auditCountBeforeRow.cnt;
    const res2 = await app.request(
      `/api/books/${bookId1}/comments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          body: 'Overwritten body attempt',
        }),
      },
      env,
      makePassThroughContext(),
    );

    expect(res2.status).toBe(200);
    const parsed2 = CommentResponseSchema.parse(await res2.json());
    expect(parsed2.ok).toBe(true);
    expect(parsed2.data.id).toBe(parsed1.data.id);
    expect(parsed2.data.body).toBe('Offline shared comment');

    const auditCountAfterRow = CountRowSchema.parse(
      db.prepare(`SELECT count(*) as cnt FROM audit_log WHERE entity_type = 'comment'`).get(),
    );
    expect(auditCountAfterRow.cnt).toBe(auditCountBefore);

    const rows = db.prepare(`SELECT * FROM comments WHERE mutation_id = ?`).all(mutationId);
    expect(rows.length).toBe(1);
  });

  it('comments: rejects cross-user or cross-book mutationId reuse with 403', async () => {
    const app1 = createHarness({ auth: { email: user1, bookId: bookId1 } });
    const mutationId = randomUUID();
    const payload = {
      mutationId,
      body: 'Comment one',
    };

    const res1 = await app1.request(
      `/api/books/${bookId1}/comments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      env,
      makePassThroughContext(),
    );
    expect(res1.status).toBe(201);

    const app2 = createHarness({ auth: { email: user2, bookId: bookId1 } });
    const res2 = await app2.request(
      `/api/books/${bookId1}/comments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      env,
      makePassThroughContext(),
    );
    expect(res2.status).toBe(403);

    const app3 = createHarness({ auth: { email: user1, bookId: bookId2 } });
    const res3 = await app3.request(
      `/api/books/${bookId2}/comments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      env,
      makePassThroughContext(),
    );
    expect(res3.status).toBe(403);
  });
});

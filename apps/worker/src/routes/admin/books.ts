import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { CreateBookSchema, UpdateBookSchema } from '@do-epub-studio/shared';
import type { Env, JsonRow } from '../../lib/env';
import { execute, queryFirst, queryAll, transaction } from '../../db/client';
import { logAudit } from '../../audit';
import { UploadCompleteSchema, BookIndexSchema } from '@do-epub-studio/schema';
import { adminAuth } from '../../middleware/auth';
import { requireStepUp } from '../../middleware/step-up';
import { bumpCacheVersion } from '../../lib/edge-cache';
import { clearBookSearchIndex, replaceBookSearchIndex } from '../../lib/book-search-index';
import { NotFoundError, AppError } from '../../lib/http-errors';
import { createRequestContext, logRequestError } from '../../lib/observability';
import { handleBookFileUpload } from './books-upload';

export const booksRouter = new Hono<{
  Bindings: Env;
  Variables: { adminUser: { email: string; id: string; role: string } };
}>();

interface AdminBookRow extends JsonRow {
  id: string;
  slug: string;
  title: string;
  author_name: string | null;
  description: string | null;
  language: string;
  visibility: string;
  cover_image_url: string | null;
  published_at: string | null;
}

/**
 * Admin book inventory consumed by `AdminBookResponsesPage` and the grants
 * book selector (`fetchAdminBooks`). Archived books are excluded: archive is a
 * soft delete, so a book removed here must not reappear in either surface.
 */
booksRouter.get('/', adminAuth, async (c) => {
  const rows = await queryAll<AdminBookRow>(
    c.env,
    `SELECT id, slug, title, author_name, description, language, visibility,
            cover_image_url, published_at
     FROM books
     WHERE archived_at IS NULL
     ORDER BY created_at DESC`,
    [],
  );

  return c.json({
    ok: true,
    data: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      authorName: row.author_name ?? null,
      description: row.description ?? null,
      language: row.language,
      visibility: row.visibility,
      coverImageUrl: row.cover_image_url ?? null,
      publishedAt: row.published_at ?? null,
    })),
  });
});

booksRouter.post('/', adminAuth, zValidator('json', CreateBookSchema), async (c) => {
  const body = c.req.valid('json');
  const adminUser = c.get('adminUser');
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await execute(
    c.env,
    `INSERT INTO books (id, slug, title, author_name, description, language, visibility, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      body.slug.toLowerCase(),
      body.title,
      body.authorName ?? null,
      body.description ?? null,
      body.language ?? 'en',
      body.visibility ?? 'private',
      now,
      now,
    ],
  );

  let baseUrl = c.env.APP_BASE_URL;
  while (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }
  const uploadUrl = `${baseUrl}/api/admin/books/${id}/upload`;

  await logAudit(
    c.env,
    {
      entityType: 'book',
      entityId: id,
      action: 'created',
      actorEmail: adminUser.email,
      payload: { slug: body.slug, title: body.title },
    },
    c.executionCtx,
  );

  return c.json(
    {
      ok: true,
      data: { id, slug: body.slug, title: body.title, uploadUrl },
    },
    201,
  );
});

// ADR-234 sensitive-action "book file upload": ingests a new EPUB into R2.
booksRouter.put('/:id/upload', adminAuth, requireStepUp, handleBookFileUpload);

// ADR-234 sensitive-action "book file upload" (finalize): records the uploaded
// file row and invalidates the edge cache.
booksRouter.post(
  '/:id/upload-complete',
  adminAuth,
  requireStepUp,
  zValidator('json', UploadCompleteSchema),
  async (c) => {
    const bookId = c.req.param('id');
    const body = c.req.valid('json');
    const fileId = crypto.randomUUID();
    const now = new Date().toISOString();

    await execute(
      c.env,
      `INSERT INTO book_files (id, book_id, storage_provider, storage_key, original_filename, mime_type, file_size_bytes, sha256, epub_version, validation_results_json, created_at)
     VALUES (?, ?, 'r2', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fileId,
        bookId,
        body.storageKey,
        body.originalFilename,
        body.mimeType ?? 'application/epub+zip',
        body.fileSizeBytes ?? 0,
        body.sha256 ?? null,
        body.epubVersion ?? null,
        body.validationResults ? JSON.stringify(body.validationResults) : null,
        now,
      ],
    );
    // A replacement upload invalidates the old index; chapters in the same payload rebuild it.
    if (body.chapters && body.chapters.length > 0) {
      await replaceBookSearchIndex(c.env, bookId, body.chapters);
    } else {
      await clearBookSearchIndex(c.env, bookId);
    }

    // Invalidate edge cache so readers get the fresh EPUB content
    await bumpCacheVersion(c.env);

    await logAudit(
      c.env,
      {
        entityType: 'book',
        entityId: bookId,
        action: 'file_uploaded',
        payload: { fileId, storageKey: body.storageKey },
      },
      c.executionCtx,
    );

    return c.json({ ok: true, data: { id: fileId, storageKey: body.storageKey } }, 201);
  },
);

booksRouter.post(
  '/:id/index',
  adminAuth,
  requireStepUp,
  zValidator('json', BookIndexSchema),
  async (c) => {
    const { chapters } = c.req.valid('json');
    const bookId = c.req.param('id');
    const { indexedAt, chapterCount } = await replaceBookSearchIndex(c.env, bookId, chapters);

    return c.json({ ok: true, data: { bookId, chapterCount, indexedAt } });
  },
);

booksRouter.patch('/:id', adminAuth, zValidator('json', UpdateBookSchema), async (c) => {
  const bookId = c.req.param('id');
  const body = c.req.valid('json');
  const adminUser = c.get('adminUser');

  const book = await queryFirst<{ id: string }>(
    c.env,
    'SELECT id FROM books WHERE id = ? AND archived_at IS NULL',
    [bookId],
  );

  if (!book) {
    throw new NotFoundError('Book');
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (body.title !== undefined) {
    updates.push('title = ?');
    values.push(body.title);
  }
  if (body.authorName !== undefined) {
    updates.push('author_name = ?');
    values.push(body.authorName);
  }
  if (body.description !== undefined) {
    updates.push('description = ?');
    values.push(body.description);
  }
  if (body.visibility !== undefined) {
    updates.push('visibility = ?');
    values.push(body.visibility);
  }
  if (body.language !== undefined) {
    updates.push('language = ?');
    values.push(body.language);
  }

  if (updates.length === 0) {
    throw new AppError('No fields to update', 'NO_CHANGES', 400);
  }

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(bookId);

  await execute(
    c.env,
    `UPDATE books SET ${updates.join(', ')} WHERE id = ?`,
    values as (string | number | null)[],
  );

  // Invalidate edge cache so the catalog reflects the updated metadata
  await bumpCacheVersion(c.env);

  await logAudit(
    c.env,
    {
      entityType: 'book',
      entityId: bookId,
      action: 'updated',
      actorEmail: adminUser.email,
      payload: body,
    },
    c.executionCtx,
  );

  return c.json({ ok: true });
});

// ADR-234 sensitive-action "book deletion": archives a book and cascades to
// R2 objects, grants, and all reader data.
booksRouter.delete('/:id', adminAuth, requireStepUp, async (c) => {
  const bookId = c.req.param('id');
  const adminUser = c.get('adminUser');

  const book = await queryFirst<{ id: string }>(
    c.env,
    'SELECT id FROM books WHERE id = ? AND archived_at IS NULL',
    [bookId],
  );

  if (!book) {
    throw new NotFoundError('Book');
  }

  // --- Cascade cleanup: delete R2 objects and all child DB rows ---
  // R2 objects
  const files = await queryAll<{ storage_key: string }>(
    c.env,
    'SELECT storage_key FROM book_files WHERE book_id = ?',
    [bookId],
  );
  const r2Ctx = createRequestContext(c.req.raw);
  const r2DeletePromises = files.map((f) =>
    // R2 deletion failure during cascade should not block book archive — log and continue
    c.env.BOOKS_BUCKET.delete(f.storage_key).catch((err: unknown) => {
      logRequestError(r2Ctx, err, {
        event: 'book.delete.r2_failure',
        bookId,
        storageKey: f.storage_key,
      });
    }),
  );
  // DB child rows (soft-delete the book row, hard-delete dependents)
  const cascadeStatements = [
    { sql: 'DELETE FROM reading_insights WHERE book_id = ?', args: [bookId] },
    { sql: 'DELETE FROM reading_progress WHERE book_id = ?', args: [bookId] },
    { sql: 'DELETE FROM bookmarks WHERE book_id = ?', args: [bookId] },
    { sql: 'DELETE FROM highlights WHERE book_id = ?', args: [bookId] },
    { sql: 'DELETE FROM comments WHERE book_id = ?', args: [bookId] },
    { sql: 'DELETE FROM reader_sessions WHERE book_id = ?', args: [bookId] },
    { sql: 'DELETE FROM book_access_grants WHERE book_id = ?', args: [bookId] },
    { sql: 'DELETE FROM book_files WHERE book_id = ?', args: [bookId] },
    { sql: "UPDATE books SET archived_at = datetime('now') WHERE id = ?", args: [bookId] },
  ];

  // R2 deletions run in parallel with the DB transaction
  c.executionCtx.waitUntil(Promise.all(r2DeletePromises));
  await transaction(c.env, cascadeStatements);

  await logAudit(
    c.env,
    {
      entityType: 'book',
      entityId: bookId,
      action: 'archived',
      actorEmail: adminUser.email,
      payload: { cascadeDeleted: true, r2Objects: files.length },
    },
    c.executionCtx,
  );

  return c.json({ ok: true, data: { r2ObjectsDeleted: files.length } });
});

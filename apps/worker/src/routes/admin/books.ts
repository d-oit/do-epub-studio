import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../../lib/env';
import { execute, queryFirst, queryAll, transaction } from '../../db/client';
import { logAudit } from '../../audit';
import { CreateBookSchema, UpdateBookSchema, validateEpub } from '@do-epub-studio/shared';
import { UploadCompleteSchema } from '@do-epub-studio/schema';
import { adminAuth } from '../../middleware/auth';
import { withByteCap, MaxBodySizeError, DEFAULT_MAX_BODY_BYTES } from '../../lib/stream-body';
import { bumpCacheVersion } from '../../lib/edge-cache';

export const booksRouter = new Hono<{ Bindings: Env; Variables: { adminUser: { email: string; id: string; role: string } } }>();

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

  await logAudit(c.env, {
    entityType: 'book',
    entityId: id,
    action: 'created',
    actorEmail: adminUser.email,
    payload: { slug: body.slug, title: body.title },
  }, c.executionCtx);

  return c.json(
    {
      ok: true,
      data: { id, slug: body.slug, title: body.title, uploadUrl },
    },
    201,
  );
});

booksRouter.put('/:id/upload', adminAuth, async (c) => {
  const bookId = c.req.param('id');

  const book = await queryFirst<{ id: string; slug: string }>(
    c.env,
    `SELECT id, slug FROM books WHERE id = ? AND archived_at IS NULL LIMIT 1`,
    [bookId],
  );

  if (!book) {
    return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Book not found' } }, 404);
  }

  const contentType = c.req.header('Content-Type') ?? 'application/epub+zip';
  const contentLengthHeader = c.req.header('Content-Length');
  const contentLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

  // Raw streaming requires a Content-Length to fail fast on the cheap path.
  // Multipart bodies legitimately omit Content-Length; we enforce the cap
  // via withByteCap below.
  const isMultipart = contentType.toLowerCase().startsWith('multipart/');
  if (!isMultipart && contentLength <= 0) {
    return c.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Missing Content-Length header' } }, 400);
  }
  if (!isMultipart && contentLength > DEFAULT_MAX_BODY_BYTES) {
    return c.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: `File too large. Max: ${DEFAULT_MAX_BODY_BYTES} bytes` } },
      413,
    );
  }

  const storageKey = `books/${book.id}/${crypto.randomUUID()}.epub`;

  // Threshold above which we skip post-upload EPUB validation to keep
  // memory bounded. Smaller files are still validated server-side so
  // admins get fast feedback on the common case.
  const VALIDATION_THRESHOLD = 25 * 1024 * 1024;

  const httpMetadata = {
    contentType: isMultipart ? 'application/epub+zip' : contentType,
    contentDisposition: `attachment; filename="${book.slug}.epub"`,
  };

  try {
    let uploadStream: ReadableStream<Uint8Array>;
    let validationArrayBuffer: ArrayBuffer | null = null;
    let validationSkipped = false;
    let declaredSize: number | null = null;

    if (isMultipart) {
      // The runtime buffers formData() in memory, so this path is not
      // truly streaming — but it is the supported way to accept a
      // multipart upload without adding dependencies. The raw PUT path
      // below is the high-volume, low-memory option.
      const form = await c.req.raw.formData();
      const fileEntry = form.get('file');
      if (!(fileEntry instanceof File)) {
        return c.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Missing "file" part' } }, 400);
      }
      if (fileEntry.size > DEFAULT_MAX_BODY_BYTES) {
        return c.json(
          { ok: false, error: { code: 'VALIDATION_ERROR', message: `File too large. Max: ${DEFAULT_MAX_BODY_BYTES} bytes` } },
          413,
        );
      }
      declaredSize = fileEntry.size;
      uploadStream = fileEntry.stream();
      if (fileEntry.size <= VALIDATION_THRESHOLD && fileEntry.size > 0) {
        validationArrayBuffer = await fileEntry.arrayBuffer();
      } else if (fileEntry.size > VALIDATION_THRESHOLD) {
        validationSkipped = true;
      }
    } else {
      if (!c.req.raw.body) {
        return c.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Request body is empty' } }, 400);
      }
      const { stream } = withByteCap(c.req.raw.body, DEFAULT_MAX_BODY_BYTES);
      declaredSize = contentLength;
      if (contentLength <= VALIDATION_THRESHOLD) {
        // Tee the body: one branch goes to R2, the other is read by the
        // validator. The validator must be drained in parallel with the
        // R2 upload or R2 will block.
        const [r2Branch, validatorBranch] = stream.tee();
        uploadStream = r2Branch;
        const chunks: Uint8Array[] = [];
        const reader = validatorBranch.getReader();
        try {
          let done = false;
          while (!done) {
            const result = await reader.read();
            done = result.done;
            if (!result.done) {
              chunks.push(result.value);
            }
          }
        } catch (err) {
          // Stream errored (likely the byte cap). Surface the right code.
          if (err instanceof MaxBodySizeError) {
            return c.json(
              { ok: false, error: { code: 'VALIDATION_ERROR', message: `File too large. Max: ${DEFAULT_MAX_BODY_BYTES} bytes` } },
              413,
            );
          }
          throw err;
        }
        const total = chunks.reduce((acc, c) => acc + c.byteLength, 0);
        const merged = new Uint8Array(total);
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset);
          offset += c.byteLength;
        }
        if (merged.byteLength === 0) {
          return c.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Request body is empty' } }, 400);
        }
        validationArrayBuffer = merged.buffer.slice(merged.byteOffset, merged.byteOffset + merged.byteLength);
      } else {
        // Best-effort path for large uploads: skip validation to keep
        // memory bounded.
        validationSkipped = true;
        uploadStream = stream;
      }
    }

    let validationResults: Awaited<ReturnType<typeof validateEpub>> | null = null;
    const customMetadata: Record<string, string> = {
      bookId: book.id,
      uploadedAt: new Date().toISOString(),
      size: String(declaredSize),
    };
    if (validationArrayBuffer) {
      validationResults = await validateEpub(validationArrayBuffer);
      customMetadata.validationResults = JSON.stringify(validationResults);
      if (!validationResults.isValid) {
        return c.json(
          {
            ok: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'EPUB validation failed',
              details: validationResults.errors,
            },
          },
          400,
        );
      }
    }
    if (validationSkipped) {
      customMetadata.validationSkipped = 'true';
    }

    await c.env.BOOKS_BUCKET.put(storageKey, uploadStream, {
      httpMetadata,
      customMetadata,
    });

    const data: {
      storageKey: string;
      bookId: string;
      slug: string;
      validation?: typeof validationResults;
      validationSkipped?: boolean;
    } = {
      storageKey,
      bookId: book.id,
      slug: book.slug,
    };
    if (validationResults) data.validation = validationResults;
    if (validationSkipped) data.validationSkipped = true;

    return c.json({ ok: true, data }, 200);
  } catch (err) {
    if (err instanceof MaxBodySizeError) {
      return c.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: `File too large. Max: ${DEFAULT_MAX_BODY_BYTES} bytes` } },
        413,
      );
    }
    return c.json({ ok: false, error: { code: 'UPLOAD_FAILED', message: 'Failed to upload file to storage' } }, 500);
  }
});

booksRouter.post('/:id/upload-complete', adminAuth, zValidator('json', UploadCompleteSchema), async (c) => {
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

  // Invalidate edge cache so readers get the fresh EPUB content
  bumpCacheVersion();

  await logAudit(c.env, {
    entityType: 'book',
    entityId: bookId,
    action: 'file_uploaded',
    payload: { fileId, storageKey: body.storageKey },
  }, c.executionCtx);

  return c.json({ ok: true, data: { id: fileId, storageKey: body.storageKey } }, 201);
});

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
    return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Book not found' } }, 404);
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (body.title !== undefined) { updates.push('title = ?'); values.push(body.title); }
  if (body.authorName !== undefined) { updates.push('author_name = ?'); values.push(body.authorName); }
  if (body.description !== undefined) { updates.push('description = ?'); values.push(body.description); }
  if (body.visibility !== undefined) { updates.push('visibility = ?'); values.push(body.visibility); }
  if (body.language !== undefined) { updates.push('language = ?'); values.push(body.language); }

  if (updates.length === 0) {
    return c.json({ ok: false, error: { code: 'NO_CHANGES', message: 'No fields to update' } }, 400);
  }

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(bookId);

  await execute(c.env, `UPDATE books SET ${updates.join(', ')} WHERE id = ?`, values as (string | number | null)[]);

  // Invalidate edge cache so the catalog reflects the updated metadata
  bumpCacheVersion();

  await logAudit(c.env, {
    entityType: 'book',
    entityId: bookId,
    action: 'updated',
    actorEmail: adminUser.email,
    payload: body,
  }, c.executionCtx);

  return c.json({ ok: true });
});

booksRouter.delete('/:id', adminAuth, async (c) => {
  const bookId = c.req.param('id');
  const adminUser = c.get('adminUser');

  const book = await queryFirst<{ id: string }>(
    c.env,
    'SELECT id FROM books WHERE id = ? AND archived_at IS NULL',
    [bookId],
  );

  if (!book) {
    return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Book not found' } }, 404);
  }

  // --- Cascade cleanup: delete R2 objects and all child DB rows ---
  // R2 objects
  const files = await queryAll<{ storage_key: string }>(
    c.env,
    'SELECT storage_key FROM book_files WHERE book_id = ?',
    [bookId],
  );
  const r2DeletePromises = files.map((f) =>
    c.env.BOOKS_BUCKET.delete(f.storage_key).catch(() => undefined),
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

  await logAudit(c.env, {
    entityType: 'book',
    entityId: bookId,
    action: 'archived',
    actorEmail: adminUser.email,
    payload: { cascadeDeleted: true, r2Objects: files.length },
  }, c.executionCtx);

  return c.json({ ok: true, data: { r2ObjectsDeleted: files.length } });
});

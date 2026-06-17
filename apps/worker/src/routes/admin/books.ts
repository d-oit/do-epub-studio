import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../../lib/env';
import { execute, queryFirst } from '../../db/client';
import { logAudit } from '../../audit';
import { CreateBookSchema, UpdateBookSchema, validateEpub } from '@do-epub-studio/shared';
import { UploadCompleteSchema } from '@do-epub-studio/schema';
import { adminAuth } from '../../middleware/auth';

export const booksRouter = new Hono<{ Bindings: Env; Variables: { adminUser: { email: string; id: string; role: string } } }>();

booksRouter.post('/', zValidator('json', CreateBookSchema), adminAuth, async (c) => {
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
  const contentLength = parseInt(c.req.header('Content-Length') ?? '0', 10);

  if (contentLength <= 0) {
    return c.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Missing Content-Length header' } }, 400);
  }

  const maxFileSize = 200 * 1024 * 1024;
  if (contentLength > maxFileSize) {
    return c.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: `File too large. Max: ${maxFileSize} bytes` } }, 413);
  }

  const storageKey = `books/${book.id}/${crypto.randomUUID()}.epub`;

  // Multipart upload threshold: 100 MB
  const MULTIPART_THRESHOLD = 100 * 1024 * 1024;
  const PART_SIZE = 10 * 1024 * 1024; // 10 MB chunks

  try {
    const arrayBuffer = await c.req.raw.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      return c.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Request body is empty' } }, 400);
    }

    const validationResults = await validateEpub(arrayBuffer);

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

    const httpMetadata = {
      contentType,
      contentDisposition: `attachment; filename="${book.slug}.epub"`,
    };
    const customMetadata = {
      bookId: book.id,
      uploadedAt: new Date().toISOString(),
      validationResults: JSON.stringify(validationResults),
    };

    if (arrayBuffer.byteLength > MULTIPART_THRESHOLD) {
      // Large file: use R2 multipart upload
      const upload = await c.env.BOOKS_BUCKET.createMultipartUpload(storageKey, {
        httpMetadata,
        customMetadata,
      });

      const parts: { partNumber: number; etag: string }[] = [];
      const totalParts = Math.ceil(arrayBuffer.byteLength / PART_SIZE);

      for (let i = 0; i < totalParts; i++) {
        const start = i * PART_SIZE;
        const end = Math.min(start + PART_SIZE, arrayBuffer.byteLength);
        const partData = arrayBuffer.slice(start, end);
        const part = await upload.uploadPart(i + 1, partData);
        parts.push({ partNumber: part.partNumber, etag: part.etag });
      }

      await upload.complete(parts);
    } else {
      // Small file: use simple put
      await c.env.BOOKS_BUCKET.put(storageKey, arrayBuffer, {
        httpMetadata,
        customMetadata,
      });
    }

    return c.json(
      {
        ok: true,
        data: {
          storageKey,
          bookId: book.id,
          slug: book.slug,
          validation: validationResults,
        },
      },
      200,
    );
  } catch {
    return c.json({ ok: false, error: { code: 'UPLOAD_FAILED', message: 'Failed to upload file to storage' } }, 500);
  }
});

booksRouter.post('/:id/upload-complete', zValidator('json', UploadCompleteSchema), adminAuth, async (c) => {
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

  await logAudit(c.env, {
    entityType: 'book',
    entityId: bookId,
    action: 'file_uploaded',
    payload: { fileId, storageKey: body.storageKey },
  }, c.executionCtx);

  return c.json({ ok: true, data: { id: fileId, storageKey: body.storageKey } }, 201);
});

booksRouter.patch('/:id', zValidator('json', UpdateBookSchema), adminAuth, async (c) => {
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

  await execute(
    c.env,
    "UPDATE books SET archived_at = datetime('now') WHERE id = ?",
    [bookId],
  );

  await logAudit(c.env, {
    entityType: 'book',
    entityId: bookId,
    action: 'archived',
    actorEmail: adminUser.email,
  }, c.executionCtx);

  return c.json({ ok: true });
});

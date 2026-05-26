import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../../lib/env';
import { execute, queryFirst, queryAll } from '../../db/client';
import { logAudit } from '../../audit';
import { CreateBookSchema, validateEpub } from '@do-epub-studio/shared';
import { adminAuth } from '../../middleware/auth';
import { z } from 'zod';

export const booksRouter = new Hono<{ Bindings: Env; Variables: { adminUser: { email: string; id: string; role: string } } }>();

const UploadCompleteSchema = z.object({
  storageKey: z.string().min(1),
  originalFilename: z.string().min(1).max(500),
  mimeType: z.string().max(200).optional(),
  fileSizeBytes: z.number().int().nonnegative().optional(),
  sha256: z.string().max(64).optional(),
  epubVersion: z.string().max(10).optional(),
  validationResults: z.any().optional(),
});

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
  });

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
  let validationResults;

  try {
    const arrayBuffer = await c.req.raw.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      return c.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Request body is empty' } }, 400);
    }

    const validation = await validateEpub(arrayBuffer);
    validationResults = validation;

    if (!validationResults.isValid) {
      return c.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'EPUB validation failed',
            details: validation.errors,
          },
        },
        400,
      );
    }

    await c.env.BOOKS_BUCKET.put(storageKey, arrayBuffer, {
      httpMetadata: {
        contentType,
        contentDisposition: `attachment; filename="${book.slug}.epub"`,
      },
      customMetadata: {
        bookId: book.id,
        uploadedAt: new Date().toISOString(),
        validationResults: JSON.stringify(validationResults),
      },
    });
  } catch {
    return c.json({ ok: false, error: { code: 'UPLOAD_FAILED', message: 'Failed to upload file to storage' } }, 500);
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
  });

  return c.json({ ok: true, data: { id: fileId, storageKey: body.storageKey } }, 201);
});

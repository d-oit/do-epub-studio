import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../lib/env';
import { queryFirst, queryAll } from '../db/client';
import type { AuthContext } from '../auth/middleware';
import { readerAuth } from '../middleware/auth';
import { assertBookAccess } from '../lib/tenant-isolation';
import { NotFoundError, ForbiddenError } from '../lib/http-errors';
import { LibraryQuerySchema } from '@do-epub-studio/schema';

export const booksRouter = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

booksRouter.get('/', readerAuth, zValidator('query', LibraryQuerySchema), async (c) => {
  const auth = c.get('auth');
  const { limit, offset } = c.req.valid('query');

  const whereClause = `WHERE b.archived_at IS NULL
    AND g.email = ?
    AND g.revoked_at IS NULL
    AND (g.expires_at IS NULL OR g.expires_at > datetime('now'))`;

  const countResult = await queryAll<{ cnt: number }>(
    c.env,
    `SELECT COUNT(*) as cnt
     FROM books b
     JOIN book_access_grants g ON b.id = g.book_id
     ${whereClause}`,
    [auth.email],
  );
  const total = countResult[0]?.cnt ?? 0;

  const books = await queryAll(
    c.env,
    `SELECT b.id, b.slug, b.title, b.author_name, b.visibility, b.cover_image_url,
            b.description, b.language,
            rp.progress_percent, rp.updated_at as progress_updated_at
     FROM books b
     JOIN book_access_grants g ON b.id = g.book_id
     LEFT JOIN reading_progress rp ON rp.book_id = b.id AND rp.user_email = g.email
     ${whereClause}
     ORDER BY b.created_at DESC
     LIMIT ? OFFSET ?`,
    [auth.email, limit, offset],
  );

  const page = Math.floor(offset / limit) + 1;
  return c.json({
    ok: true,
    data: {
      items: books.map((row) => ({
        id: row.id as string,
        slug: row.slug as string,
        title: row.title as string,
        authorName: (row.author_name as string | null) ?? null,
        visibility: row.visibility as string,
        coverImageUrl: (row.cover_image_url as string | null) ?? null,
        description: (row.description as string | null) ?? null,
        language: row.language as string,
        progressPercent: row.progress_percent != null ? (row.progress_percent as number) : 0,
        progressUpdatedAt: (row.progress_updated_at as string | null) ?? null,
      })),
      total,
      page,
      pageSize: limit,
      hasMore: offset + books.length < total,
    },
  });
});

booksRouter.get('/:id', readerAuth, async (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth');

  const mismatch = await assertBookAccess(c.env, auth, id, c.executionCtx);
  if (mismatch) return mismatch.response;

  const book = await queryFirst(
    c.env,
    `SELECT b.* FROM books b
     JOIN book_access_grants g ON b.id = g.book_id
     WHERE (b.id = ? OR b.slug = ?)
     AND b.archived_at IS NULL
     AND g.email = ?
     AND g.revoked_at IS NULL
     AND (g.expires_at IS NULL OR g.expires_at > datetime('now'))
     LIMIT 1`,
    [id, id, auth.email],
  );

  if (!book) {
    throw new NotFoundError('Book');
  }

  return c.json({
    ok: true,
    data: {
      id: book.id as string,
      slug: book.slug as string,
      title: book.title as string,
      authorName: (book.author_name as string) ?? null,
      description: (book.description as string) ?? null,
      language: book.language as string,
      visibility: book.visibility as string,
      coverImageUrl: (book.cover_image_url as string) ?? null,
    },
  });
});

booksRouter.post('/:id/file-url', readerAuth, async (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth');
  const { generateSignedUrl } = await import('../storage/signed-url');

  const mismatch = await assertBookAccess(c.env, auth, id, c.executionCtx);
  if (mismatch) return mismatch.response;

  if (!auth.capabilities.canRead) {
    throw new ForbiddenError('Read access denied');
  }

  const book = await queryFirst(
    c.env,
    `SELECT b.id, b.slug FROM books b
     JOIN book_access_grants g ON b.id = g.book_id
     WHERE (b.id = ? OR b.slug = ?)
     AND b.archived_at IS NULL
     AND g.email = ?
     AND g.revoked_at IS NULL
     LIMIT 1`,
    [id, id, auth.email],
  );

  if (!book) {
    throw new NotFoundError('Book');
  }

  const file = await queryFirst(
    c.env,
    `SELECT storage_key FROM book_files WHERE book_id = ? ORDER BY created_at DESC LIMIT 1`,
    [book.id as string],
  );

  if (!file) {
    throw new NotFoundError('BookFile');
  }

  const signedResponse = await generateSignedUrl(c.env, book.id as string, file.storage_key as string);

  return c.json({
    ok: true,
    data: {
      url: signedResponse.url,
      expiresAt: signedResponse.expiresAt,
      fileSize: signedResponse.fileSize,
      mimeType: signedResponse.mimeType,
    },
  });
});

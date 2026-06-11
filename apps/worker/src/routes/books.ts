import { Hono } from 'hono';
import type { Env } from '../lib/env';
import { queryFirst, queryAll } from '../db/client';
import type { AuthContext } from '../auth/middleware';
import { readerAuth } from '../middleware/auth';

export const booksRouter = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

booksRouter.get('/', readerAuth, async (c) => {
  const auth = c.get('auth');
  // Only list books the user has access to via grants
  const books = await queryAll(
    c.env,
    `SELECT b.id, b.slug, b.title, b.author_name, b.visibility, b.cover_image_url
     FROM books b
     JOIN book_access_grants g ON b.id = g.book_id
     WHERE b.archived_at IS NULL
     AND g.email = ?
     AND g.revoked_at IS NULL
     AND (g.expires_at IS NULL OR g.expires_at > datetime('now'))
     ORDER BY b.created_at DESC`,
    [auth.email]
  );

  return c.json({
    ok: true,
    data: books.map((row) => ({
      id: row.id as string,
      slug: row.slug as string,
      title: row.title as string,
      authorName: row.author_name as string | null,
      visibility: row.visibility as string,
      coverImageUrl: row.cover_image_url as string | null,
    })),
  });
});

booksRouter.get('/:id', readerAuth, async (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth');

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
    return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Book not found or access denied' } }, 404);
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

  if (!auth.capabilities.canRead) {
    return c.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Read access denied' } }, 403);
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
    return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Book not found' } }, 404);
  }

  const file = await queryFirst(
    c.env,
    `SELECT storage_key FROM book_files WHERE book_id = ? ORDER BY created_at DESC LIMIT 1`,
    [book.id as string],
  );

  if (!file) {
    return c.json(
      { ok: false, error: { code: 'NOT_FOUND', message: 'No file found for this book' } },
      404,
    );
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

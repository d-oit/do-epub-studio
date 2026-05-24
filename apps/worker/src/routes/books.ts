import { Hono } from 'hono';
import type { Env } from '../lib/env';
import { queryFirst, queryAll } from '../db/client';
import { requireAuth } from '../auth/middleware';

export const booksRouter = new Hono<{ Bindings: Env; Variables: { auth: any } }>();

booksRouter.use('*', async (c, next) => {
  const auth = await requireAuth(c.env, c.req.raw);
  if (!auth) {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, 401);
  }
  c.set('auth', auth);
  await next();
});

booksRouter.get('/', async (c) => {
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
    data: books.map((b) => ({
      id: b.id,
      slug: b.slug,
      title: b.title,
      authorName: b.author_name,
      visibility: b.visibility,
      coverImageUrl: b.cover_image_url,
    })),
  });
});

booksRouter.get('/:id', async (c) => {
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
      id: book.id,
      slug: book.slug,
      title: book.title,
      authorName: book.author_name,
      description: book.description,
      language: book.language,
      visibility: book.visibility,
      coverImageUrl: b.cover_image_url,
    },
  });
});

booksRouter.post('/:id/file-url', async (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth');
  const { getSignedUrl } = await import('../storage/signed-url');

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
    [book.id],
  );

  if (!file) {
    return c.json(
      { ok: false, error: { code: 'NOT_FOUND', message: 'No file found for this book' } },
      404,
    );
  }

  const url = await getSignedUrl(c.env, file.storage_key as string);

  return c.json({
    ok: true,
    data: { url },
  });
});

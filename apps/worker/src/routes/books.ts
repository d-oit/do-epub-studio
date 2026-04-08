import type { Env } from '../lib/env';
import { requireAuth } from '../auth/middleware';
import { generateSignedUrl } from '../storage/signed-url';
import { queryFirst, queryAll } from '../db/client';
import { jsonResponse } from '../lib/responses';

interface BookRow {
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

interface BookFileRow {
  id: string;
  book_id: string;
  storage_key: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
}

export async function handleGetBook(env: Env, request: Request, slug: string): Promise<Response> {
  const auth = await requireAuth(env, request);

  if (!auth) {
    return jsonResponse(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
      401,
    );
  }

  const book = (await queryFirst(
    env,
    `SELECT * FROM books WHERE slug = ? AND archived_at IS NULL`,
    [slug],
  )) as BookRow | null;

  if (!book) {
    return jsonResponse(
      { ok: false, error: { code: 'NOT_FOUND', message: 'Book not found' } },
      404,
    );
  }

  if (book.id !== auth.bookId) {
    return jsonResponse({ ok: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403);
  }

  return jsonResponse({
    ok: true,
    data: {
      id: book.id,
      slug: book.slug,
      title: book.title,
      authorName: book.author_name,
      description: book.description,
      language: book.language,
      visibility: book.visibility,
      coverImageUrl: book.cover_image_url,
      publishedAt: book.published_at,
    },
  });
}

export async function handleGetFileUrl(
  env: Env,
  request: Request,
  bookIdentifier: string,
): Promise<Response> {
  const auth = await requireAuth(env, request);

  if (!auth) {
    return jsonResponse(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
      401,
    );
  }

  if (!auth.capabilities.canRead) {
    return jsonResponse({ ok: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403);
  }

  const book = await queryFirst<Pick<BookRow, 'id' | 'slug'>>(
    env,
    `SELECT id, slug FROM books WHERE (id = ? OR slug = ?) AND archived_at IS NULL LIMIT 1`,
    [bookIdentifier, bookIdentifier],
  );

  if (!book) {
    return jsonResponse(
      { ok: false, error: { code: 'NOT_FOUND', message: 'Book not found' } },
      404,
    );
  }

  if (book.id !== auth.bookId) {
    return jsonResponse({ ok: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403);
  }

  const bookFile = (await queryFirst(
    env,
    `SELECT * FROM book_files WHERE book_id = ? ORDER BY created_at DESC LIMIT 1`,
    [book.id],
  )) as BookFileRow | null;

  if (!bookFile) {
    return jsonResponse(
      { ok: false, error: { code: 'NOT_FOUND', message: 'File not found' } },
      404,
    );
  }

  const signedUrl = await generateSignedUrl(env, book.id, bookFile.storage_key);

  return jsonResponse({
    ok: true,
    data: signedUrl,
  });
}

export async function handleListBooks(env: Env, request: Request): Promise<Response> {
  const auth = await requireAuth(env, request);

  if (!auth) {
    return jsonResponse(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
      401,
    );
  }

  const books = (await queryAll(
    env,
    `SELECT b.* FROM books b
     INNER JOIN book_access_grants g ON b.id = g.book_id
     WHERE g.email = ? AND g.revoked_at IS NULL AND b.archived_at IS NULL
     ORDER BY b.updated_at DESC`,
    [auth.email],
  )) as unknown as BookRow[];

  return jsonResponse({
    ok: true,
    data: books.map((book) => ({
      id: book.id,
      slug: book.slug,
      title: book.title,
      authorName: book.author_name,
      visibility: book.visibility,
      coverImageUrl: book.cover_image_url,
    })),
  });
}

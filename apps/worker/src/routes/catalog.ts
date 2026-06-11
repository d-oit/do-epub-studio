import { Hono } from 'hono';
import type { Env } from '../lib/env';
import { queryAll } from '../db/client';

export const catalogRouter = new Hono<{ Bindings: Env }>();

/** Public endpoint — no auth required. Returns books with visibility='public'. */
catalogRouter.get('/', async (c) => {
  const books = await queryAll(
    c.env,
    `SELECT id, slug, title, author_name, description, language, cover_image_url, published_at
     FROM books
     WHERE visibility = 'public'
     AND archived_at IS NULL
     ORDER BY published_at DESC, created_at DESC`,
    [],
  );

  return c.json({
    ok: true,
    data: books.map((row) => ({
      id: row.id as string,
      slug: row.slug as string,
      title: row.title as string,
      authorName: (row.author_name as string | null) ?? null,
      description: (row.description as string | null) ?? null,
      language: row.language as string,
      coverImageUrl: (row.cover_image_url as string | null) ?? null,
      publishedAt: (row.published_at as string | null) ?? null,
    })),
  });
});

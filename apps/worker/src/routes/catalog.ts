import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env, JsonRow } from '../lib/env';
import { queryAll } from '../db/client';
import { CatalogQuerySchema } from '@do-epub-studio/schema';
import { withEdgeCache, PUBLIC_CACHE_CONTROL } from '../lib/edge-cache';

export const catalogRouter = new Hono<{ Bindings: Env }>();

type CatalogRow = JsonRow;

function mapRow(row: CatalogRow) {
  return {
    id: row['id'] as string,
    slug: row['slug'] as string,
    title: row['title'] as string,
    authorName: (row['author_name'] as string | null) ?? null,
    description: (row['description'] as string | null) ?? null,
    language: row['language'] as string,
    coverImageUrl: (row['cover_image_url'] as string | null) ?? null,
    publishedAt: (row['published_at'] as string | null) ?? null,
  };
}

/** Public endpoint — no auth required. Returns books with visibility='public'. */
catalogRouter.get('/', zValidator('query', CatalogQuerySchema), async (c) => {
  const { q, author, language, limit, offset } = c.req.valid('query');

  return withEdgeCache(
    c.req.raw,
    async () => {
      const conditions: string[] = ["visibility = 'public'", 'archived_at IS NULL'];
      const args: (string | number)[] = [];

      if (q) {
        conditions.push('(title LIKE ? OR description LIKE ? OR author_name LIKE ?)');
        const needle = `%${q}%`;
        args.push(needle, needle, needle);
      }
      if (author) {
        conditions.push('author_name LIKE ?');
        args.push(`%${author}%`);
      }
      if (language) {
        conditions.push('language = ?');
        args.push(language);
      }

      const whereClause = ` WHERE ${conditions.join(' AND ')}`;

      const countResult = await queryAll<{ cnt: number }>(
        c.env,
        `SELECT COUNT(*) as cnt FROM books${whereClause}`,
        args,
      );
      const total = countResult[0]?.cnt ?? 0;

      const books = await queryAll<CatalogRow>(
        c.env,
        `SELECT id, slug, title, author_name, description, language, cover_image_url, published_at
         FROM books${whereClause}
         ORDER BY published_at DESC, created_at DESC
         LIMIT ? OFFSET ?`,
        [...args, limit, offset],
      );

      const page = Math.floor(offset / limit) + 1;
      return c.json({
        ok: true,
        data: {
          items: books.map(mapRow),
          total,
          page,
          pageSize: limit,
          hasMore: offset + books.length < total,
        },
      });
    },
    { cacheControl: PUBLIC_CACHE_CONTROL },
    { waitUntil: (p) => c.executionCtx.waitUntil(p) },
  );
});

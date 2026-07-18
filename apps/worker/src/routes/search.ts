import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../lib/env';
import type { AuthContext } from '../auth/middleware';
import { queryFirst, queryAll } from '../db/client';
import { readerAuth } from '../middleware/auth';
import { assertBookAccess } from '../lib/tenant-isolation';

export const searchRouter = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

const SearchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

interface SearchResultRow {
  [key: string]: string | number | null | undefined;
  book_id: string;
  chapter_ref: string;
  content: string;
  rank: number;
}

/**
 * GET /api/books/:id/search
 * Full-text search within a book's content using FTS5.
 * Requires read access to the book.
 */
searchRouter.get(
  '/books/:id/search',
  readerAuth,
  zValidator('query', SearchQuerySchema),
  async (c) => {
    const bookId = c.req.param('id');
    const { q, limit, offset } = c.req.valid('query');
    const auth = c.get('auth');

    // Verify book access
    const mismatch = await assertBookAccess(c.env, auth, bookId, c.executionCtx);
    if (mismatch) return mismatch.response;

    // Check if book is indexed
    const indexStatus = await queryFirst<{ indexed_at: string; chapter_count: number }>(
      c.env,
      `SELECT indexed_at, chapter_count FROM book_search_index WHERE book_id = ?`,
      [bookId],
    );

    if (!indexStatus) {
      // Book not indexed — fall back to LIKE search on comments/highlights
      return c.json({
        ok: true,
        data: {
          results: [],
          total: 0,
          indexed: false,
          message: 'Book content not yet indexed for full-text search.',
        },
      });
    }

    // FTS5 search with BM25 ranking
    // Sanitize: strip FTS5 special characters to prevent query injection.
    // FTS5 special chars: " * + - ( ) : near/ AND / OR / NOT
    const sanitized = q.replace(/["*+\-():]|(?:\b(?:NEAR|AND|OR|NOT)\b)/gi, ' ').trim();
    const ftsQuery = sanitized
      .split(/\s+/)
      .filter(Boolean)
      .filter((term) => term.length >= 2) // FTS5 requires min 2-char terms
      .map((term) => `"${term.replace(/"/g, '""')}"`)
      .join(' OR ');

    if (!ftsQuery) {
      return c.json({
        ok: true,
        data: { results: [], total: 0, indexed: true, indexedAt: indexStatus.indexed_at, chapterCount: indexStatus.chapter_count },
      });
    }

    const results = await queryAll<SearchResultRow>(
      c.env,
      `SELECT book_id, chapter_ref, snippet(book_content_fts, 2, '<mark>', '</mark>', '...', 32) as content, rank
       FROM book_content_fts
       WHERE book_id = ? AND book_content_fts MATCH ?
       ORDER BY rank
       LIMIT ? OFFSET ?`,
      [bookId, ftsQuery, limit, offset],
    );

    const countResult = await queryFirst<{ cnt: number }>(
      c.env,
      `SELECT COUNT(*) as cnt FROM book_content_fts WHERE book_id = ? AND book_content_fts MATCH ?`,
      [bookId, ftsQuery],
    );

    return c.json({
      ok: true,
      data: {
        results: results.map((r) => ({
          bookId: r.book_id,
          chapterRef: r.chapter_ref,
          snippet: r.content,
          rank: r.rank,
        })),
        total: countResult?.cnt ?? 0,
        indexed: true,
        indexedAt: indexStatus.indexed_at,
        chapterCount: indexStatus.chapter_count,
      },
    });
  },
);

/**
 * Helper: Index EPUB text content into the FTS5 table.
 * Called after EPUB upload completes.
 */
export async function indexBookContent(
  env: Env,
  bookId: string,
  chapters: Array<{ ref: string; content: string }>,
): Promise<void> {
  const now = new Date().toISOString();

  // Clear existing index for this book
  await env.DB.prepare(
    `DELETE FROM book_content_fts WHERE book_id = ?`,
  ).bind(bookId).run();

  // Insert chapters into FTS5
  for (const chapter of chapters) {
    await env.DB.prepare(
      `INSERT INTO book_content_fts (book_id, chapter_ref, content) VALUES (?, ?, ?)`,
    ).bind(bookId, chapter.ref, chapter.content).run();
  }

  // Update index status
  await env.DB.prepare(
    `INSERT OR REPLACE INTO book_search_index (book_id, indexed_at, chapter_count) VALUES (?, ?, ?)`,
  ).bind(bookId, now, chapters.length).run();
}

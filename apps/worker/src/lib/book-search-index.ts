import { execute } from '../db/client';
import type { Env } from './env';

export interface BookChapterInput {
  chapterRef: string;
  content: string;
}

/**
 * Rebuild a book's server-side full-text search index (M3/GOAP-1001).
 *
 * One owner, two callers: the upload pipeline (`upload-complete`, which clears
 * the previous index and optionally indexes the new chapters in the same
 * request) and the explicit step-up re-index route. A book with no rows here
 * reports `indexed: false` from `GET /api/books/:id/search` instead of
 * "no matches".
 */
export async function clearBookSearchIndex(env: Env, bookId: string): Promise<void> {
  await execute(env, `DELETE FROM book_content_fts WHERE book_id = ?`, [bookId]);
  await execute(env, `DELETE FROM book_search_index WHERE book_id = ?`, [bookId]);
}

/**
 * Replace the book's index with the supplied chapters and record the completed
 * state. Returns the timestamp recorded in `book_search_index`.
 */
export async function replaceBookSearchIndex(
  env: Env,
  bookId: string,
  chapters: readonly BookChapterInput[],
): Promise<{ indexedAt: string; chapterCount: number }> {
  const indexedAt = new Date().toISOString();
  await clearBookSearchIndex(env, bookId);

  for (const chapter of chapters) {
    await execute(
      env,
      `INSERT INTO book_content_fts (book_id, chapter_ref, content) VALUES (?, ?, ?)`,
      [bookId, chapter.chapterRef, chapter.content],
    );
  }

  await execute(
    env,
    `INSERT INTO book_search_index (book_id, indexed_at, chapter_count) VALUES (?, ?, ?)`,
    [bookId, indexedAt, chapters.length],
  );

  return { indexedAt, chapterCount: chapters.length };
}

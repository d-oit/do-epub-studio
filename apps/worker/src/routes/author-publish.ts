import type { Context } from 'hono';
import { AuthorPublicationSchema } from '@do-epub-studio/shared';
import { packageEpub3 } from '@do-epub-studio/reader-core/packager';
import { validateArchive } from '@do-epub-studio/shared';
import type { Env } from '../lib/env';
import { execute, queryFirst } from '../db/client';
import { NotFoundError } from '../lib/http-errors';
import { logAudit } from '../audit';
import { bumpCacheVersion } from '../lib/edge-cache';
import { replaceBookSearchIndex } from '../lib/book-search-index';
import { enqueueEpubValidation } from '../lib/epub-validation-queue';

type AuthorContext = Context<{
  Bindings: Env;
  Variables: { authorUser: { email: string; id: string; role: string } };
}>;

async function computeSha256(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data as unknown as ArrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function handlePublishManuscript(c: AuthorContext): Promise<Response> {
  const bookId = c.req.param('id');
  if (!bookId) {
    throw new NotFoundError('Book');
  }
  const book = await queryFirst<{
    id: string;
    slug: string;
    title: string;
  }>(c.env, 'SELECT id, slug, title FROM books WHERE id = ? AND archived_at IS NULL LIMIT 1', [
    bookId,
  ]);

  if (!book) {
    throw new NotFoundError('Book');
  }

  const draftRow = await queryFirst<{
    publication_json: string;
    draft_version: number;
  }>(
    c.env,
    'SELECT publication_json, draft_version FROM book_manuscript_drafts WHERE book_id = ? LIMIT 1',
    [bookId],
  );

  if (!draftRow) {
    throw new NotFoundError('Manuscript draft');
  }

  const publication = AuthorPublicationSchema.parse(JSON.parse(draftRow.publication_json));
  const epubBuffer = packageEpub3(publication);

  // Validate archive safety prior to R2 storage
  await validateArchive(epubBuffer);

  const fileSizeBytes = epubBuffer.byteLength;
  const sha256 = await computeSha256(epubBuffer);
  const fileId = crypto.randomUUID();
  const storageKey = `books/${book.id}/${fileId}.epub`;
  const now = new Date().toISOString();

  await c.env.BOOKS_BUCKET.put(storageKey, epubBuffer, {
    httpMetadata: {
      contentType: 'application/epub+zip',
      contentDisposition: `attachment; filename="${book.slug}.epub"`,
    },
    customMetadata: {
      bookId: book.id,
      uploadedAt: now,
      size: String(fileSizeBytes),
      authoringSource: 'manuscript-editor',
      draftVersion: String(draftRow.draft_version),
    },
  });

  const revisionCountRow = await queryFirst<{ count: number }>(
    c.env,
    'SELECT COUNT(*) as count FROM book_files WHERE book_id = ?',
    [book.id],
  );
  const revision = (revisionCountRow?.count ?? 0) + 1;

  await execute(
    c.env,
    `INSERT INTO book_files (id, book_id, storage_provider, storage_key, original_filename, mime_type, file_size_bytes, sha256, epub_version, created_at)
     VALUES (?, ?, 'r2', ?, ?, 'application/epub+zip', ?, ?, '3.0', ?)`,
    [fileId, book.id, storageKey, `${book.slug}.epub`, fileSizeBytes, sha256, now],
  );

  await execute(
    c.env,
    `INSERT INTO epub_validation_reports (id, book_id, revision_id, validator_version, status, safety_status, created_at, updated_at)
     VALUES (?, ?, ?, '5.4.0', 'pending', 'pending', ?, ?)`,
    [crypto.randomUUID(), book.id, fileId, now, now],
  );

  await enqueueEpubValidation(c.env, { bookId: book.id, revisionId: fileId });

  const searchChapters = publication.chapters.map((ch) => ({
    chapterRef: `chapters/${ch.id}.xhtml`,
    content: `${ch.title} ${ch.contentHtml
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()}`.trim(),
  }));

  if (searchChapters.length > 0) {
    await replaceBookSearchIndex(c.env, book.id, searchChapters);
  }

  await execute(c.env, 'UPDATE books SET published_at = ?, updated_at = ? WHERE id = ?', [
    now,
    now,
    book.id,
  ]);

  await bumpCacheVersion(c.env);

  await logAudit(
    c.env,
    {
      entityType: 'book',
      entityId: book.id,
      action: 'manuscript_published',
      payload: { fileId, revision, sha256, fileSizeBytes },
    },
    c.executionCtx,
  );

  return c.json(
    {
      ok: true,
      data: {
        bookId: book.id,
        fileId,
        revision,
        sha256,
        fileSize: fileSizeBytes,
        status: 'published',
      },
    },
    201,
  );
}

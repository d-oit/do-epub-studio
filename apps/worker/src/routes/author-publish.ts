import type { Context } from 'hono';
import { AuthorPublicationSchema, type AuthorPublication } from '@do-epub-studio/shared';
import { packageEpub3 } from '@do-epub-studio/reader-core/packager';
import { validateArchive } from '@do-epub-studio/shared/src/archive-validator';
import type { Env, JsonRow } from '../lib/env';
import { execute, queryAll, queryFirst } from '../db/client';
import { ConflictError, NotFoundError, ValidationError } from '../lib/http-errors';
import { logAudit } from '../audit';
import { bumpCacheVersion } from '../lib/edge-cache';
import { finalizeBookEpubRevision } from '../lib/epub-revisions';
import { publicationAssetRequirements } from '../lib/author-publication-assets';

type AuthorContext = Context<{
  Bindings: Env;
  Variables: { authorUser: { email: string; id: string; role: string } };
}>;

interface AssetRow extends JsonRow {
  id: string;
  media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'text/css';
  sha256: string;
  size_bytes: number;
  storage_key: string;
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data as unknown as BufferSource);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function deterministicRevisionId(bookId: string, sha256: string): Promise<string> {
  const input = new TextEncoder().encode(`do-epub-author-revision:${bookId}:${sha256}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', input));
  const bytes = digest.slice(0, 16);
  const versionByte = bytes[6] as number;
  const variantByte = bytes[8] as number;
  bytes[6] = (versionByte & 0x0f) | 0x50;
  bytes[8] = (variantByte & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function normalizeDraftTimestamp(value: string): string {
  if (value.length === 19 && value[10] === ' ') {
    return `${value.slice(0, 10)}T${value.slice(11)}Z`;
  }
  return value;
}

async function loadPackagedAssets(
  env: Env,
  bookId: string,
  publication: AuthorPublication,
): Promise<{ id: string; data: Uint8Array; mediaType: AssetRow['media_type'] }[]> {
  const requirements = publicationAssetRequirements(publication);
  if (requirements.size === 0) return [];

  const ids = [...requirements.keys()];
  const placeholders = ids.map(() => '?').join(', ');
  const rows = await queryAll<AssetRow>(
    env,
    `SELECT id, media_type, sha256, size_bytes, storage_key
     FROM author_assets WHERE book_id = ? AND id IN (${placeholders})`,
    [bookId, ...ids],
  );
  const assetsById = new Map(rows.map((row) => [row.id, row]));
  if (assetsById.size !== requirements.size) {
    throw new ValidationError('A referenced author asset is missing');
  }

  const packaged = await Promise.all(
    [...requirements].map(async ([id, kind]) => {
      const row = assetsById.get(id);
      if (!row) throw new ValidationError('A referenced author asset is missing');
      const isImage =
        row.media_type === 'image/jpeg' ||
        row.media_type === 'image/png' ||
        row.media_type === 'image/gif';
      if (
        (kind === 'image' && !isImage) ||
        (kind === 'stylesheet' && row.media_type !== 'text/css')
      ) {
        throw new ValidationError('A referenced author asset has the wrong media type');
      }
      const object = await env.BOOKS_BUCKET.get(row.storage_key);
      if (!object) throw new NotFoundError('Author asset');
      const data = new Uint8Array(await object.arrayBuffer());
      if (data.byteLength !== row.size_bytes || (await sha256Hex(data)) !== row.sha256) {
        throw new ConflictError('Stored author asset failed its integrity check');
      }
      return { id, data, mediaType: row.media_type };
    }),
  );
  return packaged;
}

export async function handlePublishManuscript(c: AuthorContext): Promise<Response> {
  const bookId = c.req.param('id');
  if (!bookId) throw new NotFoundError('Book');
  const book = await queryFirst<{ id: string; slug: string; title: string }>(
    c.env,
    'SELECT id, slug, title FROM books WHERE id = ? AND archived_at IS NULL LIMIT 1',
    [bookId],
  );
  if (!book) throw new NotFoundError('Book');

  const draftRow = await queryFirst<{
    publication_json: string;
    draft_version: number;
    updated_at: string;
  }>(
    c.env,
    'SELECT publication_json, draft_version, updated_at FROM book_manuscript_drafts WHERE book_id = ? LIMIT 1',
    [bookId],
  );
  if (!draftRow) throw new NotFoundError('Manuscript draft');

  const publication = AuthorPublicationSchema.parse(JSON.parse(draftRow.publication_json));
  const assets = await loadPackagedAssets(c.env, book.id, publication);
  const epubBuffer = await packageEpub3(publication, assets, {
    identifier: publication.identifier ?? `urn:uuid:${book.id}`,
    modifiedAt: normalizeDraftTimestamp(draftRow.updated_at),
  });

  // Validate archive safety prior to R2 storage.
  await validateArchive(epubBuffer);

  const fileSizeBytes = epubBuffer.byteLength;
  const sha256 = await sha256Hex(epubBuffer);
  const fileId = await deterministicRevisionId(book.id, sha256);
  const storageKey = `books/${book.id}/author-revisions/${sha256}.epub`;
  const now = new Date().toISOString();

  const existingRevision = await queryFirst<{ id: string }>(
    c.env,
    'SELECT id FROM book_files WHERE book_id = ? AND id = ? LIMIT 1',
    [book.id, fileId],
  );
  if (!existingRevision || !(await c.env.BOOKS_BUCKET.head(storageKey))) {
    await c.env.BOOKS_BUCKET.put(storageKey, epubBuffer, {
      httpMetadata: {
        contentType: 'application/epub+zip',
        contentDisposition: `attachment; filename="${book.slug}.epub"`,
      },
      customMetadata: {
        bookId: book.id,
        sha256,
        size: String(fileSizeBytes),
        authoringSource: 'manuscript-editor',
        draftVersion: String(draftRow.draft_version),
      },
    });
  }

  const searchChapters = publication.chapters.map((chapter) => ({
    chapterRef: `chapters/${chapter.id}.xhtml`,
    content: `${chapter.title} ${chapter.contentHtml
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()}`.trim(),
  }));
  const { inserted } = await finalizeBookEpubRevision(c.env, {
    bookId: book.id,
    fileId,
    storageKey,
    originalFilename: `${book.slug}.epub`,
    mimeType: 'application/epub+zip',
    fileSizeBytes,
    sha256,
    epubVersion: '3.0',
    chapters: searchChapters,
    createdAt: now,
  });
  const revisionCountRow = await queryFirst<{ count: number }>(
    c.env,
    'SELECT COUNT(*) as count FROM book_files WHERE book_id = ?',
    [book.id],
  );
  const revision = revisionCountRow?.count ?? 1;

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
      payload: { fileId, revision, sha256, fileSizeBytes, reusedRevision: !inserted },
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
    inserted ? 201 : 200,
  );
}

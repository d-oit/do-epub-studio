import { Hono } from 'hono';
import {
  AuthorAssetMetadataSchema,
  MAX_AUTHOR_ASSET_COUNT,
  MAX_AUTHOR_ASSETS_TOTAL_BYTES,
  MAX_AUTHOR_IMAGE_BYTES,
  MAX_AUTHOR_STYLESHEET_BYTES,
  type AuthorAssetMetadata,
} from '@do-epub-studio/shared';
import type { Env, JsonRow } from '../lib/env';
import { execute, queryAll, queryFirst } from '../db/client';
import { authorAuth } from '../middleware/auth';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../lib/http-errors';
import { MaxBodySizeError, withByteCap } from '../lib/stream-body';
import { sanitizeAuthorStylesheet } from '@do-epub-studio/reader-core/author-styles';

interface AssetRow extends JsonRow {
  id: string;
  book_id: string;
  name: string;
  media_type: AuthorAssetMetadata['mediaType'];
  sha256: string;
  size_bytes: number;
  storage_key: string;
  created_at: string;
}

const ASSET_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function matchesImageSignature(type: AssetRow['media_type'], bytes: Uint8Array): boolean {
  switch (type) {
    case 'image/jpeg':
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case 'image/png':
      return (
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
      );
    case 'image/gif':
      return (
        bytes.length >= 6 &&
        bytes[0] === 0x47 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x38 &&
        (bytes[4] === 0x37 || bytes[4] === 0x39) &&
        bytes[5] === 0x61
      );
    default:
      return false;
  }
}

export const authorAssetsRouter = new Hono<{
  Bindings: Env;
  Variables: { authorUser: { email: string; id: string; role: string } };
}>();

function toMetadata(row: AssetRow): AuthorAssetMetadata {
  return AuthorAssetMetadataSchema.parse({
    id: row.id,
    name: row.name,
    mediaType: row.media_type,
    sizeBytes: row.size_bytes,
    sha256: row.sha256,
    createdAt: row.created_at,
  });
}

async function readBoundedRequestBody(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array<ArrayBuffer>> {
  if (!request.body) throw new ValidationError('Asset body is required');
  const { stream } = withByteCap(request.body, maxBytes);
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = stream.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }
  } catch (error) {
    if (error instanceof MaxBodySizeError) {
      throw new AppError(`Asset exceeds ${maxBytes} bytes`, 'PAYLOAD_TOO_LARGE', 413);
    }
    throw error;
  } finally {
    reader.releaseLock();
  }
  if (total === 0) throw new ValidationError('Asset body is empty');

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function parseAssetType(request: Request): AssetRow['media_type'] {
  const type = (request.headers.get('Content-Type') ?? '').split(';', 1)[0]?.trim().toLowerCase();
  if (
    type === 'text/css' ||
    type === 'image/jpeg' ||
    type === 'image/png' ||
    type === 'image/gif'
  ) {
    return type;
  }
  throw new ValidationError('Asset type must be JPEG, PNG, GIF, or CSS');
}

function parseAssetName(request: Request): string {
  const encodedName = request.headers.get('X-Asset-Name') ?? '';
  let name: string;
  try {
    name = decodeURIComponent(encodedName).trim();
  } catch {
    throw new ValidationError('X-Asset-Name is not valid URL-encoded UTF-8');
  }
  if (!name || name.length > 120) {
    throw new ValidationError('X-Asset-Name must be a safe filename of at most 120 characters');
  }
  for (let index = 0; index < name.length; index += 1) {
    const codePoint = name.charCodeAt(index);
    if (codePoint <= 0x1f || codePoint === 0x7f || codePoint === 0x2f || codePoint === 0x5c) {
      throw new ValidationError('X-Asset-Name must be a safe filename of at most 120 characters');
    }
  }
  return name;
}

function validateAssetBytes(type: AssetRow['media_type'], bytes: Uint8Array): void {
  if (type === 'text/css') {
    try {
      const css = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      sanitizeAuthorStylesheet(css);
    } catch (error) {
      throw new ValidationError(
        error instanceof Error ? error.message : 'Stylesheet is invalid or unsafe',
      );
    }
    return;
  }
  if (!matchesImageSignature(type, bytes)) {
    throw new ValidationError('Image bytes do not match the declared media type');
  }
}

function assetLimit(type: AssetRow['media_type']): number {
  return type === 'text/css' ? MAX_AUTHOR_STYLESHEET_BYTES : MAX_AUTHOR_IMAGE_BYTES;
}

async function getBookAsset(env: Env, bookId: string, assetId: string): Promise<AssetRow> {
  const row = await queryFirst<AssetRow>(
    env,
    `SELECT id, book_id, name, media_type, sha256, size_bytes, storage_key, created_at
     FROM author_assets WHERE book_id = ? AND id = ?`,
    [bookId, assetId],
  );
  if (!row) throw new NotFoundError('Author asset');
  return row;
}

authorAssetsRouter.get('/books/:id/assets', authorAuth, async (c) => {
  const rows = await queryAll<AssetRow>(
    c.env,
    `SELECT id, book_id, name, media_type, sha256, size_bytes, storage_key, created_at
     FROM author_assets WHERE book_id = ? ORDER BY created_at, id`,
    [c.req.param('id')],
  );
  return c.json({ ok: true, data: { assets: rows.map(toMetadata) } });
});

authorAssetsRouter.put('/books/:id/assets/:assetId', authorAuth, async (c) => {
  const bookId = c.req.param('id');
  const assetId = c.req.param('assetId');
  if (!ASSET_ID_PATTERN.test(assetId)) throw new ValidationError('Invalid asset ID');

  const mediaType = parseAssetType(c.req.raw);
  const name = parseAssetName(c.req.raw);
  const bytes = await readBoundedRequestBody(c.req.raw, assetLimit(mediaType));
  validateAssetBytes(mediaType, bytes);

  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  const existing = await queryFirst<AssetRow>(
    c.env,
    `SELECT id, book_id, name, media_type, sha256, size_bytes, storage_key, created_at
     FROM author_assets WHERE book_id = ? AND id = ?`,
    [bookId, assetId],
  );
  if (existing) {
    if (existing.sha256 !== sha256 || existing.media_type !== mediaType) {
      throw new ConflictError('Asset ID already exists with different content');
    }
    await execute(c.env, 'UPDATE author_assets SET name = ? WHERE book_id = ? AND id = ?', [
      name,
      bookId,
      assetId,
    ]);
    return c.json({ ok: true, data: { asset: toMetadata({ ...existing, name }) } });
  }

  const storageKey = `books/${bookId}/author-assets/${assetId}/${sha256}`;
  const createdAt = new Date().toISOString();
  await c.env.BOOKS_BUCKET.put(storageKey, bytes, {
    httpMetadata: { contentType: mediaType, cacheControl: 'private, no-store' },
    customMetadata: { bookId, assetId, sha256 },
  });

  let storedKeyIsReferenced = false;
  try {
    const inserted = await queryFirst<{ id: string }>(
      c.env,
      `INSERT OR IGNORE INTO author_assets
        (id, book_id, name, media_type, sha256, size_bytes, storage_key, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?
       WHERE (SELECT COUNT(*) FROM author_assets WHERE book_id = ?) < ?
         AND COALESCE((SELECT SUM(size_bytes) FROM author_assets WHERE book_id = ?), 0) + ? <= ?
       RETURNING id`,
      [
        assetId,
        bookId,
        name,
        mediaType,
        sha256,
        bytes.byteLength,
        storageKey,
        createdAt,
        bookId,
        MAX_AUTHOR_ASSET_COUNT,
        bookId,
        bytes.byteLength,
        MAX_AUTHOR_ASSETS_TOTAL_BYTES,
      ],
    );
    if (inserted) {
      storedKeyIsReferenced = true;
      return c.json(
        {
          ok: true,
          data: {
            asset: toMetadata({
              id: assetId,
              book_id: bookId,
              name,
              media_type: mediaType,
              sha256,
              size_bytes: bytes.byteLength,
              storage_key: storageKey,
              created_at: createdAt,
            }),
          },
        },
        201,
      );
    }

    const current = await queryFirst<AssetRow>(
      c.env,
      `SELECT id, book_id, name, media_type, sha256, size_bytes, storage_key, created_at
       FROM author_assets WHERE book_id = ? AND id = ?`,
      [bookId, assetId],
    );
    if (current && current.sha256 === sha256 && current.media_type === mediaType) {
      storedKeyIsReferenced = current.storage_key === storageKey;
      return c.json({ ok: true, data: { asset: toMetadata(current) } });
    }
    if (current) throw new ConflictError('Asset ID already exists with different content');
    throw new AppError('The book author-asset quota has been reached', 'AUTHOR_ASSET_QUOTA', 413);
  } finally {
    if (!storedKeyIsReferenced) await c.env.BOOKS_BUCKET.delete(storageKey);
  }
});

authorAssetsRouter.get('/books/:id/assets/:assetId', authorAuth, async (c) => {
  const bookId = c.req.param('id');
  const assetId = c.req.param('assetId');
  if (!ASSET_ID_PATTERN.test(assetId)) throw new ValidationError('Invalid asset ID');
  const metadata = await getBookAsset(c.env, bookId, assetId);
  const object = await c.env.BOOKS_BUCKET.get(metadata.storage_key);
  if (!object) throw new NotFoundError('Author asset');

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Content-Type', metadata.media_type);
  headers.set('Content-Disposition', 'inline');
  headers.set('Cache-Control', 'private, no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('ETag', object.httpEtag);
  return new Response(object.body, { headers });
});

authorAssetsRouter.delete('/books/:id/assets/:assetId', authorAuth, async (c) => {
  const bookId = c.req.param('id');
  const assetId = c.req.param('assetId');
  if (!ASSET_ID_PATTERN.test(assetId)) throw new ValidationError('Invalid asset ID');

  const deleted = await queryFirst<{ storage_key: string }>(
    c.env,
    `DELETE FROM author_assets
     WHERE book_id = ? AND id = ?
       AND NOT EXISTS (
         SELECT 1 FROM book_manuscript_drafts
         WHERE book_id = ? AND instr(publication_json, ?) > 0
       )
     RETURNING storage_key`,
    [bookId, assetId, bookId, assetId],
  );
  if (!deleted) {
    const existing = await getBookAsset(c.env, bookId, assetId);
    throw new ConflictError(
      existing ? 'Asset is referenced by the current manuscript' : 'Author asset not found',
    );
  }
  await c.env.BOOKS_BUCKET.delete(deleted.storage_key);
  return c.json({ ok: true, data: { deleted: true } });
});

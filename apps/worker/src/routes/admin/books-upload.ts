// ADR-234 sensitive-action "book file upload": ingests a new EPUB into R2.
// Extracted from `books.ts` (ADR-278 warn-zone extraction) — the raw-PUT path
// is the high-volume, low-memory option and its streaming/validation logic
// keeps the router readable on its own.
import type { Context } from 'hono';
import type { Env } from '../../lib/env';
import { queryFirst } from '../../db/client';
import { validateEpub, type ValidationResult } from '@do-epub-studio/shared/src/epub-validator';
import { withByteCap, MaxBodySizeError, DEFAULT_MAX_BODY_BYTES } from '../../lib/stream-body';
import { NotFoundError, ValidationError, AppError } from '../../lib/http-errors';

type AdminBooksContext = Context<
  {
    Bindings: Env;
    Variables: { adminUser: { email: string; id: string; role: string } };
  },
  '/:id/upload'
>;

export async function handleBookFileUpload(c: AdminBooksContext): Promise<Response> {
  const bookId = c.req.param('id');

  const book = await queryFirst<{ id: string; slug: string }>(
    c.env,
    `SELECT id, slug FROM books WHERE id = ? AND archived_at IS NULL LIMIT 1`,
    [bookId],
  );

  if (!book) {
    throw new NotFoundError('Book');
  }

  const contentType = c.req.header('Content-Type') ?? 'application/epub+zip';
  const contentLengthHeader = c.req.header('Content-Length');
  const contentLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

  // Raw streaming requires a Content-Length to fail fast on the cheap path.
  // Multipart bodies legitimately omit Content-Length; we enforce the cap
  // via withByteCap below.
  const isMultipart = contentType.toLowerCase().startsWith('multipart/');
  if (!isMultipart && contentLength <= 0) {
    throw new ValidationError('Missing Content-Length header');
  }
  if (!isMultipart && contentLength > DEFAULT_MAX_BODY_BYTES) {
    throw new AppError(
      `File too large. Max: ${DEFAULT_MAX_BODY_BYTES} bytes`,
      'VALIDATION_ERROR',
      413,
    );
  }

  const storageKey = `books/${book.id}/${crypto.randomUUID()}.epub`;

  // Threshold above which we skip post-upload EPUB validation to keep
  // memory bounded. Smaller files are still validated server-side so
  // admins get fast feedback on the common case.
  const VALIDATION_THRESHOLD = 25 * 1024 * 1024;

  const httpMetadata = {
    contentType: isMultipart ? 'application/epub+zip' : contentType,
    contentDisposition: `attachment; filename="${book.slug}.epub"`,
  };

  try {
    let uploadStream: ReadableStream<Uint8Array>;
    let validationArrayBuffer: ArrayBuffer | null = null;
    let validationSkipped = false;
    let declaredSize: number | null = null;

    if (isMultipart) {
      // The runtime buffers formData() in memory, so this path is not
      // truly streaming — but it is the supported way to accept a
      // multipart upload without adding dependencies. The raw PUT path
      // below is the high-volume, low-memory option.
      const form = await c.req.raw.formData();
      const fileEntry = form.get('file');
      if (!(fileEntry instanceof File)) {
        throw new ValidationError('Missing "file" part');
      }
      if (fileEntry.size > DEFAULT_MAX_BODY_BYTES) {
        throw new AppError(
          `File too large. Max: ${DEFAULT_MAX_BODY_BYTES} bytes`,
          'VALIDATION_ERROR',
          413,
        );
      }
      declaredSize = fileEntry.size;
      uploadStream = fileEntry.stream();
      if (fileEntry.size <= VALIDATION_THRESHOLD && fileEntry.size > 0) {
        validationArrayBuffer = await fileEntry.arrayBuffer();
      } else if (fileEntry.size > VALIDATION_THRESHOLD) {
        validationSkipped = true;
      }
    } else {
      if (!c.req.raw.body) {
        throw new ValidationError('Request body is empty');
      }
      const { stream } = withByteCap(c.req.raw.body, DEFAULT_MAX_BODY_BYTES);
      declaredSize = contentLength;
      if (contentLength <= VALIDATION_THRESHOLD) {
        // Tee the body: one branch goes to R2, the other is read by the
        // validator. The validator must be drained in parallel with the
        // R2 upload or R2 will block.
        const [r2Branch, validatorBranch] = stream.tee();
        uploadStream = r2Branch;
        const chunks: Uint8Array[] = [];
        const reader = validatorBranch.getReader();
        try {
          let done = false;
          while (!done) {
            const result = await reader.read();
            done = result.done;
            if (!result.done) {
              chunks.push(result.value);
            }
          }
        } catch (err) {
          // Stream errored (likely the byte cap). Surface the right code.
          if (err instanceof MaxBodySizeError) {
            throw new AppError(
              `File too large. Max: ${DEFAULT_MAX_BODY_BYTES} bytes`,
              'VALIDATION_ERROR',
              413,
            );
          }
          throw err;
        }
        const total = chunks.reduce((acc, c) => acc + c.byteLength, 0);
        const merged = new Uint8Array(total);
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset);
          offset += c.byteLength;
        }
        if (merged.byteLength === 0) {
          throw new ValidationError('Request body is empty');
        }
        validationArrayBuffer = merged.buffer.slice(
          merged.byteOffset,
          merged.byteOffset + merged.byteLength,
        );
      } else {
        // Best-effort path for large uploads: skip validation to keep
        // memory bounded.
        validationSkipped = true;
        uploadStream = stream;
      }
    }

    let validationResults: ValidationResult | null = null;
    const customMetadata: Record<string, string> = {
      bookId: book.id,
      uploadedAt: new Date().toISOString(),
      size: String(declaredSize),
    };
    if (validationArrayBuffer) {
      validationResults = await validateEpub(validationArrayBuffer);
      customMetadata.validationResults = JSON.stringify(validationResults);
      if (!validationResults.isValid) {
        throw new ValidationError('EPUB validation failed', validationResults.errors);
      }
    }
    if (validationSkipped) {
      customMetadata.validationSkipped = 'true';
    }

    await c.env.BOOKS_BUCKET.put(storageKey, uploadStream, {
      httpMetadata,
      customMetadata,
    });

    const data: {
      storageKey: string;
      bookId: string;
      slug: string;
      validation?: ValidationResult;
      validationSkipped?: boolean;
    } = {
      storageKey,
      bookId: book.id,
      slug: book.slug,
    };
    if (validationResults) data.validation = validationResults;
    if (validationSkipped) data.validationSkipped = true;

    return c.json({ ok: true, data }, 200);
  } catch (err) {
    if (err instanceof MaxBodySizeError) {
      throw new AppError(
        `File too large. Max: ${DEFAULT_MAX_BODY_BYTES} bytes`,
        'VALIDATION_ERROR',
        413,
      );
    }
    throw new AppError('Failed to upload file to storage', 'UPLOAD_FAILED', 500);
  }
}

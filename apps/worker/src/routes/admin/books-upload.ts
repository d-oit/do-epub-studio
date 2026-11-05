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
import { logAppError } from '../../lib/observability';

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
    let uploadStream: ReadableStream<Uint8Array> | Uint8Array | Blob;
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
      // `File` is a Blob: R2 accepts it directly with its known size.
      uploadStream = fileEntry;
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
        // Buffer the bounded body once: the same bytes validate and upload.
        // R2 rejects streams whose length it cannot know (a tee'd branch
        // reports none), so the small path hands R2 the exact bytes.
        const chunks: Uint8Array[] = [];
        const reader = stream.getReader();
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
        uploadStream = merged;
        validationArrayBuffer = merged.buffer.slice(
          merged.byteOffset,
          merged.byteOffset + merged.byteLength,
        );
      } else {
        // Best-effort path for large uploads: skip validation to keep memory
        // bounded. R2 needs a body with a known length, so stream the request
        // body itself; a `withByteCap`/`tee` wrapper reports no length and R2
        // rejects it. The declared Content-Length cap is enforced above.
        validationSkipped = true;
        uploadStream = c.req.raw.body;
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
    // Keep the cause diagnosable: this used to surface as a bare
    // `UPLOAD_FAILED` 500 with nothing in the logs (audit A3).
    logAppError('admin.book.upload_failed', err, {
      bookId,
      contentType,
      isMultipart,
      contentLength,
    });
    const failure = new AppError('Failed to upload file to storage', 'UPLOAD_FAILED', 500);
    failure.cause = err;
    throw failure;
  }
}

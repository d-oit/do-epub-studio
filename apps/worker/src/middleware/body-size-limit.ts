import type { MiddlewareHandler } from 'hono';

const UPLOAD_PATH_RE = /^\/api\/admin\/books\/[^/]+\/upload(?:\/|$)/;

/**
 * Rejects requests whose body exceeds `maxBytes` with HTTP 413.
 *
 * The upload route `/api/admin/books/:id/upload` is exempt because it streams
 * raw EPUB bytes directly to R2 and must never have its body pre-buffered.
 *
 * Two enforcement paths:
 *  1. `Content-Length` present → reject immediately without reading the body.
 *  2. No `Content-Length` (chunked) → clone the request and pump up to
 *     `maxBytes + 1` bytes; if the stream delivers more, return 413.
 *     The original request body is untouched so the handler can still read it.
 */
export function bodySizeLimit(maxBytes = 1_048_576): MiddlewareHandler {
  return async function bodySizeLimitMiddleware(c, next) {
    // Exempt the EPUB upload route — it streams, never buffers.
    if (UPLOAD_PATH_RE.test(c.req.path)) {
      return next();
    }

    const contentLengthHeader = c.req.header('Content-Length');
    if (contentLengthHeader !== undefined && contentLengthHeader !== null) {
      const contentLength = parseInt(contentLengthHeader, 10);
      if (!Number.isNaN(contentLength) && contentLength > maxBytes) {
        return c.json(
          {
            ok: false,
            error: {
              code: 'PAYLOAD_TOO_LARGE',
              message: 'Request body exceeds size limit',
            },
          },
          413,
        );
      }
    } else {
      // No Content-Length — chunked or unknown; pump the clone.
      const cloned = c.req.raw.clone();
      const reader = cloned.body?.getReader();
      if (reader) {
        let bytesRead = 0;
        let tooLarge = false;
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            bytesRead += value.byteLength;
            if (bytesRead > maxBytes) {
              tooLarge = true;
              break;
            }
          }
        } finally {
          reader.cancel().catch(() => {
            // Ignore cancel errors — the clone is being discarded.
          });
        }
        if (tooLarge) {
          return c.json(
            {
              ok: false,
              error: {
                code: 'PAYLOAD_TOO_LARGE',
                message: 'Request body exceeds size limit',
              },
            },
            413,
          );
        }
      }
    }

    return next();
  };
}

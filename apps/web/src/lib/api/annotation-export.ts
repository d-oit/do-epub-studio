import type { ExportQuery } from '@do-epub-studio/schema';
import { apiRequest } from './core';

/**
 * Overall deadline for the EPUB export request, in milliseconds.
 *
 * The Worker validates the generated archive synchronously against the
 * EPUBCheck runner with a 130 s budget (`RUNNER_TIMEOUT_MS` in
 * `apps/worker/src/lib/epub-annotation-export.ts`) before returning bytes. This
 * deadline covers the runner budget plus R2 read, packaging, and transfer.
 * The deadline is a single window that starts when the caller invokes
 * `fetchAnnotationExport` and is never extended across retries: each retry
 * attempt keeps it (its own per-attempt timeout is set no shorter than this
 * value, so the overall controller always aborts first). Markdown/HTML export
 * stays on the shared client default deadline.
 */
export const EXPORT_EPUB_DEADLINE_MS = 140_000;

export type AnnotationExportOnlineFormat = Extract<ExportQuery['format'], 'html' | 'epub'>;

/**
 * Fetches an online annotation export (HTML or EPUB) and returns it as a
 * downloadable Blob. The EPUB request is bounded by a single overall deadline;
 * both formats honor the caller's `signal` for cancellation (panel close,
 * book/session change). No retry policy is added beyond the shared `apiRequest`
 * behavior, and the overall deadline is never extended by a retry.
 */
export async function fetchAnnotationExport(
  bookId: string,
  format: AnnotationExportOnlineFormat,
  token: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const endpoint = `/api/books/${encodeURIComponent(bookId)}/export?format=${format}`;

  if (format === 'epub') {
    const controller = new AbortController();
    const deadline = setTimeout(() => {
      controller.abort(new DOMException('Export deadline exceeded', 'TimeoutError'));
    }, EXPORT_EPUB_DEADLINE_MS);
    const abortFromCaller = () => controller.abort(signal?.reason);
    if (signal?.aborted) {
      controller.abort(signal.reason);
    } else {
      signal?.addEventListener('abort', abortFromCaller, { once: true });
    }
    try {
      const bytes = await apiRequest<ArrayBuffer>(endpoint, {
        token,
        responseType: 'arrayBuffer',
        // Per-attempt timeout must not be shorter than the overall deadline; the
        // overall AbortController above is the real bound across attempts.
        timeoutMs: EXPORT_EPUB_DEADLINE_MS,
        signal: controller.signal,
      });
      return new Blob([bytes], { type: 'application/epub+zip' });
    } finally {
      clearTimeout(deadline);
      signal?.removeEventListener('abort', abortFromCaller);
    }
  }

  const htmlExport = await apiRequest<{ format: 'html'; title: string; content: string }>(
    endpoint,
    { token, signal },
  );
  return new Blob([htmlExport.content], { type: 'text/html;charset=utf-8' });
}

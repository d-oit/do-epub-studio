import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * Read the request-context traceId from any Hono context without requiring the
 * caller's `Variables` typing to declare `requestContext`. The global
 * observability middleware always sets `requestContext` before routes/middleware
 * run, so the value is present at runtime; the defensive cast keeps middleware
 * typed with narrower `Variables` (e.g. only `auth`) type-safe. Returns
 * `undefined` only if the value is somehow absent — never a bool cast.
 */
export function getRequestTraceId(c: Context): string | undefined {
  const ctx = c.get('requestContext') as { traceId?: string } | undefined;
  return ctx?.traceId;
}

/**
 * Build the app-standard inline error envelope `{ ok: false, error: { code, message, traceId } }`.
 *
 * Every non-success inline envelope produced in the worker must carry the
 * request's `traceId` so clients can correlate failures with server logs
 * (Plan 228, O7). Use this instead of ad-hoc `c.json(...)` error objects.
 */
export function apiError(
  c: Context,
  status: ContentfulStatusCode,
  code: string,
  message: string,
  headers?: Record<string, string>,
): Response {
  return c.json({ ok: false, error: { code, message, traceId: getRequestTraceId(c) } }, status, headers);
}

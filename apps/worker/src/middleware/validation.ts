import type { MiddlewareHandler } from 'hono';
import type { Env } from '../lib/env';
import { formatZodError } from '@do-epub-studio/shared';
import { apiError } from '../lib/api-error';

/**
 * Global middleware that reformats zod validation errors from zValidator
 * into the app's standard error format { ok: false, error: { code, message } }.
 * Must be placed after route definitions to wrap their responses.
 */
export const validationErrorFormatter: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  await next();

  if (c.res.status !== 400) return;

  const clone = c.res.clone();
  try {
    const body: Record<string, unknown> = await clone.json();

    // Hono's zValidator returns { success: false, error: ZodError }
    // We check this BEFORE checking content-type or other things, because zValidator
    // might have already set the response.
    if (body.success === false && body.error && typeof body.error === 'object' && 'issues' in (body.error as Record<string, unknown>)) {
      const err = body.error as { issues: Array<{ path: (string | number)[]; message: string }> };
      c.res = apiError(c, 400, 'VALIDATION_ERROR', formatZodError(err));
      return;
    }

    // If it's already in our standard format, or not JSON, skip
    const contentType = c.res.headers.get('content-type');
    if (!contentType?.includes('application/json')) return;
    if (body.ok === false && body.error) return;

    const err = body.error;
    if (err && typeof err === 'object' && 'issues' in err && Array.isArray(err.issues)) {
      c.res = apiError(c, 400, 'VALIDATION_ERROR', formatZodError(err as { issues: Array<{ path: (string | number)[]; message: string }> }));
    }
  } catch {
    // Response body is not parseable JSON — leave it as-is
  }
};

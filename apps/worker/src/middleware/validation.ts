import type { MiddlewareHandler } from 'hono';
import type { Env } from '../lib/env';
import { formatZodError } from '@do-epub-studio/shared';

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
    const err = body.error;
    if (err && typeof err === 'object' && 'issues' in err && Array.isArray(err.issues)) {
      c.res = c.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: formatZodError(err as { issues: Array<{ path: (string | number)[]; message: string }> }),
          },
        },
        400,
      );
    }
  } catch {
    // Response body is not parseable JSON — leave it as-is
  }
};

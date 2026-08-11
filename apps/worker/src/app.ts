import { Hono } from 'hono';
import { isAppError, toApiError, ValidationError } from '@do-epub-studio/shared';
import type { Env } from './lib/env';
import type { RequestContext } from './lib/observability';
import { observabilityMiddleware } from './middleware/observability';
import { securityHeadersMiddleware } from './middleware/security-headers';
import { corsMiddleware } from './middleware/cors';
import { applyRateLimit, addRateLimitHeaders } from './middleware/rate-limit';
import { bodySizeLimit } from './middleware/body-size-limit';
import {
  accessRouter,
  booksRouter,
  catalogRouter,
  readerStateRouter,
  commentsRouter,
  filesRouter,
  adminRouter,
  securityRouter,
  telemetryRouter,
  notificationsRouter,
  searchRouter,
  exportRouter,
} from './routes';
import { validationErrorFormatter } from './middleware/validation';

export const app = new Hono<{ Bindings: Env; Variables: { requestContext: RequestContext } }>();

app.use('*', observabilityMiddleware);
app.use('*', corsMiddleware);
app.use('*', securityHeadersMiddleware);

// Security: Guard against ReDoS by limiting path length.
// Runs after observability so the 414 response carries a traceId.
app.use('*', async (c, next) => {
  if (c.req.path.length > 2048) {
    const ctx = c.get('requestContext');
    return c.json({ ok: false, error: { code: 'URI_TOO_LONG', message: 'URI too long', traceId: ctx.traceId } }, 414);
  }
  await next();
});

// Body size limit — rejects payloads > 1 MiB (upload route is exempt).
app.use('*', bodySizeLimit());

// Rate Limiting
app.use('*', async (c, next) => {
  const { response: rateLimitResponse, metadata } = await applyRateLimit(c.req.raw, c.env, c.get('requestContext').traceId);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  await next();

  if (metadata) {
    addRateLimitHeaders(c.res, metadata);
  }
});

// OPTIONS handler for CORS
app.options('*', (_c) => {
  return new Response(null, { status: 204 });
});

// Reformat zValidator error responses to match app standard format
app.use('*', validationErrorFormatter);

app.route('/api/access', accessRouter);
app.route('/api/books', booksRouter);
app.route('/api/catalog', catalogRouter);
app.route('/api/books', readerStateRouter);
app.route('/api', commentsRouter);
app.route('/api/files', filesRouter);
app.route('/api/admin', adminRouter);
app.route('/api', securityRouter);
app.route('/api', telemetryRouter);
app.route('/api', notificationsRouter);
app.route('/api', searchRouter);
app.route('/api', exportRouter);

app.onError((err, c) => {
  const ctx = c.get('requestContext');
  const apiError = toApiError(err, ctx.traceId);
  const status = isAppError(err) ? err.statusCode : 500;
  const details = err instanceof ValidationError && err.issues?.length ? { details: err.issues } : {};
  return c.json({ ok: false, error: { ...apiError, ...details }, status } as never, status as 400 | 401 | 403 | 404 | 409 | 413 | 423 | 429 | 500 | 504);
});

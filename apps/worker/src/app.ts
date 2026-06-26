import { Hono } from 'hono';
import { TRACE_HEADER, createTraceId } from '@do-epub-studio/shared';
import type { Env } from './lib/env';
import { observabilityMiddleware } from './middleware/observability';
import { securityHeadersMiddleware } from './middleware/security-headers';
import { corsMiddleware } from './middleware/cors';
import { applyRateLimit, addRateLimitHeaders } from './middleware/rate-limit';
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
} from './routes';
import { validationErrorFormatter } from './middleware/validation';

export const app = new Hono<{ Bindings: Env }>();

app.use('*', observabilityMiddleware);

// Security: Guard against ReDoS by limiting path length.
// Runs after observability so the 414 response carries a traceId.
app.use('*', async (c, next) => {
  if (c.req.path.length > 2048) {
    const traceId = c.req.header(TRACE_HEADER) ?? createTraceId();
    return c.json({ ok: false, error: { code: 'URI_TOO_LONG', message: 'URI too long', traceId } }, 414);
  }
  await next();
});
app.use('*', corsMiddleware);
app.use('*', securityHeadersMiddleware);

// Rate Limiting
app.use('*', async (c, next) => {
  const { response: rateLimitResponse, metadata } = await applyRateLimit(c.req.raw, c.env);
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

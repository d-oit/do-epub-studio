import { Hono } from 'hono';
import type { Env } from './lib/env';
import { observabilityMiddleware } from './middleware/observability';
import { securityHeadersMiddleware } from './middleware/security-headers';
import { corsMiddleware } from './middleware/cors';
import { applyRateLimit, addRateLimitHeaders } from './middleware/rate-limit';
import {
  accessRouter,
  booksRouter,
  readerStateRouter,
  commentsRouter,
  filesRouter,
  adminRouter,
  securityRouter,
} from './routes';
import { validationErrorFormatter } from './middleware/validation';

export const app = new Hono<{ Bindings: Env }>();

// Security: Guard against ReDoS by limiting path length
app.use('*', async (c, next) => {
  if (c.req.path.length > 2048) {
    return c.json({ ok: false, error: { code: 'URI_TOO_LONG', message: 'URI too long' } }, 414);
  }
  await next();
});

app.use('*', observabilityMiddleware);
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
app.route('/api/books', readerStateRouter);
app.route('/api', commentsRouter);
app.route('/api/files', filesRouter);
app.route('/api/admin', adminRouter);
app.route('/api', securityRouter);

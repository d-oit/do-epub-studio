import { Hono } from 'hono';
import type { Env } from './lib/env';
import {
  createRequestContext,
  logRequestEnd,
  logRequestError,
  logRequestStart,
  withTraceHeaders,
} from './lib/observability';
import { applySecurityHeaders, applyMinimalSecurityHeaders } from './lib/security-headers';
import { applyRateLimit, addRateLimitHeaders } from './middleware/rate-limit';
import { TRACE_HEADER, SPAN_HEADER } from '@do-epub-studio/shared';

export const app = new Hono<{ Bindings: Env }>();

// Security: Guard against ReDoS by limiting path length
app.use('*', async (c, next) => {
  if (c.req.path.length > 2048) {
    return c.json({ ok: false, error: { code: 'URI_TOO_LONG', message: 'URI too long' } }, 414);
  }
  await next();
});

// Observability and Security Headers Middleware
app.use('*', async (c, next) => {
  const context = createRequestContext(c.req.raw);
  logRequestStart(context);

  try {
    const { response: rateLimitResponse, metadata } = await applyRateLimit(c.req.raw, c.env);
    if (rateLimitResponse) {
      logRequestEnd(context, rateLimitResponse.status);
      let res = withTraceHeaders(rateLimitResponse, context);
      res = applyCorsHeaders(res, c.req.raw, c.env);
      return applySecurityHeaders(res);
    }

    await next();

    if (metadata) {
      addRateLimitHeaders(c.res, metadata);
    }

    logRequestEnd(context, c.res.status);

    // Apply appropriate security headers IF NOT ALREADY SET by route (like files)
    if (!c.res.headers.has('Content-Security-Policy')) {
      if (c.req.path.startsWith('/api/files/')) {
        applyMinimalSecurityHeaders(c.res);
      } else {
        applySecurityHeaders(c.res);
      }
    }

    applyCorsHeaders(c.res, c.req.raw, c.env);
    withTraceHeaders(c.res, context);

  } catch (error) {
    logRequestError(context, error);
    logRequestEnd(context, 500);
    const failure = c.json(
      {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          traceId: context.traceId,
        },
      },
      500,
    );
    let res = withTraceHeaders(failure, context);
    res = applyCorsHeaders(res, c.req.raw, c.env);
    return applySecurityHeaders(res);
  }
});

/**
 * Apply restricted CORS headers based on the environment configuration.
 */
function applyCorsHeaders(response: Response, request: Request, env: Env): Response {
  const origin = request.headers.get('Origin');
  const allowedOrigin = origin === env.APP_BASE_URL ? origin : env.APP_BASE_URL;

  response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  response.headers.set(
    'Access-Control-Allow-Headers',
    `Content-Type, Authorization, ${TRACE_HEADER}, ${SPAN_HEADER}`,
  );
  response.headers.set('Vary', 'Origin, Access-Control-Request-Headers');

  return response;
}

// OPTIONS handler for CORS
app.options('*', (c) => {
  const response = new Response(null, { status: 204 });
  return applyMinimalSecurityHeaders(applyCorsHeaders(response, c.req.raw, c.env));
});

import {
  accessRouter,
  booksRouter,
  readerStateRouter,
  commentsRouter,
  filesRouter,
  adminRouter,
  securityRouter,
} from './routes';

app.route('/api/access', accessRouter);
app.route('/api/books', booksRouter);
app.route('/api/books', readerStateRouter);
app.route('/api', commentsRouter);
app.route('/api/files', filesRouter);
app.route('/api/admin', adminRouter);
app.route('/api', securityRouter);

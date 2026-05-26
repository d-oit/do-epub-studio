import type { MiddlewareHandler } from 'hono';
import type { Env } from '../lib/env';
import { TRACE_HEADER, SPAN_HEADER } from '@do-epub-studio/shared';

/**
 * Apply restricted CORS headers based on the environment configuration.
 */
export const corsMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const origin = c.req.header('Origin');
  const allowedOrigin = origin === c.env.APP_BASE_URL ? origin : c.env.APP_BASE_URL;

  await next();

  c.res.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  c.res.headers.set(
    'Access-Control-Allow-Headers',
    `Content-Type, Authorization, ${TRACE_HEADER}, ${SPAN_HEADER}`,
  );
  c.res.headers.set('Vary', 'Origin, Access-Control-Request-Headers');
};

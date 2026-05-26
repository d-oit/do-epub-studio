import type { MiddlewareHandler } from 'hono';
import {
  createRequestContext,
  logRequestEnd,
  logRequestError,
  logRequestStart,
  withTraceHeaders,
} from '../lib/observability';

export const observabilityMiddleware: MiddlewareHandler = async (c, next) => {
  const context = createRequestContext(c.req.raw);
  logRequestStart(context);

  try {
    await next();
    logRequestEnd(context, c.res.status);
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
    return withTraceHeaders(failure, context);
  }
};

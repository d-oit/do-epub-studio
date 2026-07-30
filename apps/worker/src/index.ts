/**
 * Monolithic router entry point.
 * All requests are delegated to the Hono app in app.ts, which manages
 * modularized route handlers and centralized input validation.
 */
import * as Sentry from '@sentry/cloudflare';
import { RateLimiterDO } from './lib/rate-limiter-do';
import { app } from './app';
import type { Env } from './lib/env';

export { RateLimiterDO };

function makeFetchHandler() {
  return { fetch: app.fetch };
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
    if (!env.SENTRY_DSN) {
      return app.fetch(request, env, ctx);
    }
    return Sentry.withSentry(
      () => ({
        dsn: env.SENTRY_DSN as string,
        tracesSampleRate: 0.1,
        environment: (env as unknown as Record<string, string>).ENVIRONMENT ?? 'production',
      }),
      makeFetchHandler(),
    ).fetch(request, env, ctx);
  },
};

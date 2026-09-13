/**
 * Monolithic router entry point.
 * All requests are delegated to the Hono app in app.ts, which manages
 * modularized route handlers and centralized input validation.
 */
import * as Sentry from '@sentry/cloudflare';
import { RateLimiterDO } from './lib/rate-limiter-do';
import { app } from './app';
import type { Env } from './lib/env';
import { registerArgon2Wasm } from './lib/register-argon2-wasm';

export { RateLimiterDO };

const handle = async (...args: Parameters<typeof app.fetch>): Promise<Response> => {
  // GOAP-252: Cloudflare forbids runtime WebAssembly.compile(), so
  // argon2-wasm-edge needs its pre-compiled modules registered before any
  // hashPassword/verifyPassword call — otherwise verification silently fails
  // ("Invalid password"). Idempotent per isolate; resolved promise after the
  // first call. The Pages Function entry (apps/web/functions/api/[[path]].ts)
  // performs the same registration for the Pages deploy path.
  await registerArgon2Wasm();
  return app.fetch(...args);
};

function makeFetchHandler() {
  return { fetch: handle };
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
    if (!env.SENTRY_DSN) {
      return handle(request, env, ctx);
    }
    return Sentry.withSentry(
      () => ({
        dsn: env.SENTRY_DSN as string,
        tracesSampleRate: 0.1,
        environment: env.ENVIRONMENT ?? 'production',
      }),
      makeFetchHandler(),
    ).fetch(request, env, ctx);
  },
};

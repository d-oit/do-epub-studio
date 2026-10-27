/**
 * Cloudflare Pages Function (GOAP-252 / issue #1014).
 *
 * Serves the existing Worker API (`apps/worker`) on the SAME origin as the
 * Pages-hosted frontend. The frontend build runs on Cloudflare directly
 * (Pages Git integration, see root `wrangler.toml`), so production needs no
 * separate Worker deployment, no CORS, and no `VITE_API_BASE_URL` — the web
 * app's production default (`window.location.origin`) already targets
 * same-origin `/api/*`.
 *
 * This catch-all only matches `/api/*`; every other path falls through to the
 * static SPA untouched. Bindings (D1 `DB`, R2 `BOOKS_BUCKET`, KV `CACHE_KV`)
 * plus vars/secrets are configured on the Pages project in the Cloudflare
 * dashboard. Notes:
 *  - The `RATE_LIMITER` Durable Object cannot be created inside a Pages
 *    project. Demo login uses the D1 fallback when that binding is absent.
 *  - Email Sending is not a Pages Function binding; recovery email falls back
 *    to `LoggingEmailTransport` (login is unaffected).
 */
import { app } from '../../../worker/src/app';
import type { Env } from '../../../worker/src/lib/env';
import { registerArgon2Wasm } from '../../../worker/src/lib/register-argon2-wasm';

interface PagesFunctionContext {
  request: Request;
  env: Env;
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

export async function onRequest(context: PagesFunctionContext): Promise<Response> {
  // Register the pre-compiled Argon2 wasm modules before the Hono app runs so
  // password hashing (argon2-wasm-edge) works on Pages. Idempotent and cheap.
  await registerArgon2Wasm();

  const executionCtx = {
    waitUntil: (promise: Promise<unknown>) => {
      context.waitUntil(promise);
    },
    passThroughOnException: () => {
      context.passThroughOnException();
    },
    props: {},
  };
  // Pages preview URLs vary per deployment/branch. The config's production
  // origin must not send signed demo EPUB URLs, invitation links or WebAuthn
  // ceremonies to production's unrelated database and bucket.
  const url = new URL(context.request.url);
  const env =
    context.env.ENVIRONMENT === 'preview'
      ? {
          ...context.env,
          APP_BASE_URL: url.origin,
          WEBAUTHN_RP_ID: url.hostname,
          WEBAUTHN_ORIGIN: url.origin,
        }
      : context.env;
  return app.fetch(context.request, env, executionCtx as ExecutionContext);
}

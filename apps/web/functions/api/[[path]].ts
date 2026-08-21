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
 *    project, so rate limiting fails open (documented behavior in
 *    `apps/worker/src/lib/rate-limit-client.ts`).
 *  - Email Sending is not a Pages Function binding; recovery email falls back
 *    to `LoggingEmailTransport` (login is unaffected).
 */
import { app } from '../../../worker/src/app';
import type { Env } from '../../../worker/src/lib/env';
import { registerArgon2Wasm } from '../../../worker/src/lib/register-argon2-wasm';

interface PagesFunctionContext {
  request: Request;
  env: Env;
  ctx: ExecutionContext;
}

export async function onRequest(context: PagesFunctionContext): Promise<Response> {
  // Register the pre-compiled Argon2 wasm modules before the Hono app runs so
  // password hashing (argon2-wasm-edge) works on Pages. Idempotent and cheap.
  await registerArgon2Wasm();
  // TEMPORARY diagnostic (GOAP-252): surface whether the Pages execution
  // context reached `app.fetch` (c.executionCtx throws otherwise).
  const diagReq = new Request(context.request, {
    headers: new Headers(context.request.headers),
  });
  diagReq.headers.set('x-diag-has-ctx', String(typeof context.ctx !== 'undefined'));
  diagReq.headers.set('x-diag-ctx-keys', typeof context.ctx === 'object' && context.ctx !== null ? Object.keys(context.ctx).join(',') : 'n/a');
  return app.fetch(diagReq, context.env, context.ctx);
}

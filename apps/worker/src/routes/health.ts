import { Hono } from 'hono';
import type { Env } from '../lib/env';

/**
 * Liveness probe (ADR-252): `GET /api/health` must return a non-HTML,
 * non-5xx JSON response so deploy smoke checks can distinguish a live
 * worker API from a static host that swallowed `/api/*` via SPA fallback.
 * Deliberately dependency-free — it does not touch the database, so the
 * probe answers even during transient DB issues (liveness, not readiness).
 */
export const healthRouter = new Hono<{ Bindings: Env }>();

healthRouter.get('/health', (c) => {
  // TEMPORARY diagnostic (GOAP-252): report whether Pages bindings reached the
  // function so we can confirm D1/KV attach to Git-integrated builds. Removed
  // once the binding wiring is verified on production.
  return c.json({
    ok: true,
    service: 'do-epub-studio-worker',
    diag: {
      hasDb: typeof c.env.DB !== 'undefined',
      hasKv: typeof c.env.CACHE_KV !== 'undefined',
      env: c.env.ENVIRONMENT ?? null,
      baseUrl: c.env.APP_BASE_URL ?? null,
    },
  });
});

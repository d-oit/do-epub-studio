import { Hono } from 'hono';
import type { Env } from '../lib/env';
import { createRequestContext, withTraceHeaders } from '../lib/observability';

/**
 * Liveness probe (ADR-252): `GET /api/health` must return a non-HTML,
 * non-5xx JSON response so deploy smoke checks can distinguish a live
 * worker API from a static host that swallowed `/api/*` via SPA fallback.
 * Deliberately dependency-free — it does not touch the database, so the
 * probe answers even during transient DB issues (liveness, not readiness).
 * Trace headers are attached so the probe itself is traceable end-to-end
 * (traceId appears on every API response in error paths too, per the
 * traceId contract).
 */
export const healthRouter = new Hono<{ Bindings: Env }>();

healthRouter.get('/health', (c) => {
  const ctx = createRequestContext(c.req.raw);
  return withTraceHeaders(c.json({ ok: true, service: 'do-epub-studio-worker' }), ctx);
});

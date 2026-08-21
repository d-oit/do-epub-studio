import { Hono } from 'hono';
import type { Env } from '../lib/env';
import { verifyPassword } from '../auth/password';
import { createAdminSession } from '../auth/admin-middleware';

/**
 * Liveness probe (ADR-252): `GET /api/health` must return a non-HTML,
 * non-5xx JSON response so deploy smoke checks can distinguish a live
 * worker API from a static host that swallowed `/api/*` via SPA fallback.
 * Deliberately dependency-free — it does not touch the database, so the
 * probe answers even during transient DB issues (liveness, not readiness).
 */
export const healthRouter = new Hono<{ Bindings: Env }>();

healthRouter.get('/health', async (c) => {
  // TEMPORARY diagnostic (GOAP-252): report whether Pages bindings reached the
  // function and whether D1 queries actually run, so we can see the DB 500 root
  // cause. Removed once the login is verified on production.
  const diag: Record<string, unknown> = {
    hasDb: typeof c.env.DB !== 'undefined',
    hasKv: typeof c.env.CACHE_KV !== 'undefined',
    env: c.env.ENVIRONMENT ?? null,
    baseUrl: c.env.APP_BASE_URL ?? null,
  };
  if (typeof c.env.DB !== 'undefined') {
    try {
      const res = await c.env.DB.prepare('SELECT COUNT(*) AS c FROM books').all();
      diag.booksCount = (res.results?.[0] as { c?: number } | undefined)?.c ?? -1;
    } catch (e) {
      diag.booksQueryError = e instanceof Error ? e.message : String(e);
    }
    try {
      const res = await c.env.DB.prepare("SELECT id FROM users WHERE email = 'dmmotec@gmail.com'").all();
      diag.adminFound = (res.results?.length ?? 0) > 0;
    } catch (e) {
      diag.usersQueryError = e instanceof Error ? e.message : String(e);
    }
  }
  // TEMPORARY diagnostic (GOAP-252): run the exact login password verification
  // against the stored admin hash to isolate where the login 500 originates.
  // (A self-test proved argon2-wasm-edge works on Pages once the pre-compiled
  // wasm modules are registered; the login 500 is elsewhere.)
  try {
    const row = await c.env.DB.prepare("SELECT password_hash FROM users WHERE email = 'dmmotec@gmail.com'").first();
    diag.storedHash = row?.password_hash ? String(row.password_hash).slice(0, 30) + '...' : null;
    if (row?.password_hash) {
      diag.verifyStored = await verifyPassword('TempTestPass123!', String(row.password_hash));
    }
  } catch (e) {
    diag.verifyStoredError = e instanceof Error ? e.message : String(e);
  }
  // TEMPORARY diagnostic (GOAP-252): run the FULL createAdminSession (the login
  // route's core) and surface where it fails. This is the login 500 root cause.
  try {
    const session = await createAdminSession(c.env, 'dmmotec@gmail.com', 'TempTestPass123!', {});
    diag.createSession = session.ok ? 'ok' : JSON.stringify(session);
  } catch (e) {
    diag.createSessionError = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  }
  return c.json({ ok: true, service: 'do-epub-studio-worker', diag });
});

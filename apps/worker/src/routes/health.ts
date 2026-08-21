import { Hono } from 'hono';
import type { Env } from '../lib/env';
import { argon2id, argon2Verify } from 'argon2-wasm-edge';

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
  // TEMPORARY argon2 self-test (GOAP-252): prove the hashing runtime works on
  // Pages. If this fails, login's verifyPassword silently returns false -> 401.
  try {
    const h = await argon2id({
      password: 'selftest-pass',
      salt: new Uint8Array(16),
      iterations: 3,
      parallelism: 4,
      memorySize: 65536,
      hashLength: 32,
      outputType: 'encoded',
    });
    diag.argon2SelfTest = await argon2Verify({ password: 'selftest-pass', hash: h });
  } catch (e) {
    diag.argon2SelfTestError = e instanceof Error ? e.message : String(e);
  }
  return c.json({ ok: true, service: 'do-epub-studio-worker', diag });
});

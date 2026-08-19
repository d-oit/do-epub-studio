/**
 * ADR-244 / GOAP-244: Demo login entry points.
 *
 * Separate Worker endpoints that mint sessions for the reserved demo
 * accounts (ADR-233) without requiring the browser to ship demo passwords.
 *
 * Fail-closed gates (all must pass before any session is minted):
 *  1. DEMO_LOGIN_ENABLED === '1' (server-side flag)
 *  2. Environment is not production-like
 *  3. Target account exists and is marked created_by_demo = 1
 *  4. Target account is not disabled or compromised
 *  5. Reader: demo book + live grant exist
 *  6. Admin: account global_role === 'admin'
 *
 * All error paths return a generic DEMO_DISABLED response to avoid
 * revealing whether demo accounts exist in this deployment.
 */

import { Hono, type Context } from 'hono';
import type { Env, JsonRow } from '../lib/env';
import type { RequestContext } from '../lib/observability';
import { getClientIp, hashString } from './admin/auth/shared';
import { createSession } from '../auth/session';
import { getGrantByBookAndSession, computeCapabilities } from '../auth/password';
import { createAdminDemoSession, type AdminSessionUser, type AdminSessionClientHints } from '../auth/admin-middleware';
import { accountIsLocked } from '../auth/account';
import { logAudit } from '../audit';
import { logRiskEvent, RISK_EVENTS } from '../audit/risk';
import { queryFirst } from '../db/client';
import { apiError } from '../lib/api-error';
import { checkRateLimitDO } from '../lib/rate-limit-client';

export const demoRouter = new Hono<{ Bindings: Env; Variables: { requestContext: RequestContext } }>();

type DemoContext = Context<{ Bindings: Env; Variables: { requestContext: RequestContext } }>;

/** Reserved demo account identifiers (ADR-233 seed contract). */
const DEMO_READER_EMAIL = 'demo.reader@example.local';
const DEMO_ADMIN_EMAIL = 'demo.admin@example.local';

interface DemoUserRow extends JsonRow {
  id: string;
  email: string;
  global_role: string;
  created_by_demo: number;
  disabled_at: string | null;
  compromised_at: string | null;
}

/**
 * Production indicators (any one is enough). Mirrors the seed-script guard
 * so the worker and seed agree on what "production" means.
 */
function isProductionLike(env: Env): boolean {
  if (String(env.ENVIRONMENT || '').toLowerCase() === 'production') return true;
  if (env.CF_PAGES === '1' && !env.DEMO_ACCOUNTS_PROD_ALLOWLIST) return true;
  if (String(env.TURSO_DATABASE_URL || '').toLowerCase().includes('production')) return true;
  return false;
}

function demoDisabled(c: DemoContext) {
  return apiError(c, 403, 'DEMO_DISABLED', 'Demo login is not available.');
}

/**
 * Shared gate check for both demo endpoints. Returns null when all gates
 * pass, or a Response when the request should be rejected.
 */
async function checkDemoGates(
  c: DemoContext,
  rateLimitKey: string,
): Promise<Response | { ipHash: string }> {
  if (c.env.DEMO_LOGIN_ENABLED !== '1') {
    return demoDisabled(c);
  }

  if (isProductionLike(c.env)) {
    return demoDisabled(c);
  }

  const ipHash = await hashString(getClientIp(c));
  const rateLimit = await checkRateLimitDO(c.env, rateLimitKey, ipHash, {
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) {
    return apiError(c, 429, 'TOO_MANY_REQUESTS', 'Too many demo login attempts. Please try again later.');
  }

  return { ipHash };
}

// ---------------------------------------------------------------------------
// POST /api/demo/reader-login
// ---------------------------------------------------------------------------

demoRouter.post('/reader-login', async (c) => {
  const gateResult = await checkDemoGates(c, 'demo_reader_login');
  if (gateResult instanceof Response) {
    return gateResult;
  }
  const { ipHash } = gateResult;

  const bookSlug = c.env.DEMO_BOOK_SLUG || 'demo';

  // Gate 3 + 4: look up the demo reader account, verify created_by_demo and not locked
  const user = await queryFirst<DemoUserRow>(
    c.env,
    `SELECT id, email, global_role, created_by_demo, disabled_at, compromised_at
     FROM users WHERE email = ?`,
    [DEMO_READER_EMAIL],
  );

  if (!user || user.created_by_demo !== 1 || accountIsLocked(user)) {
    await logRiskEvent(c.env, c.executionCtx, {
      kind: RISK_EVENTS.loginLocked,
      entityId: DEMO_READER_EMAIL,
      entityType: 'user',
      payload: { reason: 'demo_reader_unavailable', ipHash },
    });
    return demoDisabled(c);
  }

  // Gate 5: verify the demo book exists and the demo reader has a live grant.
  // Direct lookup (not validateGrant) so the demo login never depends on the
  // operator-supplied reader password hash (ADR-233 seeds one when
  // DEMO_READER_PASSWORD is set). Server-minted, password-free session.
  const book = await queryFirst<{
    id: string;
    slug: string;
    title: string;
    author_name: string | null;
    visibility: string;
    cover_image_url: string | null;
  }>(
    c.env,
    `SELECT id, slug, title, author_name, visibility, cover_image_url
     FROM books WHERE slug = ?`,
    [bookSlug],
  );
  if (!book) {
    return demoDisabled(c);
  }

  const grant = await getGrantByBookAndSession(c.env, book.id, DEMO_READER_EMAIL);
  if (!grant || (grant.expires_at && new Date(grant.expires_at) < new Date())) {
    return demoDisabled(c);
  }

  // Mint the session — same shape as /api/access/request
  const session = await createSession(c.env, book.id, DEMO_READER_EMAIL);

  await logAudit(c.env, {
    entityType: 'session',
    entityId: book.id,
    action: 'demo_reader_login',
    actorEmail: DEMO_READER_EMAIL,
    payload: { grantId: grant.id, ipHash },
  }, c.executionCtx);

  return c.json({
    ok: true,
    data: {
      sessionToken: session.token,
      expiresAt: session.expiresAt,
      book: {
        id: book.id,
        slug: book.slug,
        title: book.title,
        authorName: book.author_name,
        visibility: book.visibility,
        coverImageUrl: book.cover_image_url,
      },
      capabilities: computeCapabilities(grant),
    },
  });
});

// ---------------------------------------------------------------------------
// POST /api/demo/admin-login
// ---------------------------------------------------------------------------

demoRouter.post('/admin-login', async (c) => {
  const gateResult = await checkDemoGates(c, 'demo_admin_login');
  if (gateResult instanceof Response) {
    return gateResult;
  }
  const { ipHash } = gateResult;

  // Gate 3 + 4: look up the demo admin account, verify created_by_demo, role, and not locked
  const user = await queryFirst<DemoUserRow>(
    c.env,
    `SELECT id, email, global_role, created_by_demo, disabled_at, compromised_at
     FROM users WHERE email = ?`,
    [DEMO_ADMIN_EMAIL],
  );

  if (!user || user.created_by_demo !== 1 || accountIsLocked(user)) {
    await logRiskEvent(c.env, c.executionCtx, {
      kind: RISK_EVENTS.loginLocked,
      entityId: DEMO_ADMIN_EMAIL,
      entityType: 'user',
      payload: { reason: 'demo_admin_unavailable', ipHash },
    });
    return demoDisabled(c);
  }

  // Gate 5: verify admin role
  if (user.global_role !== 'admin') {
    return demoDisabled(c);
  }

  const clientHints: AdminSessionClientHints = { ipHash };
  const publicUser: AdminSessionUser = { id: user.id, email: user.email, role: user.global_role };
  const result = await createAdminDemoSession(c.env, publicUser, clientHints);

  if (!result.ok) {
    await logRiskEvent(c.env, c.executionCtx, {
      kind: RISK_EVENTS.loginLocked,
      entityId: DEMO_ADMIN_EMAIL,
      entityType: 'user',
      payload: { reason: 'demo_admin_mfa_required', ipHash },
    });
    return demoDisabled(c);
  }

  await logAudit(c.env, {
    entityType: 'user',
    entityId: user.id,
    action: 'demo_admin_login',
    actorEmail: DEMO_ADMIN_EMAIL,
    payload: { role: user.global_role, ipHash },
  }, c.executionCtx);

  return c.json({
    ok: true,
    data: {
      token: result.token,
      user: {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
      },
    },
  });
});

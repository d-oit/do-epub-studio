import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../lib/env';
import type { RequestContext } from '../lib/observability';
import { validateGrant, computeCapabilities, getGrantByBookAndSession, getGrantsBySession } from '../auth/password';
import { createSession, validateSession, revokeSession } from '../auth/session';
import {
  createResetToken,
  verifyResetToken,
  bumpResetTokenAttempt,
  markResetTokenUsed,
} from '../auth/reset';
import { logAudit } from '../audit';
import { AccessRequestSchema, RecoveryRequestSchema, RecoveryVerifySchema } from '@do-epub-studio/shared';
import { ValidateQuerySchema } from '@do-epub-studio/schema';
import { checkRateLimitDO, deleteRateLimitKey } from '../lib/rate-limit-client';
import { queryFirst } from '../db/client';
import { createEmailTransport } from '../lib/email-transport';
import { apiError } from '../lib/api-error';

function getClientIp(c: { req: { header(name: string): string | undefined } }): string {
  return c.req.header('CF-Connecting-IP') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

async function hashString(value: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const accessRouter = new Hono<{ Bindings: Env; Variables: { requestContext: RequestContext } }>();

accessRouter.post('/recovery-request', zValidator('json', RecoveryRequestSchema), async (c) => {
  const { bookSlug, email } = c.req.valid('json');
  const emailKey = email.toLowerCase();
  const traceId = c.get('requestContext').traceId;
  const ipHash = await hashString(`${getClientIp(c)}:${bookSlug}`);

  // Rate limit by email (max 3 per 5 min) + by IP to bound abuse (ADR-232).
  const accountRate = await checkRateLimitDO(c.env, 'auth_recovery', emailKey, {
    maxRequests: 3,
    windowMs: 300_000,
  });
  const ipRate = await checkRateLimitDO(c.env, 'auth_recovery_ip', ipHash, {
    maxRequests: 10,
    windowMs: 300_000,
  });

  if (!accountRate.allowed || !ipRate.allowed) {
    return apiError(c, 429, 'TOO_MANY_REQUESTS', 'Too many recovery attempts. Please try again later.');
  }

  const book = await queryFirst<{ id: string; slug: string }>(
    c.env,
    'SELECT id, slug FROM books WHERE slug = ?',
    [bookSlug]
  );

  if (book) {
    const grant = await getGrantByBookAndSession(c.env, book.id, emailKey);

    if (grant && !grant.revoked_at && (!grant.expires_at || new Date(grant.expires_at) > new Date())) {
      const token = await createResetToken(c.env, {
        purpose: 'reader_magic_link',
        email: emailKey,
        ipHash,
        traceId,
      });
      const recoveryUrl = `${c.env.APP_BASE_URL}/login?book=${bookSlug}&token=${token}`;

      const transport = createEmailTransport(c.env);
      await transport.send({
        to: emailKey,
        subject: 'Recover access to your book',
        text: `Click the link to recover access (valid for 30 minutes): ${recoveryUrl}`,
        html: `<p>Click <a href="${recoveryUrl}">here</a> to recover access to your book. This link expires in 30 minutes.</p>`,
        context: c.get('requestContext'),
      });

      await logAudit(c.env, {
        entityType: 'session',
        entityId: book.id,
        action: 'recovery_requested',
        actorEmail: emailKey,
        payload: { ipHash },
      }, c.executionCtx);
    }
  }

  // Always return success to prevent user enumeration
  return c.json({ ok: true });
});

accessRouter.post('/verify-recovery', zValidator('json', RecoveryVerifySchema), async (c) => {
  const { token } = c.req.valid('json');
  const traceId = c.get('requestContext').traceId;

  const verify = await verifyResetToken(c.env, token, 'reader_magic_link');

  if (!verify.ok) {
    const reason = verify.reason;
    await logAudit(c.env, {
      entityType: 'session',
      entityId: 'unknown',
      action: 'recovery_denied',
      payload: { reason: reason === 'used' ? 'replay' : reason, traceId },
    }, c.executionCtx);
    return apiError(c, 401, 'INVALID_TOKEN', 'Invalid or expired recovery link');
  }

  await bumpResetTokenAttempt(c.env, verify.record.id);

  const grantedEmail = verify.record.email;
  if (!grantedEmail) {
    return apiError(c, 401, 'INVALID_TOKEN', 'Invalid or expired recovery link');
  }

  // Reader magic-link tokens carry only the grant email; issue the session
  // bound to that reader's first active grant (ADR-232 persisted flow).
  const grants = await getGrantsBySession(c.env, grantedEmail);
  const activeGrant = grants.find(
    (g) => !g.revoked_at && (!g.expires_at || new Date(g.expires_at) > new Date()),
  );

  if (!activeGrant) {
    await logAudit(c.env, {
      entityType: 'session',
      entityId: grantedEmail,
      action: 'recovery_denied',
      payload: { reason: 'no_grant', traceId },
    }, c.executionCtx);
    return apiError(c, 401, 'ACCESS_DENIED', 'Access denied');
  }

  const book = await queryFirst<{ id: string; slug: string; title: string; author_name: string | null; visibility: string; cover_image_url: string | null }>(
    c.env,
    `SELECT id, slug, title, author_name, visibility, cover_image_url FROM books WHERE id = ?`,
    [activeGrant.book_id],
  );

  if (!book) {
    return apiError(c, 401, 'ACCESS_DENIED', 'Access denied');
  }

  const session = await createSession(c.env, book.id, grantedEmail);

  // Single-use: mark the magic-link token consumed alongside session issuance.
  await markResetTokenUsed(c.env, verify.record.id);

  await logAudit(c.env, {
    entityType: 'session',
    entityId: book.id,
    action: 'access_granted',
    actorEmail: grantedEmail,
    payload: { grantId: activeGrant.id, method: 'magic_link' },
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
      capabilities: computeCapabilities(activeGrant),
    },
  });
});

accessRouter.post('/request', zValidator('json', AccessRequestSchema), async (c) => {
  const { bookSlug, email, password } = c.req.valid('json');
  const emailKey = email.toLowerCase();

  // Rate limit by email to prevent brute-force attacks (max 5 requests per minute)
  const rateLimit = await checkRateLimitDO(c.env, 'auth_access', emailKey, {
    maxRequests: 5,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return apiError(c, 429, 'TOO_MANY_REQUESTS', 'Too many login attempts. Please try again later.');
  }

  // Check account lockout (triggered after 5 consecutive failures; lasts 15 minutes)
  const lockoutCheck = await checkRateLimitDO(c.env, 'auth_lockout', emailKey, {
    maxRequests: 1,
    windowMs: 900_000,
  });

  if (!lockoutCheck.allowed) {
    const retryAfter = Math.ceil((lockoutCheck.resetAt - Date.now()) / 1000);
    return apiError(c, 423, 'ACCOUNT_LOCKED', 'Account temporarily locked due to repeated failed login attempts. Please try again later.', { 'Retry-After': String(retryAfter) });
  }

  const result = await validateGrant(c.env, bookSlug, emailKey, password);

  if (!result.valid || !result.grant || !result.book) {
    await logAudit(c.env, {
      entityType: 'session',
      entityId: bookSlug,
      action: 'access_denied',
      actorEmail: emailKey,
      payload: { reason: result.error },
    }, c.executionCtx);

    // Track consecutive failures; lock the account when the 5th failure occurs
    const failureCheck = await checkRateLimitDO(c.env, 'auth_failures', emailKey, {
      maxRequests: 5,
      windowMs: 900_000,
    });
    if (!failureCheck.allowed) {
      // 5th (or more) failure — write the lockout entry so the next attempt is blocked
      await checkRateLimitDO(c.env, 'auth_lockout', emailKey, {
        maxRequests: 1,
        windowMs: 900_000,
      });
    }

    return apiError(c, 401, 'ACCESS_DENIED', 'Access denied');
  }

  // Successful login — clear failure counter and any lingering lockout
  await Promise.all([
    deleteRateLimitKey(c.env, 'auth_failures', emailKey),
    deleteRateLimitKey(c.env, 'auth_lockout', emailKey),
  ]);

  const session = await createSession(c.env, result.book.id, emailKey);

  await logAudit(c.env, {
    entityType: 'session',
    entityId: result.book.id,
    action: 'access_granted',
    actorEmail: emailKey,
    payload: { grantId: result.grant.id },
  }, c.executionCtx);

  return c.json({
    ok: true,
    data: {
      sessionToken: session.token,
      expiresAt: session.expiresAt,
      book: {
        id: result.book.id,
        slug: result.book.slug,
        title: result.book.title,
        authorName: result.book.author_name,
        visibility: result.book.visibility,
        coverImageUrl: result.book.cover_image_url,
      },
      capabilities: computeCapabilities(result.grant),
    },
  });
});

accessRouter.post('/logout', async (c) => {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '') ?? '';

  await revokeSession(c.env, token);

  return c.json({ ok: true });
});

accessRouter.post('/refresh', async (c) => {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '') ?? '';

  const result = await validateSession(c.env, token);

  if (!result.valid || !result.session) {
    return apiError(c, 401, 'SESSION_INVALID', 'Invalid session');
  }

  if (!result.bookId) {
    return apiError(c, 401, 'SESSION_INVALID', 'Invalid session');
  }

  // Security: Verify the grant is still valid before refreshing
  const grant = await getGrantByBookAndSession(c.env, result.bookId, result.session.email);
  if (!grant || grant.revoked_at || (grant.expires_at && new Date(grant.expires_at) < new Date())) {
    return apiError(c, 403, 'ACCESS_DENIED', 'Access has been revoked or expired');
  }

  const newSession = await createSession(c.env, result.bookId, result.session.email);

  // Security: Implement token rotation by revoking the old session token
  await revokeSession(c.env, token);

  return c.json({
    ok: true,
    data: { sessionToken: newSession.token, expiresAt: newSession.expiresAt },
  });
});

accessRouter.get('/validate', zValidator('query', ValidateQuerySchema), async (c) => {
  const { bookId } = c.req.valid('query');

  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '') ?? '';

  const sessionResult = await validateSession(c.env, token);

  if (!sessionResult.valid || !sessionResult.session) {
    return apiError(c, 401, 'SESSION_INVALID', 'Invalid session');
  }

  const grant = await getGrantByBookAndSession(c.env, bookId, sessionResult.session.email);

  if (!grant || grant.revoked_at || (grant.expires_at && new Date(grant.expires_at) < new Date())) {
    return c.json({
      ok: true,
      data: {
        valid: false,
        grantId: '',
        canComment: false,
        canDownloadOffline: false,
      },
    });
  }

  return c.json({
    ok: true,
    data: {
      valid: true,
      grantId: grant.id,
      canComment: grant.comments_allowed === 1,
      canDownloadOffline: grant.offline_allowed === 1,
    },
  });
});

accessRouter.get('/validate-all', async (c) => {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '') ?? '';

  const sessionResult = await validateSession(c.env, token);

  if (!sessionResult.valid || !sessionResult.session) {
    return apiError(c, 401, 'SESSION_INVALID', 'Invalid session');
  }

  const grants = await getGrantsBySession(c.env, sessionResult.session.email);

  const now = new Date();
  const validGrantIds = grants
    .filter((g) => !g.revoked_at && (!g.expires_at || new Date(g.expires_at) > now))
    .map((g) => g.id);

  return c.json({
    ok: true,
    data: {
      grantIds: validGrantIds,
      revokedBookIds: grants
        .filter((g) => g.revoked_at || (g.expires_at && new Date(g.expires_at) <= now))
        .map((g) => g.book_id),
    },
  });
});

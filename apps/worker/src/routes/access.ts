import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../lib/env';
import { validateGrant, computeCapabilities, getGrantByBookAndSession, getGrantsBySession } from '../auth/password';
import { createSession, validateSession, revokeSession } from '../auth/session';
import { logAudit } from '../audit';
import { AccessRequestSchema, RecoveryRequestSchema, RecoveryVerifySchema, RecoveryTokenPayloadSchema } from '@do-epub-studio/shared';
import { ValidateQuerySchema, JWT_PURPOSE_READER_RECOVER } from '@do-epub-studio/schema';
import { sign, verify } from 'hono/jwt';
import { checkRateLimitDO, deleteRateLimitKey } from '../lib/rate-limit-client';
import { queryFirst } from '../db/client';
import { createEmailTransport } from '../lib/email-transport';

export const accessRouter = new Hono<{ Bindings: Env }>();

accessRouter.post('/recovery-request', zValidator('json', RecoveryRequestSchema), async (c) => {
  const { bookSlug, email } = c.req.valid('json');

  // Rate limit by email to prevent abuse (max 3 requests per 5 minutes)
  const rateLimit = await checkRateLimitDO(c.env, 'auth_recovery', email.toLowerCase(), {
    maxRequests: 3,
    windowMs: 300_000,
  });

  if (!rateLimit.allowed) {
    return c.json(
      {
        ok: false,
        error: { code: 'TOO_MANY_REQUESTS', message: 'Too many recovery attempts. Please try again later.' },
      },
      429,
    );
  }

  const book = await queryFirst<{ id: string; slug: string }>(
    c.env,
    'SELECT id, slug FROM books WHERE slug = ?',
    [bookSlug]
  );

  if (book) {
    const grant = await getGrantByBookAndSession(c.env, book.id, email.toLowerCase());

    if (grant && !grant.revoked_at && (!grant.expires_at || new Date(grant.expires_at) > new Date())) {
      const payload = {
        email: email.toLowerCase(),
        bookSlug,
        purpose: JWT_PURPOSE_READER_RECOVER,
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      const token = await sign(payload, c.env.INVITE_TOKEN_SECRET, 'HS256');
      const recoveryUrl = `${c.env.APP_BASE_URL}/login?book=${bookSlug}&token=${token}`;

      const transport = createEmailTransport(c.env);
      await transport.send({
        to: email.toLowerCase(),
        subject: 'Recover access to your book',
        text: `Click the link to recover access: ${recoveryUrl}`,
        html: `<p>Click <a href="${recoveryUrl}">here</a> to recover access to your book.</p>`,
      });

      const tokenHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
      const hashHex = [...new Uint8Array(tokenHash)].map(b => b.toString(16).padStart(2, '0')).join('');

      await logAudit(c.env, {
        entityType: 'session',
        entityId: book.id,
        action: 'recovery_requested',
        actorEmail: email.toLowerCase(),
        payload: { tokenHash: hashHex },
      }, c.executionCtx);
    }
  }

  // Always return success to prevent user enumeration
  return c.json({ ok: true });
});

accessRouter.post('/verify-recovery', zValidator('json', RecoveryVerifySchema), async (c) => {
  const { token } = c.req.valid('json');

  try {
    const raw = await verify(token, c.env.INVITE_TOKEN_SECRET, 'HS256');
    const parsed = RecoveryTokenPayloadSchema.safeParse(raw);

    if (!parsed.success || parsed.data.purpose !== JWT_PURPOSE_READER_RECOVER || !parsed.data.bookSlug) {
      return c.json(
        {
          ok: false,
          error: { code: 'INVALID_TOKEN', message: 'Invalid or expired recovery link' },
        },
        401,
      );
    }

    const result = await validateGrant(c.env, parsed.data.bookSlug, parsed.data.email);

    if (!result.valid || !result.grant || !result.book) {
      return c.json(
        {
          ok: false,
          error: { code: 'ACCESS_DENIED', message: 'Access denied' },
        },
        401,
      );
    }

    const session = await createSession(c.env, result.book.id, parsed.data.email);

    await logAudit(c.env, {
      entityType: 'session',
      entityId: result.book.id,
      action: 'access_granted',
      actorEmail: parsed.data.email,
      payload: { grantId: result.grant.id, method: 'magic_link' },
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
  } catch {
    return c.json(
      {
        ok: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired recovery link' },
      },
      401,
    );
  }
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
    return c.json(
      {
        ok: false,
        error: { code: 'TOO_MANY_REQUESTS', message: 'Too many login attempts. Please try again later.' },
      },
      429,
    );
  }

  // Check account lockout (triggered after 5 consecutive failures; lasts 15 minutes)
  const lockoutCheck = await checkRateLimitDO(c.env, 'auth_lockout', emailKey, {
    maxRequests: 1,
    windowMs: 900_000,
  });

  if (!lockoutCheck.allowed) {
    const retryAfter = Math.ceil((lockoutCheck.resetAt - Date.now()) / 1000);
    return c.json(
      {
        ok: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: 'Account temporarily locked due to repeated failed login attempts. Please try again later.',
        },
      },
      423,
      { 'Retry-After': String(retryAfter) },
    );
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

    return c.json(
      {
        ok: false,
        error: { code: 'ACCESS_DENIED', message: 'Access denied' },
      },
      401,
    );
  }

  // Successful login — clear failure counter and any lingering lockout
  await Promise.all([
    deleteRateLimitKey(c.env, 'auth_failures', emailKey),
    deleteRateLimitKey(c.env, 'auth_lockout', emailKey),
  ]);

  const session = await createSession(c.env, result.book.id, email);

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
    return c.json(
      {
        ok: false,
        error: { code: 'SESSION_INVALID', message: 'Invalid session' },
      },
      401,
    );
  }

  if (!result.bookId) {
    return c.json(
      {
        ok: false,
        error: { code: 'SESSION_INVALID', message: 'Invalid session' },
      },
      401,
    );
  }

  // Security: Verify the grant is still valid before refreshing
  const grant = await getGrantByBookAndSession(c.env, result.bookId, result.session.email);
  if (!grant || grant.revoked_at || (grant.expires_at && new Date(grant.expires_at) < new Date())) {
    return c.json(
      {
        ok: false,
        error: { code: 'ACCESS_DENIED', message: 'Access has been revoked or expired' },
      },
      403,
    );
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
    return c.json(
      {
        ok: false,
        error: { code: 'SESSION_INVALID', message: 'Invalid session' },
      },
      401,
    );
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
    return c.json(
      {
        ok: false,
        error: { code: 'SESSION_INVALID', message: 'Invalid session' },
      },
      401,
    );
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

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../lib/env';
import { validateGrant, computeCapabilities } from '../auth/password';
import { createSession } from '../auth/session';
import { logAudit } from '../audit';
import { AccessRequestSchema } from '@do-epub-studio/shared';
import { checkRateLimitDO } from '../lib/rate-limit-client';
import { z } from 'zod';

export const accessRouter = new Hono<{ Bindings: Env }>();

accessRouter.post('/request', zValidator('json', AccessRequestSchema), async (c) => {
  const { bookSlug, email, password } = c.req.valid('json');

  // Rate limit by email to prevent brute-force attacks (max 5 requests per minute)
  const rateLimit = await checkRateLimitDO(c.env, 'auth_access', email.toLowerCase(), {
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

  const result = await validateGrant(c.env, bookSlug, email.toLowerCase(), password);

  if (!result.valid || !result.grant || !result.book) {
    await logAudit(c.env, {
      entityType: 'session',
      entityId: bookSlug,
      action: 'access_denied',
      actorEmail: email.toLowerCase(),
      payload: { reason: result.error },
    });

    return c.json(
      {
        ok: false,
        error: { code: 'ACCESS_DENIED', message: 'Access denied' },
      },
      401,
    );
  }

  const sessionToken = await createSession(c.env, result.book.id, email);

  await logAudit(c.env, {
    entityType: 'session',
    entityId: result.book.id,
    action: 'access_granted',
    actorEmail: email.toLowerCase(),
    payload: { grantId: result.grant.id },
  });

  return c.json({
    ok: true,
    data: {
      sessionToken,
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

  const { revokeSession } = await import('../auth/session');
  await revokeSession(c.env, token);

  return c.json({ ok: true });
});

accessRouter.post('/refresh', async (c) => {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '') ?? '';

  const { validateSession, createSession, revokeSession } = await import('../auth/session');
  const { getGrantByBookAndSession } = await import('../auth/password');

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

  // Security: Verify the grant is still valid before refreshing
  const grant = await getGrantByBookAndSession(c.env, result.bookId!, result.session.email);
  if (!grant || grant.revoked_at || (grant.expires_at && new Date(grant.expires_at) < new Date())) {
    return c.json(
      {
        ok: false,
        error: { code: 'ACCESS_DENIED', message: 'Access has been revoked or expired' },
      },
      403,
    );
  }

  const newToken = await createSession(c.env, result.bookId!, result.session.email);

  // Security: Implement token rotation by revoking the old session token
  await revokeSession(c.env, token);

  return c.json({
    ok: true,
    data: { sessionToken: newToken },
  });
});

const ValidateQuerySchema = z.object({
  bookId: z.string().min(1),
});

accessRouter.get('/validate', zValidator('query', ValidateQuerySchema), async (c) => {
  const { bookId } = c.req.valid('query');

  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '') ?? '';

  const { validateSession } = await import('../auth/session');
  const { getGrantByBookAndSession } = await import('../auth/password');

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

  const { validateSession } = await import('../auth/session');
  const { getGrantsBySession } = await import('../auth/password');

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

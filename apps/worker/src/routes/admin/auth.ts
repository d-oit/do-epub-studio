import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../../lib/env';
import { LoginSchema, AdminRecoveryRequestSchema, RecoveryVerifySchema } from '@do-epub-studio/schema';
import { checkRateLimitDO } from '../../lib/rate-limit-client';
import { createAdminSession, createAdminSessionByEmail, revokeAdminSession } from '../../auth/admin-middleware';
import { logAudit } from '../../audit';
import { createEmailTransport } from '../../lib/email-transport';
import { queryFirst } from '../../db/client';
import { sign, verify } from 'hono/jwt';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export const authRouter = new Hono<{ Bindings: Env }>();

authRouter.post('/login', zValidator('json', LoginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  const rateLimit = await checkRateLimitDO(c.env, 'auth_admin', email.toLowerCase(), {
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

  const result = await createAdminSession(c.env, email, password);

  if (!result.ok) {
    return c.json(
      { ok: false, error: { code: 'INVALID_CREDENTIALS', message: result.error } },
      result.status as ContentfulStatusCode,
    );
  }

  await logAudit(c.env, {
    entityType: 'user',
    entityId: result.user.id,
    action: 'admin_login',
    actorEmail: result.user.email,
    payload: { role: result.user.role },
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

authRouter.post('/logout', async (c) => {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '') ?? '';

  if (!token) {
    return c.json(
      { ok: false, error: { code: 'MISSING_TOKEN', message: 'Authorization token required' } },
      400,
    );
  }

  await revokeAdminSession(c.env, token);

  return c.json({ ok: true });
});

authRouter.post('/recovery-request', zValidator('json', AdminRecoveryRequestSchema), async (c) => {
  const { email } = c.req.valid('json');

  const rateLimit = await checkRateLimitDO(c.env, 'auth_admin_recovery', email.toLowerCase(), {
    maxRequests: 3,
    windowMs: 300_000,
  });

  if (!rateLimit.allowed) {
    return c.json(
      { ok: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many recovery attempts. Please try again later.' } },
      429,
    );
  }

  const user = await queryFirst<{ id: string; email: string }>(
    c.env,
    'SELECT id, email FROM users WHERE email = ? AND global_role = ?',
    [email.toLowerCase(), 'admin'],
  );

  if (user) {
    const payload = {
      email: email.toLowerCase(),
      purpose: 'admin_recover',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const token = await sign(payload, c.env.INVITE_TOKEN_SECRET, 'HS256');
    const recoveryUrl = `${c.env.APP_BASE_URL}/admin/recover?token=${token}`;

    const transport = createEmailTransport(c.env);
    await transport.send({
      to: email.toLowerCase(),
      subject: 'Recover access to d.o.EPUB Studio Admin',
      text: `Click the link to recover admin access: ${recoveryUrl}`,
      html: `<p>Click <a href="${recoveryUrl}">here</a> to recover admin access.</p>`,
    });

    const tokenHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const hashHex = [...new Uint8Array(tokenHash)].map(b => b.toString(16).padStart(2, '0')).join('');

    await logAudit(c.env, {
      entityType: 'user',
      entityId: user.id,
      action: 'admin_recovery_requested',
      actorEmail: email.toLowerCase(),
      payload: { tokenHash: hashHex },
    }, c.executionCtx);
  }

  return c.json({ ok: true });
});

authRouter.post('/recovery-verify', zValidator('json', RecoveryVerifySchema), async (c) => {
  const { token } = c.req.valid('json');

  try {
    const payload = await verify(token, c.env.INVITE_TOKEN_SECRET, 'HS256') as { email: string; purpose: string };

    if (payload.purpose !== 'admin_recover') {
      return c.json(
        { ok: false, error: { code: 'INVALID_TOKEN', message: 'Invalid recovery token' } },
        401,
      );
    }

    const user = await queryFirst<{ id: string; email: string; global_role: string }>(
      c.env,
      'SELECT id, email, global_role FROM users WHERE email = ? AND global_role = ?',
      [payload.email, 'admin'],
    );

    if (!user) {
      return c.json(
        { ok: false, error: { code: 'ACCESS_DENIED', message: 'Access denied' } },
        401,
      );
    }

    const session = await createAdminSessionByEmail(c.env, payload.email);

    if (!session.ok) {
      return c.json(
        { ok: false, error: { code: 'SESSION_FAILED', message: 'Failed to create session' } },
        500,
      );
    }

    await logAudit(c.env, {
      entityType: 'user',
      entityId: user.id,
      action: 'admin_access_granted',
      actorEmail: payload.email,
      payload: { method: 'magic_link' },
    }, c.executionCtx);

    return c.json({
      ok: true,
      data: {
        token: session.token,
        user: { id: user.id, email: user.email, role: user.global_role },
      },
    });
  } catch {
    return c.json(
      { ok: false, error: { code: 'INVALID_TOKEN', message: 'Invalid or expired recovery link' } },
      401,
    );
  }
});

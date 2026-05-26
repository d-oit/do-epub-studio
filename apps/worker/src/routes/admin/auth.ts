import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../../lib/env';
import { z } from 'zod';
import { checkRateLimitDO } from '../../lib/rate-limit-client';
import { createAdminSession, revokeAdminSession } from '../../auth/admin-middleware';
import { logAudit } from '../../audit';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export const authRouter = new Hono<{ Bindings: Env }>();

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

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
  });

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

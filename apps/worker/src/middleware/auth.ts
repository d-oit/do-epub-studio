import type { MiddlewareHandler } from 'hono';
import type { Env } from '../lib/env';
import { requireAuth, type AuthContext } from '../auth/middleware';
import { requireAdminAuth } from '../auth/admin-middleware';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export const readerAuth: MiddlewareHandler<{ Bindings: Env; Variables: { auth: AuthContext } }> = async (c, next) => {
  const auth = await requireAuth(c.env, c.req.raw);
  if (!auth) {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, 401);
  }
  c.set('auth', auth);
  await next();
};

export const adminAuth: MiddlewareHandler<{ Bindings: Env; Variables: { adminUser: { email: string; id: string; role: string } } }> = async (c, next) => {
  const authResult = await requireAdminAuth(c.env, c.req.raw);
  if (!authResult || !authResult.ok) {
    const status = (authResult && 'status' in authResult ? authResult.status : 401) as ContentfulStatusCode;
    const message = (authResult && 'error' in authResult ? authResult.error : 'Unauthorized');
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message } }, status);
  }
  c.set('adminUser', {
    id: authResult.context.userId,
    email: authResult.context.email,
    role: authResult.context.globalRole
  });
  await next();
};

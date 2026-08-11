import type { MiddlewareHandler } from 'hono';
import type { Env } from '../lib/env';
import { requireAuth, type AuthContext } from '../auth/middleware';
import { requireAdminAuth } from '../auth/admin-middleware';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { apiError } from '../lib/api-error';

export const readerAuth: MiddlewareHandler<{ Bindings: Env; Variables: { auth: AuthContext } }> = async (c, next) => {
  const auth = await requireAuth(c.env, c.req.raw);
  if (!auth) {
    return apiError(c, 401, 'UNAUTHORIZED', 'Unauthorized');
  }
  c.set('auth', auth);
  await next();
};

export const adminAuth: MiddlewareHandler<{ Bindings: Env; Variables: { adminUser: { email: string; id: string; role: string } } }> = async (c, next) => {
  const authResult = await requireAdminAuth(c.env, c.req.raw);
  if (!authResult.ok) {
    const status = authResult.status as ContentfulStatusCode; return apiError(c, status, status === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED', authResult.error);
  }
  c.set('adminUser', {
    id: authResult.context.userId,
    email: authResult.context.email,
    role: authResult.context.globalRole
  });
  await next();
};

import type { MiddlewareHandler } from 'hono';
import type { Env } from '../lib/env';
import { requireAuth, type AuthContext } from '../auth/middleware';
import { requireAdminAuth } from '../auth/admin-middleware';
import { parseAuthHeader, validateSession } from '../auth/session';
import { queryFirst } from '../db/client';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { apiError } from '../lib/api-error';

export interface SessionContext {
  id: string;
  email: string;
  bookId: string;
  token: string;
}

interface GrantRow {
  id: string;
  book_id: string;
  email: string;
  mode: string;
  allowed: number;
  comments_allowed: number;
  offline_allowed: number;
  expires_at: string | null;
}

export type GrantPermissionLevel = 'read' | 'comment' | 'offline';

export const requireSession: MiddlewareHandler<{
  Bindings: Env;
  Variables: { session: SessionContext };
}> = async (c, next) => {
  const token = parseAuthHeader(c.req.header('Authorization') ?? null);
  if (!token) {
    return apiError(c, 401, 'SESSION_INVALID', 'Invalid session');
  }

  const result = await validateSession(c.env, token);
  if (!result.valid || !result.session || !result.bookId) {
    return apiError(c, 401, 'SESSION_INVALID', 'Invalid session');
  }

  c.set('session', {
    id: result.session.id,
    email: result.session.email,
    bookId: result.bookId,
    token,
  });

  await next();
};

export function requireBookGrant(
  permissionLevel: GrantPermissionLevel = 'read',
): MiddlewareHandler<{
  Bindings: Env;
  Variables: { session?: SessionContext; auth?: AuthContext };
}> {
  return async (c, next) => {
    let session = c.get('session');
    if (!session) {
      const token = parseAuthHeader(c.req.header('Authorization') ?? null);
      if (!token) {
        return apiError(c, 401, 'SESSION_INVALID', 'Invalid session');
      }
      const result = await validateSession(c.env, token);
      if (!result.valid || !result.session || !result.bookId) {
        return apiError(c, 401, 'SESSION_INVALID', 'Invalid session');
      }
      session = {
        id: result.session.id,
        email: result.session.email,
        bookId: result.bookId,
        token,
      };
      c.set('session', session);
    }

    const targetBookId = c.req.param('bookId') || c.req.param('id') || session.bookId;

    const grant = (await queryFirst(
      c.env,
      `SELECT id, book_id, email, mode, allowed, comments_allowed, offline_allowed, expires_at
       FROM book_access_grants
       WHERE book_id = ? AND email = ? AND revoked_at IS NULL`,
      [targetBookId, session.email],
    )) as GrantRow | null;

    if (!grant || !grant.allowed) {
      return apiError(c, 403, 'ACCESS_DENIED', 'Access denied');
    }

    if (grant.expires_at && new Date(grant.expires_at) <= new Date()) {
      return apiError(c, 403, 'ACCESS_DENIED', 'Access has been revoked or expired');
    }

    if (permissionLevel === 'comment' && grant.comments_allowed !== 1) {
      return apiError(c, 403, 'ACCESS_DENIED', 'Access denied');
    }

    if (permissionLevel === 'offline' && grant.offline_allowed !== 1) {
      return apiError(c, 403, 'ACCESS_DENIED', 'Access denied');
    }

    c.set('auth', {
      sessionId: session.id,
      bookId: targetBookId,
      email: session.email,
      capabilities: {
        canRead: grant.allowed === 1,
        canComment: grant.comments_allowed === 1,
        canHighlight: grant.comments_allowed === 1,
        canBookmark: true,
        canDownloadOffline: grant.offline_allowed === 1,
        canExportNotes: grant.comments_allowed === 1,
        canManageAccess: false,
      },
    });

    await next();
  };
}

export const readerAuth: MiddlewareHandler<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}> = async (c, next) => {
  const auth = await requireAuth(c.env, c.req.raw);
  if (!auth) {
    return apiError(c, 401, 'UNAUTHORIZED', 'Unauthorized');
  }
  c.set('auth', auth);
  await next();
};

export const adminAuth: MiddlewareHandler<{
  Bindings: Env;
  Variables: { adminUser: { email: string; id: string; role: string } };
}> = async (c, next) => {
  const authResult = await requireAdminAuth(c.env, c.req.raw);
  if (!authResult.ok) {
    const status = authResult.status as ContentfulStatusCode;
    return apiError(c, status, status === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED', authResult.error);
  }
  c.set('adminUser', {
    id: authResult.context.userId,
    email: authResult.context.email,
    role: authResult.context.globalRole,
  });
  await next();
};

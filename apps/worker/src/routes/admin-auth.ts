import type { Env } from '../lib/env';
import { createAdminSession, revokeAdminSession } from '../auth/admin-middleware';
import { jsonResponse } from '../lib/responses';
import { logAudit } from '../audit';
import { checkRateLimitDO } from '../lib/rate-limit-client';

export async function handleAdminLogin(
  env: Env,
  request: Request,
): Promise<Response> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- CF Workers types
    const body = (await request.json()) as { email?: string; password?: string };
    
    if (!body.email || !body.password) {
      return jsonResponse(
        { ok: false, error: { code: 'MISSING_FIELDS', message: 'Email and password are required' } },
        400,
      );
    }

    // Rate limit by email to prevent brute-force attacks (max 5 requests per minute)
    const rateLimit = await checkRateLimitDO(env, 'auth_admin', body.email.toLowerCase(), {
      maxRequests: 5,
      windowMs: 60_000,
    });

    if (!rateLimit.allowed) {
      return jsonResponse(
        {
          ok: false,
          error: { code: 'TOO_MANY_REQUESTS', message: 'Too many login attempts. Please try again later.' },
        },
        429,
      );
    }

    const result = await createAdminSession(env, body.email, body.password);

    if (!result.ok) {
      return jsonResponse(
        { ok: false, error: { code: 'INVALID_CREDENTIALS', message: result.error } },
        result.status,
      );
    }

    await logAudit(env, {
      entityType: 'user',
      entityId: result.user.id,
      action: 'admin_login',
      actorEmail: result.user.email,
      payload: { role: result.user.role },
    });

    return jsonResponse({
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
  } catch {
    return jsonResponse(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Login failed' } },
      500,
    );
  }
}

export async function handleAdminLogout(
  env: Env,
  request: Request,
): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '') ?? '';

  if (!token) {
    return jsonResponse(
      { ok: false, error: { code: 'MISSING_TOKEN', message: 'Authorization token required' } },
      400,
    );
  }

  await revokeAdminSession(env, token);

  return jsonResponse({ ok: true });
}

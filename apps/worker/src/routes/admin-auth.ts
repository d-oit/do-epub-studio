import type { Env } from '../lib/env';
import { createAdminSession, revokeAdminSession } from '../auth/admin-middleware';
import { jsonResponse } from '../lib/responses';
import { execute } from '../db/client';

async function logAudit(
  env: Env,
  entry: {
    entityType: 'book' | 'grant' | 'session' | 'comment' | 'user' | 'bookmark' | 'highlight';
    entityId: string;
    action: string;
    actorEmail?: string;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  const id = crypto.randomUUID();
  const payloadJson = entry.payload ? JSON.stringify(entry.payload) : null;

  await execute(
    env,
    `INSERT INTO audit_log (id, actor_email, entity_type, entity_id, action, payload_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, entry.actorEmail ?? null, entry.entityType, entry.entityId, entry.action, payloadJson],
  );
}

export async function handleAdminLogin(
  env: Env,
  request: Request,
): Promise<Response> {
  try {
    const body = await request.json();
    
    if (!body.email || !body.password) {
      return jsonResponse(
        { ok: false, error: { code: 'MISSING_FIELDS', message: 'Email and password are required' } },
        400,
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

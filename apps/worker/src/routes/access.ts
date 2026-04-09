import type { Env } from '../lib/env';
import { validateGrant, computeCapabilities } from '../auth/password';
import { createSession } from '../auth/session';
import { logAudit } from '../audit';
import { jsonResponse } from '../lib/responses';

interface AccessRequestBody {
  bookSlug: string;
  email: string;
  password?: string;
}

export async function handleAccessRequest(env: Env, body: AccessRequestBody): Promise<Response> {
  const { bookSlug, email, password } = body;

  if (!bookSlug || !email) {
    return jsonResponse(
      { ok: false, error: { code: 'INVALID_REQUEST', message: 'Missing required fields' } },
      400,
    );
  }

  const result = await validateGrant(env, bookSlug, email.toLowerCase(), password);

  if (!result.valid || !result.grant || !result.book) {
    await logAudit(env, {
      entityType: 'session',
      entityId: bookSlug,
      action: 'access_denied',
      actorEmail: email.toLowerCase(),
      payload: { reason: result.error },
    });

    return jsonResponse(
      {
        ok: false,
        error: { code: 'ACCESS_DENIED', message: 'Access denied' },
      },
      401,
    );
  }

  const sessionToken = await createSession(env, result.book.id, email);

  await logAudit(env, {
    entityType: 'session',
    entityId: result.book.id,
    action: 'access_granted',
    actorEmail: email.toLowerCase(),
    payload: { grantId: result.grant.id },
  });

  return jsonResponse({
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
}

export async function handleLogout(env: Env, token: string): Promise<Response> {
  const { revokeSession } = await import('../auth/session');
  await revokeSession(env, token);

  return jsonResponse({ ok: true });
}

export async function handleRefresh(env: Env, token: string): Promise<Response> {
  const { validateSession, createSession } = await import('../auth/session');
  const result = await validateSession(env, token);

  if (!result.valid || !result.session) {
    return jsonResponse(
      {
        ok: false,
        error: { code: 'SESSION_INVALID', message: 'Invalid session' },
      },
      401,
    );
  }

  const newToken = await createSession(env, result.bookId!, result.session.email);

  return jsonResponse({
    ok: true,
    data: { sessionToken: newToken },
  });
}

export async function handleValidatePermission(
  env: Env,
  bookId: string,
  token: string,
): Promise<Response> {
  const { validateSession } = await import('../auth/session');
  const { getGrantByBookAndSession } = await import('../auth/password');

  const sessionResult = await validateSession(env, token);

  if (!sessionResult.valid || !sessionResult.session) {
    return jsonResponse(
      {
        ok: false,
        error: { code: 'SESSION_INVALID', message: 'Invalid session' },
      },
      401,
    );
  }

  const grant = await getGrantByBookAndSession(env, bookId, sessionResult.session.email);

  if (!grant || grant.revoked_at) {
    return jsonResponse({
      ok: true,
      data: {
        valid: false,
        grantId: '',
        canComment: false,
        canDownloadOffline: false,
      },
    });
  }

  return jsonResponse({
    ok: true,
    data: {
      valid: true,
      grantId: grant.id,
      canComment: grant.comments_allowed === 1,
      canDownloadOffline: grant.offline_allowed === 1,
    },
  });
}

export async function handleValidateAllPermissions(env: Env, token: string): Promise<Response> {
  const { validateSession } = await import('../auth/session');
  const { getGrantsBySession } = await import('../auth/password');

  const sessionResult = await validateSession(env, token);

  if (!sessionResult.valid || !sessionResult.session) {
    return jsonResponse(
      {
        ok: false,
        error: { code: 'SESSION_INVALID', message: 'Invalid session' },
      },
      401,
    );
  }

  const grants = await getGrantsBySession(env, sessionResult.session.email);

  const validGrantIds = grants.filter((g) => !g.revoked_at).map((g) => g.id);

  return jsonResponse({
    ok: true,
    data: {
      grantIds: validGrantIds,
      revokedBookIds: grants.filter((g) => g.revoked_at).map((g) => g.book_id),
    },
  });
}

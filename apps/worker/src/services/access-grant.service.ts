import type { Env } from '../lib/env';
import type { RequestContext } from '../lib/observability';
import {
  validateGrant,
  computeCapabilities,
  getGrantByBookAndSession,
  getGrantsBySession,
} from '../auth/password';
import { resolveRecoveryGrant } from '../auth/recovery-grant';
import { createSession, validateSession, revokeSession } from '../auth/session';
import {
  createResetToken,
  verifyResetToken,
  bumpResetTokenAttempt,
  claimResetToken,
  purgeExpiredTokensForAccount,
} from '../auth/reset';
import { logAudit } from '../audit';
import { logRiskEvent, RISK_EVENTS } from '../audit/risk';
import { checkRateLimitDO, deleteRateLimitKey } from '../lib/rate-limit-client';
import { queryFirst } from '../db/client';
import { createEmailTransport } from '../lib/email-transport';

export async function hashString(value: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface BookInfo {
  id: string;
  slug: string;
  title: string;
  authorName: string | null;
  visibility: string;
  coverImageUrl: string | null;
}

export interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

export interface AccessGrantedResponse {
  sessionToken: string;
  expiresAt: string;
  book: BookInfo;
  capabilities: ReturnType<typeof computeCapabilities>;
}

function err(status: number, error: string, message: string, headers?: Record<string, string>) {
  return { ok: false, status, error, message, headers };
}

export class AccessGrantService {
  static async requestRecovery(options: {
    env: Env;
    bookSlug: string;
    email: string;
    clientIp: string;
    requestContext: RequestContext;
    executionCtx?: ExecutionContextLike;
  }): Promise<{ ok: boolean; status?: number; error?: string; message?: string }> {
    const { env, bookSlug, email, clientIp, requestContext, executionCtx } = options;
    const emailKey = email.toLowerCase();
    const traceId = requestContext.traceId;
    const ipHash = await hashString(clientIp);

    const accountRate = await checkRateLimitDO(env, 'auth_recovery', emailKey, {
      maxRequests: 3,
      windowMs: 300_000,
    });
    const ipRate = await checkRateLimitDO(env, 'auth_recovery_ip', ipHash, {
      maxRequests: 10,
      windowMs: 300_000,
    });

    if (!accountRate.allowed || !ipRate.allowed) {
      return err(429, 'TOO_MANY_REQUESTS', 'Too many recovery attempts. Please try again later.');
    }

    const book = await queryFirst<{ id: string; slug: string }>(
      env,
      'SELECT id, slug FROM books WHERE slug = ?',
      [bookSlug],
    );

    if (book) {
      const grant = await getGrantByBookAndSession(env, book.id, emailKey);

      if (
        grant &&
        !grant.revoked_at &&
        (!grant.expires_at || new Date(grant.expires_at) > new Date())
      ) {
        await purgeExpiredTokensForAccount(env, { email: emailKey });

        const token = await createResetToken(env, {
          purpose: 'reader_magic_link',
          email: emailKey,
          ipHash,
          traceId,
          bookId: book.id,
        });
        const recoveryUrl = `${env.APP_BASE_URL}/login?book=${bookSlug}&token=${token}`;

        const transport = createEmailTransport(env);
        executionCtx?.waitUntil(
          transport.send({
            to: emailKey,
            subject: 'Recover access to your book',
            text: `Click the link to recover access (valid for 30 minutes): ${recoveryUrl}`,
            html: `<p>Click <a href="${recoveryUrl}">here</a> to recover access to your book. This link expires in 30 minutes.</p>`,
            context: requestContext,
          }),
        );

        await logAudit(
          env,
          {
            entityType: 'session',
            entityId: book.id,
            action: 'recovery_requested',
            actorEmail: emailKey,
            payload: { ipHash },
          },
          executionCtx,
        );
      }
    }

    return { ok: true };
  }

  static async verifyRecovery(options: {
    env: Env;
    token: string;
    clientIp: string;
    requestContext: RequestContext;
    executionCtx?: ExecutionContextLike;
  }): Promise<{
    ok: boolean;
    status?: number;
    error?: string;
    message?: string;
    data?: AccessGrantedResponse;
  }> {
    const { env, token, clientIp, requestContext, executionCtx } = options;
    const traceId = requestContext.traceId;

    const ipVerifyRate = await checkRateLimitDO(
      env,
      'auth_recovery_verify_ip',
      await hashString(clientIp),
      { maxRequests: 10, windowMs: 300_000 },
    );
    if (!ipVerifyRate.allowed) {
      return err(429, 'TOO_MANY_REQUESTS', 'Too many recovery attempts. Please try again later.');
    }

    const verify = await verifyResetToken(env, token, 'reader_magic_link');

    if (!verify.ok) {
      await logAudit(
        env,
        {
          entityType: 'session',
          entityId: 'unknown',
          action: 'recovery_denied',
          payload: { reason: verify.reason === 'used' ? 'replay' : verify.reason, traceId },
        },
        executionCtx,
      );
      if (verify.reason === 'used') {
        await logRiskEvent(env, executionCtx, {
          kind: RISK_EVENTS.tokenReplay,
          entityId: 'unknown',
          entityType: 'user',
          payload: { kind: 'password_reset', account: 'unknown' },
        });
      }
      return err(401, 'INVALID_TOKEN', 'Invalid or expired recovery link');
    }

    await bumpResetTokenAttempt(env, verify.record.id);
    const grantedEmail = verify.record.email;
    if (!grantedEmail) return err(401, 'INVALID_TOKEN', 'Invalid or expired recovery link');

    const recovery = await resolveRecoveryGrant(env, grantedEmail, verify.record.bookId);
    if (!recovery.ok) {
      await logAudit(
        env,
        {
          entityType: 'session',
          entityId: recovery.entityId,
          action: 'recovery_denied',
          payload: { reason: recovery.reason, traceId },
        },
        executionCtx,
      );
      return err(401, 'ACCESS_DENIED', 'Access denied');
    }
    const { grant: activeGrant, targetBookId } = recovery.resolution;

    const claimed = await claimResetToken(env, verify.record.id);
    if (!claimed) {
      await logAudit(
        env,
        {
          entityType: 'session',
          entityId: grantedEmail,
          action: 'recovery_denied',
          payload: { reason: 'replay', traceId },
        },
        executionCtx,
      );
      await logRiskEvent(env, executionCtx, {
        kind: RISK_EVENTS.tokenReplay,
        entityId: grantedEmail,
        entityType: 'user',
        payload: { kind: 'password_reset', account: grantedEmail },
      });
      return err(401, 'INVALID_TOKEN', 'Invalid or expired recovery link');
    }

    const book = await queryFirst<{
      id: string;
      slug: string;
      title: string;
      author_name: string | null;
      visibility: string;
      cover_image_url: string | null;
    }>(
      env,
      `SELECT id, slug, title, author_name, visibility, cover_image_url FROM books WHERE id = ?`,
      [targetBookId],
    );

    if (!book) return err(401, 'ACCESS_DENIED', 'Access denied');

    const session = await createSession(env, book.id, grantedEmail);

    await logAudit(
      env,
      {
        entityType: 'session',
        entityId: book.id,
        action: 'access_granted',
        actorEmail: grantedEmail,
        payload: { grantId: activeGrant.id, method: 'magic_link' },
      },
      executionCtx,
    );

    return {
      ok: true,
      data: {
        sessionToken: session.token,
        expiresAt: session.expiresAt,
        book: {
          id: book.id,
          slug: book.slug,
          title: book.title,
          authorName: book.author_name,
          visibility: book.visibility,
          coverImageUrl: book.cover_image_url,
        },
        capabilities: computeCapabilities(activeGrant),
      },
    };
  }

  static async requestAccess(options: {
    env: Env;
    bookSlug: string;
    email: string;
    password?: string;
    clientIp: string;
    executionCtx?: ExecutionContextLike;
  }): Promise<{
    ok: boolean;
    status?: number;
    error?: string;
    message?: string;
    headers?: Record<string, string>;
    data?: AccessGrantedResponse;
  }> {
    const { env, bookSlug, email, password, clientIp, executionCtx } = options;
    const emailKey = email.toLowerCase();

    const rateLimit = await checkRateLimitDO(env, 'auth_access', emailKey, {
      maxRequests: 5,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return err(429, 'TOO_MANY_REQUESTS', 'Too many login attempts. Please try again later.');
    }

    const lockoutCheck = await checkRateLimitDO(env, 'auth_lockout', emailKey, {
      maxRequests: 1,
      windowMs: 900_000,
    });

    if (!lockoutCheck.allowed) {
      await logRiskEvent(env, executionCtx, {
        kind: RISK_EVENTS.loginLocked,
        entityId: emailKey,
        entityType: 'user',
        payload: { account: emailKey, ipHash: await hashString(clientIp) },
      });
      const retryAfter = Math.ceil((lockoutCheck.resetAt - Date.now()) / 1000);
      return err(
        423,
        'ACCOUNT_LOCKED',
        'Account temporarily locked due to repeated failed login attempts. Please try again later.',
        { 'Retry-After': String(retryAfter) },
      );
    }

    const result = await validateGrant(env, bookSlug, emailKey, password);

    if (!result.valid || !result.grant || !result.book) {
      await logAudit(
        env,
        {
          entityType: 'session',
          entityId: bookSlug,
          action: 'access_denied',
          actorEmail: emailKey,
          payload: { reason: result.error },
        },
        executionCtx,
      );

      const failureCheck = await checkRateLimitDO(env, 'auth_failures', emailKey, {
        maxRequests: 5,
        windowMs: 900_000,
      });
      if (!failureCheck.allowed) {
        await checkRateLimitDO(env, 'auth_lockout', emailKey, {
          maxRequests: 1,
          windowMs: 900_000,
        });
      }

      return err(401, 'ACCESS_DENIED', 'Access denied');
    }

    await Promise.all([
      deleteRateLimitKey(env, 'auth_failures', emailKey),
      deleteRateLimitKey(env, 'auth_lockout', emailKey),
    ]);

    const session = await createSession(env, result.book.id, emailKey);

    await logAudit(
      env,
      {
        entityType: 'session',
        entityId: result.book.id,
        action: 'access_granted',
        actorEmail: emailKey,
        payload: { grantId: result.grant.id },
      },
      executionCtx,
    );

    return {
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
    };
  }

  static async logout(env: Env, token: string): Promise<{ ok: boolean }> {
    await revokeSession(env, token);
    return { ok: true };
  }

  static async refreshSession(
    env: Env,
    token: string,
  ): Promise<{
    ok: boolean;
    status?: number;
    error?: string;
    message?: string;
    data?: { sessionToken: string; expiresAt: string };
  }> {
    const result = await validateSession(env, token);
    if (!result.valid || !result.session || !result.bookId) {
      return err(401, 'SESSION_INVALID', 'Invalid session');
    }

    const grant = await getGrantByBookAndSession(env, result.bookId, result.session.email);
    if (
      !grant ||
      grant.revoked_at ||
      (grant.expires_at && new Date(grant.expires_at) < new Date())
    ) {
      return err(403, 'ACCESS_DENIED', 'Access has been revoked or expired');
    }

    const newSession = await createSession(env, result.bookId, result.session.email);
    await revokeSession(env, token);

    return { ok: true, data: { sessionToken: newSession.token, expiresAt: newSession.expiresAt } };
  }

  static async validateBookAccess(
    env: Env,
    token: string,
    bookId: string,
  ): Promise<{
    ok: boolean;
    status?: number;
    error?: string;
    message?: string;
    data?: {
      valid: boolean;
      grantId: string;
      canComment: boolean;
      canDownloadOffline: boolean;
    };
  }> {
    const sessionResult = await validateSession(env, token);
    if (!sessionResult.valid || !sessionResult.session) {
      return err(401, 'SESSION_INVALID', 'Invalid session');
    }

    const grant = await getGrantByBookAndSession(env, bookId, sessionResult.session.email);

    if (
      !grant ||
      grant.revoked_at ||
      (grant.expires_at && new Date(grant.expires_at) < new Date())
    ) {
      return {
        ok: true,
        data: { valid: false, grantId: '', canComment: false, canDownloadOffline: false },
      };
    }

    return {
      ok: true,
      data: {
        valid: true,
        grantId: grant.id,
        canComment: grant.comments_allowed === 1,
        canDownloadOffline: grant.offline_allowed === 1,
      },
    };
  }

  static async validateAllAccess(
    env: Env,
    token: string,
  ): Promise<{
    ok: boolean;
    status?: number;
    error?: string;
    message?: string;
    data?: {
      grantIds: string[];
      revokedBookIds: string[];
    };
  }> {
    const sessionResult = await validateSession(env, token);
    if (!sessionResult.valid || !sessionResult.session) {
      return err(401, 'SESSION_INVALID', 'Invalid session');
    }

    const grants = await getGrantsBySession(env, sessionResult.session.email);
    const now = new Date();
    const validGrantIds = grants
      .filter((g) => !g.revoked_at && (!g.expires_at || new Date(g.expires_at) > now))
      .map((g) => g.id);

    return {
      ok: true,
      data: {
        grantIds: validGrantIds,
        revokedBookIds: grants
          .filter((g) => g.revoked_at || (g.expires_at && new Date(g.expires_at) <= now))
          .map((g) => g.book_id),
      },
    };
  }
}

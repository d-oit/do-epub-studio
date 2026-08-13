import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../../lib/env';
import type { RequestContext } from '../../lib/observability';
import {
  LoginSchema,
  AdminRecoveryRequestSchema,
  AdminRecoveryVerifySchema,
  PasswordChangeSchema,
  StepUpSchema,
} from '@do-epub-studio/schema';
import { checkRateLimitDO } from '../../lib/rate-limit-client';
import {
  createAdminSession,
  revokeAdminSession,
  revokeAllAdminSessionsForUser,
  revokeAllReaderSessionsForUser,
  raiseAdminAssurance,
  listAdminSessionsForUser,
  hashToken as hashAdminToken,
} from '../../auth/admin-middleware';
import {
  getAccountByEmail,
  accountIsLocked,
  isPasswordDerivative,
  verifyAccountPassword,
  changePasswordAndConsumeResetToken,
  changePassword,
} from '../../auth/account';
import {
  createResetToken,
  verifyResetToken,
  bumpResetTokenAttempt,
  revokeTokensForAccount,
} from '../../auth/reset';
import { logAudit } from '../../audit';
import { createEmailTransport } from '../../lib/email-transport';
import { queryFirst } from '../../db/client';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { apiError } from '../../lib/api-error';
import { adminAuth } from '../../middleware/auth';

export const authRouter = new Hono<{ Bindings: Env; Variables: { requestContext: RequestContext; adminUser: { email: string; id: string; role: string } } }>();

function getClientIp(c: { req: { header(name: string): string | undefined } }): string {
  return c.req.header('CF-Connecting-IP') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

async function hashString(value: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

authRouter.post('/login', zValidator('json', LoginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  const rateLimit = await checkRateLimitDO(c.env, 'auth_admin', email.toLowerCase(), {
    maxRequests: 5,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return apiError(c, 429, 'TOO_MANY_REQUESTS', 'Too many login attempts. Please try again later.');
  }

  const result = await createAdminSession(c.env, email, password);

  if (!result.ok) {
    return apiError(c, result.status as ContentfulStatusCode, 'INVALID_CREDENTIALS', result.error);
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
    return apiError(c, 400, 'MISSING_TOKEN', 'Authorization token required');
  }

  await revokeAdminSession(c.env, token);

  return c.json({ ok: true });
});

authRouter.post('/recovery-request', zValidator('json', AdminRecoveryRequestSchema), async (c) => {
  const { email } = c.req.valid('json');
  const emailKey = email.toLowerCase();
  const traceId = c.get('requestContext').traceId;
  const ipHash = await hashString(`${getClientIp(c)}:${emailKey}`);

  // Per-account rate limit (uniform request path, no enumeration).
  const accountRate = await checkRateLimitDO(c.env, 'auth_admin_recovery', emailKey, {
    maxRequests: 3,
    windowMs: 300_000,
  });
  // Per-IP rate limit independent of the account.
  const ipRate = await checkRateLimitDO(c.env, 'auth_admin_recovery_ip', ipHash, {
    maxRequests: 10,
    windowMs: 300_000,
  });

  if (!accountRate.allowed || !ipRate.allowed) {
    return apiError(c, 429, 'TOO_MANY_REQUESTS', 'Too many recovery attempts. Please try again later.');
  }

  const user = await queryFirst<{ id: string; email: string; global_role: string; disabled_at: string | null; compromised_at: string | null }>(
    c.env,
    'SELECT id, email, global_role, disabled_at, compromised_at FROM users WHERE email = ?',
    [emailKey],
  );

  if (user && user.global_role === 'admin' && !user.disabled_at && !user.compromised_at) {
    const token = await createResetToken(c.env, {
      purpose: 'admin_reset',
      userId: user.id,
      email: emailKey,
      ipHash,
      traceId,
    });
    const resetUrl = `${c.env.APP_BASE_URL}/admin/recover?token=${token}`;

    const transport = createEmailTransport(c.env);
    await transport.send({
      to: emailKey,
      subject: 'Reset your d.o.EPUB Studio Admin password',
      text: `Click the link to reset your admin password (valid for 15 minutes): ${resetUrl}`,
      html: `<p>Click <a href="${resetUrl}">here</a> to reset your admin password. This link expires in 15 minutes.</p>`,
      context: c.get('requestContext'),
    });

    await logAudit(c.env, {
      entityType: 'user',
      entityId: user.id,
      action: 'admin_reset_requested',
      actorEmail: emailKey,
      payload: { ipHash },
    }, c.executionCtx);
  }

  // Always return success to prevent user enumeration (ADR-232).
  return c.json({ ok: true });
});

authRouter.post('/recovery-verify', zValidator('json', AdminRecoveryVerifySchema), async (c) => {
  const { token, newPassword } = c.req.valid('json');
  const traceId = c.get('requestContext').traceId;
  const ipHash = await hashString(getClientIp(c));

  // Per-IP rate limit on the verify path (ADR-232 per-IP attempt limit).
  const ipRate = await checkRateLimitDO(c.env, 'auth_admin_reset_verify_ip', ipHash, {
    maxRequests: 10,
    windowMs: 300_000,
  });
  if (!ipRate.allowed) {
    return apiError(c, 429, 'TOO_MANY_REQUESTS', 'Too many reset attempts. Please try again later.');
  }

  const verify = await verifyResetToken(c.env, token, 'admin_reset');

  if (!verify.ok || !verify.record.userId) {
    const reason = !verify.ok ? verify.reason : 'invalid';
    await logAudit(c.env, {
      entityType: 'user',
      entityId: 'unknown',
      action: 'admin_reset_denied',
      payload: { reason, ipHash, traceId },
    }, c.executionCtx);
    return apiError(c, 401, 'INVALID_TOKEN', 'Invalid or expired reset link');
  }

  await bumpResetTokenAttempt(c.env, verify.record.id);

  const account = await queryFirst<{ id: string; email: string; disabled_at: string | null; compromised_at: string | null; global_role: string }>(
    c.env,
    'SELECT id, email, disabled_at, compromised_at, global_role FROM users WHERE id = ?',
    [verify.record.userId],
  );

  if (!account || account.global_role !== 'admin' || accountIsLocked(account)) {
    await logAudit(c.env, {
      entityType: 'user',
      entityId: verify.record.userId,
      action: 'admin_reset_denied',
      payload: { reason: 'locked', traceId },
    }, c.executionCtx);
    return apiError(c, 401, 'INVALID_TOKEN', 'Invalid or expired reset link');
  }

  // Reject service-name/email-derivative passwords (ADR-231 password policy).
  if (isPasswordDerivative(newPassword, account.email)) {
    await logAudit(c.env, {
      entityType: 'user',
      entityId: verify.record.userId,
      action: 'admin_reset_denied',
      payload: { reason: 'derivative_password', traceId },
    }, c.executionCtx);
    return apiError(c, 400, 'WEAK_PASSWORD', 'Password is too similar to your email address');
  }

  // Atomic: update password hash + mark the reset token used in one operation.
  await changePasswordAndConsumeResetToken(c.env, verify.record.userId, newPassword, verify.record.id);

  // Session revocation after reset (ADR-232): no auto-login; all prior sessions die.
  await revokeAllAdminSessionsForUser(c.env, verify.record.userId);
  await revokeAllReaderSessionsForUser(c.env, verify.record.userId);
  await revokeTokensForAccount(c.env, { userId: verify.record.userId, email: account.email });

  await logAudit(c.env, {
    entityType: 'user',
    entityId: verify.record.userId,
    action: 'admin_reset_completed',
    actorEmail: account.email,
    payload: { traceId },
  }, c.executionCtx);

  // Reset-complete response — NOT a login response (ADR-232).
  return c.json({ ok: true, data: { reset: true } });
});

// =============================================================================
// Authenticated account lifecycle + session hardening endpoints (ADR-231/234).
// =============================================================================

authRouter.post('/account/password-change', adminAuth, zValidator('json', PasswordChangeSchema), async (c) => {
  const { currentPassword, newPassword } = c.req.valid('json');
  const admin = c.get('adminUser');

  const account = await getAccountByEmail(c.env, admin.email);
  if (!account || accountIsLocked(account)) {
    return apiError(c, 403, 'ACCOUNT_LOCKED', 'Account unavailable');
  }

  const validCurrent = await verifyAccountPassword(c.env, admin.id, currentPassword);
  if (!validCurrent) {
    await logAudit(c.env, {
      entityType: 'user',
      entityId: admin.id,
      action: 'password_change_denied',
      actorEmail: admin.email,
      payload: { reason: 'invalid_current_password' },
    }, c.executionCtx);
    return apiError(c, 401, 'INVALID_CREDENTIALS', 'Current password is incorrect');
  }

  if (isPasswordDerivative(newPassword, account.email)) {
    return apiError(c, 400, 'WEAK_PASSWORD', 'Password is too similar to your email address');
  }

  await changePassword(c.env, admin.id, newPassword);

  // Revoke all OTHER admin sessions (rotation: keep the current one alive).
  const authHeader = c.req.header('Authorization') ?? '';
  const currentToken = authHeader.replace('Bearer ', '');
  const currentHash = await hashAdminToken(currentToken);
  await revokeAllAdminSessionsForUser(c.env, admin.id, { exceptTokenHash: currentHash });

  await logAudit(c.env, {
    entityType: 'user',
    entityId: admin.id,
    action: 'password_changed',
    actorEmail: admin.email,
    payload: { method: 'password_change' },
  }, c.executionCtx);

  return c.json({ ok: true });
});

authRouter.get('/account/sessions', adminAuth, async (c) => {
  const admin = c.get('adminUser');
  const authHeader = c.req.header('Authorization') ?? '';
  const currentToken = authHeader.replace('Bearer ', '');
  const currentHash = await hashAdminToken(currentToken);

  const sessions = await listAdminSessionsForUser(c.env, admin.id, currentHash);

  await logAudit(c.env, {
    entityType: 'session',
    entityId: admin.id,
    action: 'session_list_viewed',
    actorEmail: admin.email,
    payload: { count: sessions.length },
  }, c.executionCtx);

  return c.json({ ok: true, data: { sessions } });
});

authRouter.post('/account/logout-all', adminAuth, async (c) => {
  const admin = c.get('adminUser');
  const authHeader = c.req.header('Authorization') ?? '';
  const currentToken = authHeader.replace('Bearer ', '');
  const currentHash = await hashAdminToken(currentToken);

  await revokeAllAdminSessionsForUser(c.env, admin.id, { exceptTokenHash: currentHash });

  await logAudit(c.env, {
    entityType: 'session',
    entityId: admin.id,
    action: 'sessions_revoked',
    actorEmail: admin.email,
    payload: { scope: 'all_but_current' },
  }, c.executionCtx);

  return c.json({ ok: true });
});

authRouter.post('/account/step-up', adminAuth, zValidator('json', StepUpSchema), async (c) => {
  const { currentPassword } = c.req.valid('json');
  const admin = c.get('adminUser');
  const authHeader = c.req.header('Authorization') ?? '';
  const currentToken = authHeader.replace('Bearer ', '');

  const validCurrent = await verifyAccountPassword(c.env, admin.id, currentPassword);
  if (!validCurrent) {
    await logAudit(c.env, {
      entityType: 'session',
      entityId: admin.id,
      action: 'step_up_failure',
      actorEmail: admin.email,
      payload: { reason: 'invalid_password' },
    }, c.executionCtx);
    return apiError(c, 401, 'INVALID_CREDENTIALS', 'Password is incorrect');
  }

  const raised = await raiseAdminAssurance(c.env, currentToken, 'step_up');
  if (!raised.ok) {
    return apiError(c, 401, 'SESSION_INVALID', 'Invalid session');
  }

  await logAudit(c.env, {
    entityType: 'session',
    entityId: admin.id,
    action: 'step_up_success',
    actorEmail: admin.email,
  }, c.executionCtx);

  return c.json({ ok: true, data: { token: raised.token } });
});

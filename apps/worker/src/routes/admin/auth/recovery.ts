import { zValidator } from '@hono/zod-validator';
import { AdminRecoveryRequestSchema, AdminRecoveryVerifySchema } from '@do-epub-studio/schema';
import { checkRateLimitDO } from '../../../lib/rate-limit-client';
import {
  createResetToken,
  verifyResetToken,
  bumpResetTokenAttempt,
  revokeTokensForAccount,
  purgeExpiredTokensForAccount,
} from '../../../auth/reset';
import {
  revokeAllAdminSessionsForUser,
  revokeAllReaderSessionsForUser,
  revokeAllReaderSessionsForEmail,
} from '../../../auth/admin-middleware';
import {
  accountIsLocked,
  isPasswordDerivative,
  changePasswordAndConsumeResetToken,
} from '../../../auth/account';
import { logAudit } from '../../../audit';
import { logRiskEvent, RISK_EVENTS } from '../../../audit/risk';
import { createEmailTransport } from '../../../lib/email-transport';
import { queryFirst } from '../../../db/client';
import { apiError } from '../../../lib/api-error';
import { getClientIp, hashString } from './shared';
import type { AuthApp } from './types';

export function registerRecovery(router: AuthApp): void {
  router.post('/recovery-request', zValidator('json', AdminRecoveryRequestSchema), async (c) => {
    const { email } = c.req.valid('json');
    const emailKey = email.toLowerCase();
    const traceId = c.get('requestContext').traceId;
    // Pure-IP hash: the per-IP rate-limit key must not be salted by the target
    // email or it becomes per-IP-per-account and defeats the per-IP cap.
    const ipHash = await hashString(getClientIp(c));

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
      // Clean up this account's expired tokens before minting a fresh one.
      await purgeExpiredTokensForAccount(c.env, { userId: user.id, email: emailKey });

      const token = await createResetToken(c.env, {
        purpose: 'admin_reset',
        userId: user.id,
        email: emailKey,
        ipHash,
        traceId,
      });
      const resetUrl = `${c.env.APP_BASE_URL}/admin/recover?token=${token}`;

      const transport = createEmailTransport(c.env);
      // Fire-and-forget: don't let response latency reveal account existence
      // (CWE-204 timing side channel); the reset email still always sends for eligible users.
      c.executionCtx.waitUntil(transport.send({
        to: emailKey,
        subject: 'Reset your d.o.EPUB Studio Admin password',
        text: `Click the link to reset your admin password (valid for 15 minutes): ${resetUrl}`,
        html: `<p>Click <a href="${resetUrl}">here</a> to reset your admin password. This link expires in 15 minutes.</p>`,
        context: c.get('requestContext'),
      }));

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

  router.post('/recovery-verify', zValidator('json', AdminRecoveryVerifySchema), async (c) => {
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
      // Replaying an already-consumed admin reset token (ADR-234 item 7).
      if (!verify.ok && verify.reason === 'used') {
        await logRiskEvent(c.env, c.executionCtx, {
          kind: RISK_EVENTS.tokenReplay,
          entityId: 'unknown',
          entityType: 'user',
          payload: { kind: 'password_reset', account: 'unknown' },
        });
      }
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
    // Revoke reader sessions both by user_id AND by email: reader_sessions created
    // before the user_id backfill carry a NULL user_id (CWE-613), so revoking by
    // email alone guarantees the account's live reader sessions are terminated.
    await revokeAllReaderSessionsForUser(c.env, verify.record.userId);
    await revokeAllReaderSessionsForEmail(c.env, account.email);
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
}

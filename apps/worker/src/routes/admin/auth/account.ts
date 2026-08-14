import { zValidator } from '@hono/zod-validator';
import { PasswordChangeSchema, StepUpSchema } from '@do-epub-studio/schema';
import {
  hashToken as hashAdminToken,
  revokeAllAdminSessionsForUser,
  listAdminSessionsForUser,
  raiseAdminAssurance,
} from '../../../auth/admin-middleware';
import {
  getAccountByEmail,
  accountIsLocked,
  verifyAccountPassword,
  changePassword,
  isPasswordDerivative,
} from '../../../auth/account';
import { logAudit } from '../../../audit';
import { apiError } from '../../../lib/api-error';
import { adminAuth } from '../../../middleware/auth';
import type { AuthApp } from './types';

export function registerAccount(router: AuthApp): void {
  // =============================================================================
  // Authenticated account lifecycle + session hardening endpoints (ADR-231/234).
  // =============================================================================

  router.post('/account/password-change', adminAuth, zValidator('json', PasswordChangeSchema), async (c) => {
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

  router.get('/account/sessions', adminAuth, async (c) => {
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

  router.post('/account/logout-all', adminAuth, async (c) => {
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

  router.post('/account/step-up', adminAuth, zValidator('json', StepUpSchema), async (c) => {
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
}

// Admin MFA management: passkey removal and recovery-code regeneration,
// extracted from `mfa.ts` (ADR-278 warn-zone extraction). Both are
// session-authed, password-confirmed management endpoints that mutate MFA
// state and therefore re-raise the session and revoke other sessions.
import type { z } from 'zod';
import type { MfaRemoveSchema, RecoveryCodeRegenSchema } from '@do-epub-studio/schema';
import { verifyAccountPassword } from '../../../auth/account';
import {
  raiseAdminAssurance,
  hashToken as hashAdminToken,
  revokeAllAdminSessionsForUser,
} from '../../../auth/admin-middleware';
import {
  listPasskeys,
  getPasskeyById,
  deletePasskey,
  createRecoveryCodes,
  writeRecoveryHashes,
  clearRecoveryHashes,
  clearMfaEnrolled,
} from '../../../auth/mfa';
import { logAudit } from '../../../audit';
import { apiError } from '../../../lib/api-error';
import type { RouteContext } from './types';

export async function mfaRemovePasskey(c: RouteContext): Promise<Response> {
  const { currentPassword } = c.req.valid('json') as z.infer<typeof MfaRemoveSchema>;
  const admin = c.get('adminUser');
  const id = c.req.param('id') ?? '';

  const validCurrent = await verifyAccountPassword(c.env, admin.id, currentPassword);
  if (!validCurrent) {
    await logAudit(
      c.env,
      {
        entityType: 'user',
        entityId: admin.id,
        action: 'mfa_remove_failure',
        actorEmail: admin.email,
        payload: { reason: 'invalid_current_password' },
      },
      c.executionCtx,
    );
    return apiError(c, 401, 'INVALID_CREDENTIALS', 'Current password is incorrect');
  }

  const passkey = await getPasskeyById(c.env, id, admin.id);
  if (!passkey) {
    return apiError(c, 404, 'NOT_FOUND', 'Passkey not found');
  }

  await deletePasskey(c.env, id, admin.id);
  const remaining = await listPasskeys(c.env, admin.id);
  const mfaEnrolled = remaining.length > 0;
  if (!mfaEnrolled) {
    await clearMfaEnrolled(c.env, admin.id);
    await clearRecoveryHashes(c.env, admin.id);
  }

  // Re-raise the current session to `step_up` (a downgrade is not allowed; the
  // account no longer has MFA, so `mfa` assurance cannot be granted) and revoke
  // all other sessions on the MFA-state change.
  const authHeader = c.req.header('Authorization') ?? '';
  const currentToken = authHeader.replace('Bearer ', '');
  const raised = await raiseAdminAssurance(c.env, currentToken, 'step_up');
  if (!raised.ok) {
    return apiError(c, 401, 'SESSION_INVALID', 'Invalid session');
  }
  const newHash = await hashAdminToken(raised.token);
  await revokeAllAdminSessionsForUser(c.env, admin.id, { exceptTokenHash: newHash });

  await logAudit(
    c.env,
    {
      entityType: 'user',
      entityId: admin.id,
      action: 'mfa_remove',
      actorEmail: admin.email,
    },
    c.executionCtx,
  );

  return c.json({ ok: true, data: { mfaEnrolled } });
}

export async function mfaRecoveryCodesRegenerate(c: RouteContext): Promise<Response> {
  const { currentPassword } = c.req.valid('json') as z.infer<typeof RecoveryCodeRegenSchema>;
  const admin = c.get('adminUser');

  const validCurrent = await verifyAccountPassword(c.env, admin.id, currentPassword);
  if (!validCurrent) {
    await logAudit(
      c.env,
      {
        entityType: 'user',
        entityId: admin.id,
        action: 'recovery_code_regenerated_denied',
        actorEmail: admin.email,
        payload: { reason: 'invalid_current_password' },
      },
      c.executionCtx,
    );
    return apiError(c, 401, 'INVALID_CREDENTIALS', 'Current password is incorrect');
  }

  const generated = await createRecoveryCodes(10);
  await writeRecoveryHashes(c.env, admin.id, generated.hashes);

  await logAudit(
    c.env,
    {
      entityType: 'user',
      entityId: admin.id,
      action: 'recovery_code_regenerated',
      actorEmail: admin.email,
    },
    c.executionCtx,
  );

  return c.json({ ok: true, data: { recoveryCodes: generated.codes } });
}

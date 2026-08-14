import { zValidator } from '@hono/zod-validator';
import {
  MfaRegisterStartSchema,
  MfaRegisterVerifySchema,
  MfaAuthenticateVerifySchema,
  MfaRemoveSchema,
  RecoveryCodeRegenSchema,
} from '@do-epub-studio/schema';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type WebAuthnCredential,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { verifyAccountPassword } from '../../../auth/account';
import {
  raiseAdminAssurance,
  hashToken as hashAdminToken,
  revokeAllAdminSessionsForUser,
} from '../../../auth/admin-middleware';
import {
  storeChallenge,
  findChallenge,
  consumeChallenge,
  isChallengeUsable,
  getMfaState,
  listPasskeys,
  getPasskeyById,
  getPasskeyByCredentialId,
  insertPasskey,
  updatePasskeyCounter,
  deletePasskey,
  bufferToBase64Url,
  decodeBase64UrlToBytes,
  decodeClientDataChallenge,
  createRecoveryCodes,
  writeRecoveryHashes,
  hasRecoveryCodes,
  clearRecoveryHashes,
  clearMfaEnrolled,
  setMfaEnrolled,
} from '../../../auth/mfa';
import { logAudit } from '../../../audit';
import { apiError } from '../../../lib/api-error';
import { adminAuth } from '../../../middleware/auth';
import { requireStepUp } from '../../../middleware/step-up';
import { requireMfa } from '../../../middleware/mfa';
import { MFA_CEREMONY_TIMEOUT_MS } from './shared';
import type { AuthApp } from './types';

export function registerMfa(router: AuthApp): void {
  // =============================================================================
  // ADR-234 items 5+6: WebAuthn passkey MFA (enroll/list/remove) + recovery codes.
  // Admin accounts only. Passkey authentication raises the session to `mfa`
  // assurance; MFA-management and high-sensitivity mutations are guarded by
  // `requireMfa`. Recovery codes are SHA-256 hashed at rest and single-use.
  // =============================================================================

  router.get('/account/mfa/status', adminAuth, async (c) => {
    const admin = c.get('adminUser');
    const state = await getMfaState(c.env, admin.id);
    const passkeys = await listPasskeys(c.env, admin.id);
    const recoveryCodesPresent = await hasRecoveryCodes(c.env, admin.id);

    return c.json({
      ok: true,
      data: {
        mfaEnrolled: state.method === 'passkey',
        method: state.method,
        enrolledAt: state.enrolledAt,
        passkeys: passkeys.map((p) => ({ id: p.id, displayName: p.display_name, createdAt: p.created_at })),
        recoveryCodesPresent,
      },
    });
  });

  router.post('/account/mfa/register-start', adminAuth, requireStepUp, zValidator('json', MfaRegisterStartSchema), async (c) => {
    const { currentPassword, displayName } = c.req.valid('json');
    const admin = c.get('adminUser');

    // Re-verify the current password (recent step-up + current password, per the
    // ADR-234 matrix) before beginning the ceremony.
    const validCurrent = await verifyAccountPassword(c.env, admin.id, currentPassword);
    if (!validCurrent) {
      await logAudit(c.env, {
        entityType: 'user',
        entityId: admin.id,
        action: 'mfa_enroll_failure',
        actorEmail: admin.email,
        payload: { reason: 'invalid_current_password' },
      }, c.executionCtx);
      return apiError(c, 401, 'INVALID_CREDENTIALS', 'Current password is incorrect');
    }

    const existing = await listPasskeys(c.env, admin.id);
    const options = await generateRegistrationOptions({
      rpName: c.env.WEBAUTHN_RP_NAME ?? 'd.o.EPUB Studio',
      rpID: c.env.WEBAUTHN_RP_ID,
      userName: admin.email,
      userDisplayName: displayName || admin.email,
      userID: new TextEncoder().encode(admin.id),
      timeout: MFA_CEREMONY_TIMEOUT_MS,
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
      excludeCredentials: existing.map((p) => ({ id: p.credential_id })),
    });

    await storeChallenge(c.env, {
      id: options.challenge,
      userId: admin.id,
      purpose: 'registration',
      rawChallenge: options.challenge,
      expiresAt: new Date(Date.now() + MFA_CEREMONY_TIMEOUT_MS).toISOString(),
    });

    await logAudit(c.env, {
      entityType: 'user',
      entityId: admin.id,
      action: 'mfa_enroll_started',
      actorEmail: admin.email,
    }, c.executionCtx);

    return c.json({ ok: true, data: { options } });
  });

  router.post('/account/mfa/register-verify', adminAuth, requireStepUp, zValidator('json', MfaRegisterVerifySchema), async (c) => {
    const { registrationResponse, deviceName } = c.req.valid('json');
    const admin = c.get('adminUser');
    const response = registrationResponse as unknown as RegistrationResponseJSON;
    const challengeId = decodeClientDataChallenge(response.response.clientDataJSON ?? '');
    if (!challengeId) {
      return apiError(c, 400, 'INVALID_CHALLENGE', 'Invalid or missing WebAuthn challenge');
    }

    const stored = await findChallenge(c.env, challengeId);
    if (!isChallengeUsable(stored, { userId: admin.id, purpose: 'registration' })) {
      return apiError(c, 400, 'INVALID_CHALLENGE', 'Invalid, used, or expired challenge');
    }

    // Consume first: single-use + expiry enforced atomically before verification,
    // so a failed or repeated ceremony can never replay the same challenge.
    const consumed = await consumeChallenge(c.env, challengeId);
    if (!consumed) {
      return apiError(c, 400, 'INVALID_CHALLENGE', 'Invalid, used, or expired challenge');
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: stored.raw_challenge,
        expectedOrigin: c.env.WEBAUTHN_ORIGIN,
        expectedRPID: c.env.WEBAUTHN_RP_ID,
      });
    } catch {
      await logAudit(c.env, {
        entityType: 'user',
        entityId: admin.id,
        action: 'mfa_enroll_failure',
        actorEmail: admin.email,
        payload: { reason: 'verification_error' },
      }, c.executionCtx);
      return apiError(c, 400, 'INVALID_REGISTRATION', 'Passkey verification failed');
    }

    if (!verification.verified || !verification.registrationInfo) {
      await logAudit(c.env, {
        entityType: 'user',
        entityId: admin.id,
        action: 'mfa_enroll_failure',
        actorEmail: admin.email,
        payload: { reason: 'not_verified' },
      }, c.executionCtx);
      return apiError(c, 400, 'INVALID_REGISTRATION', 'Passkey verification failed');
    }

    const info = verification.registrationInfo;
    const deviceId = info.credential.id;
    await insertPasskey(c.env, admin.id, {
      credentialId: deviceId,
      publicKey: bufferToBase64Url(info.credential.publicKey),
      counter: info.credential.counter,
      deviceType: info.credentialDeviceType,
      backedUp: info.credentialBackedUp,
      transports: info.credential.transports,
      aaguid: info.aaguid,
      displayName: deviceName?.trim() || undefined,
    });

    await setMfaEnrolled(c.env, admin.id, 'passkey');

    let recoveryCodes: string[] | undefined;
    if (!(await hasRecoveryCodes(c.env, admin.id))) {
      const generated = await createRecoveryCodes(10);
      await writeRecoveryHashes(c.env, admin.id, generated.hashes);
      recoveryCodes = generated.codes;
      await logAudit(c.env, {
        entityType: 'user',
        entityId: admin.id,
        action: 'recovery_codes_generated',
        actorEmail: admin.email,
      }, c.executionCtx);
    }

    const authHeader = c.req.header('Authorization') ?? '';
    const currentToken = authHeader.replace('Bearer ', '');
    const raised = await raiseAdminAssurance(c.env, currentToken, 'mfa');
    if (!raised.ok) {
      return apiError(c, 401, 'SESSION_INVALID', 'Invalid session');
    }
    const newHash = await hashAdminToken(raised.token);
    await revokeAllAdminSessionsForUser(c.env, admin.id, { exceptTokenHash: newHash });

    await logAudit(c.env, {
      entityType: 'user',
      entityId: admin.id,
      action: 'mfa_enroll',
      actorEmail: admin.email,
      payload: { deviceName: deviceName ?? null },
    }, c.executionCtx);

    return c.json({
      ok: true,
      data: { token: raised.token, recoveryCodes, deviceId },
    });
  });

  router.post('/account/mfa/authenticate-start', adminAuth, async (c) => {
    const admin = c.get('adminUser');
    const existing = await listPasskeys(c.env, admin.id);

    const options = await generateAuthenticationOptions({
      rpID: c.env.WEBAUTHN_RP_ID,
      allowCredentials: existing.map((p) => ({ id: p.credential_id })),
      userVerification: 'required',
      timeout: MFA_CEREMONY_TIMEOUT_MS,
    });

    await storeChallenge(c.env, {
      id: options.challenge,
      userId: admin.id,
      purpose: 'authentication',
      rawChallenge: options.challenge,
      expiresAt: new Date(Date.now() + MFA_CEREMONY_TIMEOUT_MS).toISOString(),
    });

    await logAudit(c.env, {
      entityType: 'session',
      entityId: admin.id,
      action: 'mfa_auth_started',
      actorEmail: admin.email,
    }, c.executionCtx);

    return c.json({ ok: true, data: { options } });
  });

  router.post('/account/mfa/authenticate-verify', adminAuth, zValidator('json', MfaAuthenticateVerifySchema), async (c) => {
    const { authenticationResponse } = c.req.valid('json');
    const admin = c.get('adminUser');
    const response = authenticationResponse as unknown as AuthenticationResponseJSON;
    const challengeId = decodeClientDataChallenge(response.response.clientDataJSON ?? '');
    if (!challengeId) {
      return apiError(c, 400, 'INVALID_CHALLENGE', 'Invalid or missing WebAuthn challenge');
    }

    const stored = await findChallenge(c.env, challengeId);
    if (!isChallengeUsable(stored, { userId: admin.id, purpose: 'authentication' })) {
      return apiError(c, 400, 'INVALID_CHALLENGE', 'Invalid, used, or expired challenge');
    }

    const consumed = await consumeChallenge(c.env, challengeId);
    if (!consumed) {
      return apiError(c, 400, 'INVALID_CHALLENGE', 'Invalid, used, or expired challenge');
    }

    const credentialRow = await getPasskeyByCredentialId(c.env, response.id);
    if (!credentialRow) {
      await logAudit(c.env, {
        entityType: 'user',
        entityId: admin.id,
        action: 'mfa_auth_failure',
        actorEmail: admin.email,
        payload: { reason: 'unknown_credential' },
      }, c.executionCtx);
      return apiError(c, 401, 'MFA_FAILED', 'MFA authentication failed');
    }

    // The credential must belong to the acting user — never let a session
    // elevated for user A be satisfied by user B's passkey (ADR-234).
    if (credentialRow.user_id !== admin.id) {
      await logAudit(c.env, {
        entityType: 'user',
        entityId: admin.id,
        action: 'mfa_auth_failure',
        actorEmail: admin.email,
        payload: { reason: 'credential_not_owned' },
      }, c.executionCtx);
      return apiError(c, 401, 'MFA_FAILED', 'MFA authentication failed');
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: stored.raw_challenge,
        expectedOrigin: c.env.WEBAUTHN_ORIGIN,
        expectedRPID: c.env.WEBAUTHN_RP_ID,
        credential: {
          id: credentialRow.credential_id,
          publicKey: decodeBase64UrlToBytes(credentialRow.public_key),
          counter: credentialRow.counter,
          transports: credentialRow.transports
            ? (JSON.parse(credentialRow.transports) as WebAuthnCredential['transports'])
            : undefined,
        },
      });
    } catch {
      await logAudit(c.env, {
        entityType: 'user',
        entityId: admin.id,
        action: 'mfa_auth_failure',
        actorEmail: admin.email,
        payload: { reason: 'verification_error' },
      }, c.executionCtx);
      return apiError(c, 401, 'MFA_FAILED', 'MFA authentication failed');
    }

    if (!verification.verified) {
      await logAudit(c.env, {
        entityType: 'user',
        entityId: admin.id,
        action: 'mfa_auth_failure',
        actorEmail: admin.email,
        payload: { reason: 'not_verified' },
      }, c.executionCtx);
      return apiError(c, 401, 'MFA_FAILED', 'MFA authentication failed');
    }

    await updatePasskeyCounter(c.env, credentialRow.credential_id, verification.authenticationInfo.newCounter);

    const authHeader = c.req.header('Authorization') ?? '';
    const currentToken = authHeader.replace('Bearer ', '');
    const raised = await raiseAdminAssurance(c.env, currentToken, 'mfa');
    if (!raised.ok) {
      return apiError(c, 401, 'SESSION_INVALID', 'Invalid session');
    }
    const newHash = await hashAdminToken(raised.token);
    await revokeAllAdminSessionsForUser(c.env, admin.id, { exceptTokenHash: newHash });

    await logAudit(c.env, {
      entityType: 'user',
      entityId: admin.id,
      action: 'mfa_auth_success',
      actorEmail: admin.email,
    }, c.executionCtx);

    return c.json({ ok: true, data: { token: raised.token } });
  });

  router.delete('/account/mfa/passkey/:id', adminAuth, requireMfa, zValidator('json', MfaRemoveSchema), async (c) => {
    const { currentPassword } = c.req.valid('json');
    const admin = c.get('adminUser');
    const { id } = c.req.param();

    const validCurrent = await verifyAccountPassword(c.env, admin.id, currentPassword);
    if (!validCurrent) {
      await logAudit(c.env, {
        entityType: 'user',
        entityId: admin.id,
        action: 'mfa_remove_failure',
        actorEmail: admin.email,
        payload: { reason: 'invalid_current_password' },
      }, c.executionCtx);
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

    await logAudit(c.env, {
      entityType: 'user',
      entityId: admin.id,
      action: 'mfa_remove',
      actorEmail: admin.email,
    }, c.executionCtx);

    return c.json({ ok: true, data: { mfaEnrolled } });
  });

  router.post('/account/mfa/recovery-codes/regenerate', adminAuth, requireMfa, zValidator('json', RecoveryCodeRegenSchema), async (c) => {
    const { currentPassword } = c.req.valid('json');
    const admin = c.get('adminUser');

    const validCurrent = await verifyAccountPassword(c.env, admin.id, currentPassword);
    if (!validCurrent) {
      await logAudit(c.env, {
        entityType: 'user',
        entityId: admin.id,
        action: 'recovery_code_regenerated_denied',
        actorEmail: admin.email,
        payload: { reason: 'invalid_current_password' },
      }, c.executionCtx);
      return apiError(c, 401, 'INVALID_CREDENTIALS', 'Current password is incorrect');
    }

    const generated = await createRecoveryCodes(10);
    await writeRecoveryHashes(c.env, admin.id, generated.hashes);

    await logAudit(c.env, {
      entityType: 'user',
      entityId: admin.id,
      action: 'recovery_code_regenerated',
      actorEmail: admin.email,
    }, c.executionCtx);

    return c.json({ ok: true, data: { recoveryCodes: generated.codes } });
  });
}

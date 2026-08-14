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
  MfaRegisterStartSchema,
  MfaRegisterVerifySchema,
  MfaAuthenticateVerifySchema,
  MfaRemoveSchema,
  RecoveryCodeRegenSchema,
  RecoveryVerifyLoginSchema,
  LoginMfaVerifySchema,
  LoginMfaStartSchema,
} from '@do-epub-studio/schema';
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  generateRegistrationOptions,
  verifyRegistrationResponse,
  type WebAuthnCredential,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { checkRateLimitDO } from '../../lib/rate-limit-client';
import {
  createAdminSession,
  createAdminSessionMfa,
  revokeAdminSession,
  revokeAllAdminSessionsForUser,
  revokeAllReaderSessionsForUser,
  revokeAllReaderSessionsForEmail,
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
  purgeExpiredTokensForAccount,
} from '../../auth/reset';
import {
  storeChallenge,
  findChallenge,
  consumeChallenge,
  isChallengeUsable,
  createLoginTicket,
  findLoginTicket,
  isLoginTicketUsable,
  consumeLoginTicket,
  userHasMfa,
  verifyRecoveryCode,
  decodeClientDataChallenge,
  createRecoveryCodes,
  writeRecoveryHashes,
  hasRecoveryCodes,
  clearRecoveryHashes,
  clearMfaEnrolled,
  setMfaEnrolled,
  getMfaState,
  listPasskeys,
  getPasskeyById,
  getPasskeyByCredentialId,
  insertPasskey,
  updatePasskeyCounter,
  deletePasskey,
  bufferToBase64Url,
  decodeBase64UrlToBytes,
} from '../../auth/mfa';
import { logAudit } from '../../audit';
import { logRiskEvent, RISK_EVENTS, deviceFingerprint } from '../../audit/risk';
import { createEmailTransport } from '../../lib/email-transport';
import { queryFirst } from '../../db/client';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { apiError } from '../../lib/api-error';
import { adminAuth } from '../../middleware/auth';
import { requireStepUp } from '../../middleware/step-up';
import { requireMfa } from '../../middleware/mfa';

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

  const clientHints = {
    ipHash: await hashString(getClientIp(c)),
    deviceLabelHash: await deviceFingerprint(c.req.header('User-Agent')),
  };

  const result = await createAdminSession(c.env, email, password, clientHints);

  if (!result.ok) {
    // Observational lockout risk event (ADR-234 item 7): emit when a login
    // attempt is rejected because the target account is actually locked
    // (disabled/compromised). Semantics unchanged.
    const lockedAccount = await getAccountByEmail(c.env, email.toLowerCase());
    if (lockedAccount && accountIsLocked(lockedAccount)) {
      await logRiskEvent(c.env, c.executionCtx, {
        kind: RISK_EVENTS.loginLocked,
        actorEmail: lockedAccount.email,
        entityId: lockedAccount.id,
        entityType: 'user',
        payload: { account: email.toLowerCase(), ipHash: clientHints.ipHash },
      });
    }
    return apiError(c, result.status as ContentfulStatusCode, 'INVALID_CREDENTIALS', result.error);
  }

  // ADR-234 MFA enforcement: an enrolled admin must complete a second factor
  // (passkey or recovery code) before a usable session is issued.
  if (!('token' in result)) {
    await logAudit(c.env, {
      entityType: 'user',
      entityId: result.user.id,
      action: 'admin_login_mfa_pending',
      actorEmail: result.user.email,
      payload: { role: result.user.role },
    }, c.executionCtx);

    // Prove factor 1 (password) was verified: issue a short-lived single-use
    // ticket the /login/mfa/* ceremony must present to mint an `mfa` session.
    const loginTicket = await createLoginTicket(c.env, result.user.id);

    return c.json({
      ok: true,
      data: {
        mfaRequired: true,
        loginTicket,
        user: {
          id: result.user.id,
          email: result.user.email,
          role: result.user.role,
        },
      },
    });
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

// =============================================================================
// ADR-234 MFA gap closure: public login-time second-factor completion (no
// bearer token required). These run only for enrolled admins after /login
// returns mfaRequired, and are the only pre-session paths that mint an `mfa`
// session.
// =============================================================================

authRouter.post('/login/mfa/start', zValidator('json', LoginMfaStartSchema), async (c) => {
  const { loginTicket } = c.req.valid('json');

  const rateLimit = await checkRateLimitDO(c.env, 'auth_admin_mfa_start', loginTicket, {
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) {
    return apiError(c, 429, 'TOO_MANY_REQUESTS', 'Too many attempts. Please try again later.');
  }

  // The ticket is issued only by a successful password /login (factor 1). Its
  // presence here proves the password was verified, and gates the credential /
  // enrollment disclosure so an unauthenticated caller learns nothing.
  const ticket = await findLoginTicket(c.env, loginTicket);
  if (!isLoginTicketUsable(ticket)) {
    return apiError(c, 401, 'INVALID_LOGIN_TICKET', 'Complete password sign-in before passkey login');
  }

  const user = await queryFirst<{ id: string; email: string; global_role: string; disabled_at: string | null; compromised_at: string | null }>(
    c.env,
    `SELECT id, email, global_role, disabled_at, compromised_at FROM users WHERE id = ?`,
    [ticket.user_id],
  );

  // Uniform 401: do not reveal whether the account exists, is non-admin, or is
  // not MFA-enrolled (CWE-204). MFA must be required to proceed.
  if (!user || user.global_role !== 'admin' || user.disabled_at || user.compromised_at || !(await userHasMfa(c.env, user.id))) {
    return apiError(c, 401, 'MFA_REQUIRED', 'MFA is required to complete sign-in');
  }

  const existing = await listPasskeys(c.env, user.id);
  const options = await generateAuthenticationOptions({
    rpID: c.env.WEBAUTHN_RP_ID,
    allowCredentials: existing.map((p) => ({ id: p.credential_id })),
    userVerification: 'required',
    timeout: MFA_CEREMONY_TIMEOUT_MS,
  });

  await storeChallenge(c.env, {
    id: options.challenge,
    userId: user.id,
    purpose: 'authentication',
    rawChallenge: options.challenge,
    expiresAt: new Date(Date.now() + MFA_CEREMONY_TIMEOUT_MS).toISOString(),
  });

  await logAudit(c.env, {
    entityType: 'user',
    entityId: user.id,
    action: 'mfa_auth_started',
    actorEmail: user.email,
  }, c.executionCtx);

  return c.json({ ok: true, data: { options } });
});

/**
 * Factor-2 (WebAuthn passkey) verification for admin login. Encapsulates the
 * single-use challenge consumption, credential lookup/ownership check, and
 * passkey verification so the `/login/mfa/verify` handler stays readable
 * (ADR-234 items 5+6 + 7). On failure it emits the existing `mfa_auth_failure`
 * audit event and returns a response shape the handler maps to an apiError.
 */
interface MfaFactorContext {
  env: Env;
  executionCtx: { waitUntil: (p: Promise<unknown>) => void } | undefined;
}

type MfaFactorOutcome =
  | {
      ok: true;
      stored: { raw_challenge: string };
      credential: { credential_id: string; public_key: string; counter: number; transports: string | null };
      newCounter: number;
    }
  | { ok: false; status: number; code: string; message: string };

/** Emit the `mfa_auth_failure` audit event and return a failure outcome. */
const MFA_FAILURE_OUTCOME: { ok: false; status: number; code: string; message: string } = {
  ok: false,
  status: 401,
  code: 'MFA_FAILED',
  message: 'MFA authentication failed',
};

async function logMfaFailure(
  c: MfaFactorContext,
  user: { id: string; email: string },
  reason: string,
): Promise<void> {
  await logAudit(c.env, {
    entityType: 'user',
    entityId: user.id,
    action: 'mfa_auth_failure',
    actorEmail: user.email,
    payload: { reason },
  }, c.executionCtx);
}

/** Emit a login-ticket replay risk event (ADR-234 item 7). */
async function logLoginTicketReplay(
  c: MfaFactorContext,
  user: { id: string; email: string },
): Promise<void> {
  await logRiskEvent(c.env, c.executionCtx, {
    kind: RISK_EVENTS.tokenReplay,
    actorEmail: user.email,
    entityId: user.id,
    entityType: 'user',
    payload: { kind: 'login_ticket', account: user.email },
  });
}

async function verifyPasskeyFactor(
  c: MfaFactorContext,
  user: { id: string; email: string },
  response: AuthenticationResponseJSON,
): Promise<MfaFactorOutcome> {
  const challengeId = decodeClientDataChallenge(response.response.clientDataJSON ?? '');
  if (!challengeId) {
    return { ok: false, status: 400, code: 'INVALID_CHALLENGE', message: 'Invalid or missing WebAuthn challenge' };
  }

  const stored = await findChallenge(c.env, challengeId);
  if (!isChallengeUsable(stored, { userId: user.id, purpose: 'authentication' })) {
    return { ok: false, status: 400, code: 'INVALID_CHALLENGE', message: 'Invalid, used, or expired challenge' };
  }

  // Consume first: single-use + expiry enforced atomically before verification.
  const consumed = await consumeChallenge(c.env, challengeId);
  if (!consumed) {
    return { ok: false, status: 400, code: 'INVALID_CHALLENGE', message: 'Invalid, used, or expired challenge' };
  }

  const credentialRow = await getPasskeyByCredentialId(c.env, response.id);
  if (!credentialRow) {
    await logMfaFailure(c, user, 'unknown_credential');
    return MFA_FAILURE_OUTCOME;
  }

  if (credentialRow.user_id !== user.id) {
    await logMfaFailure(c, user, 'credential_not_owned');
    return MFA_FAILURE_OUTCOME;
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
    await logMfaFailure(c, user, 'verification_error');
    return MFA_FAILURE_OUTCOME;
  }

  if (!verification.verified) {
    await logMfaFailure(c, user, 'not_verified');
    return MFA_FAILURE_OUTCOME;
  }

  return {
    ok: true,
    stored,
    credential: credentialRow,
    newCounter: verification.authenticationInfo.newCounter,
  };
}

authRouter.post('/login/mfa/verify', zValidator('json', LoginMfaVerifySchema), async (c) => {
  const { loginTicket, authenticationResponse } = c.req.valid('json');
  const response = authenticationResponse as unknown as AuthenticationResponseJSON;

  const rateLimit = await checkRateLimitDO(c.env, 'auth_admin_mfa_verify', loginTicket, {
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) {
    return apiError(c, 429, 'TOO_MANY_REQUESTS', 'Too many attempts. Please try again later.');
  }

  const ticket = await findLoginTicket(c.env, loginTicket);
  const ticketReplay = Boolean(ticket?.used_at);
  const ticketUserId = ticket?.user_id;
  if (!isLoginTicketUsable(ticket)) {
    // A present-but-already-consumed ticket is a single-use replay (ADR-234
    // item 7). Observational risk event; the rejection itself is unchanged.
    if (ticketReplay) {
      await logRiskEvent(c.env, c.executionCtx, {
        kind: RISK_EVENTS.tokenReplay,
        entityId: ticketUserId ?? 'unknown',
        entityType: 'user',
        payload: { kind: 'login_ticket', account: 'unknown' },
      });
    }
    return apiError(c, 401, 'INVALID_LOGIN_TICKET', 'Complete password sign-in before passkey login');
  }

  const user = await queryFirst<{ id: string; email: string; global_role: string; disabled_at: string | null; compromised_at: string | null }>(
    c.env,
    `SELECT id, email, global_role, disabled_at, compromised_at FROM users WHERE id = ?`,
    [ticket.user_id],
  );

  if (!user || user.global_role !== 'admin' || user.disabled_at || user.compromised_at || !(await userHasMfa(c.env, user.id))) {
    return apiError(c, 401, 'MFA_REQUIRED', 'MFA is required to complete sign-in');
  }

  const factor = await verifyPasskeyFactor(c, user, response);
  if (!factor.ok) {
    return apiError(c, factor.status as ContentfulStatusCode, factor.code, factor.message);
  }

  // Factor 2 (passkey) verified. Consume the factor-1 login ticket atomically —
  // only the first concurrent caller wins the single-use right to mint an `mfa`
  // session, so a ticket can never be replayed to mint a second session.
  const consumedTicket = await consumeLoginTicket(c.env, loginTicket);
  if (!consumedTicket) {
    // Failed single-use claim -> the ticket was already consumed or expired.
    // Emit an observational login-ticket replay risk event (ADR-234 item 7).
    await logLoginTicketReplay(c, user);
    return apiError(c, 401, 'INVALID_LOGIN_TICKET', 'Complete password sign-in before passkey login');
  }

  // Update the passkey counter only after the login ticket is successfully
  // consumed — if the consumption fails (concurrent race), we abort without
  // mutating the counter, keeping the credential state consistent.
  await updatePasskeyCounter(c.env, factor.credential.credential_id, factor.newCounter);

  const session = await createAdminSessionMfa(c.env, {
    id: user.id,
    email: user.email,
    role: user.global_role,
  }, {
    ipHash: await hashString(getClientIp(c)),
    deviceLabelHash: await deviceFingerprint(c.req.header('User-Agent')),
  });

  await logAudit(c.env, {
    entityType: 'user',
    entityId: user.id,
    action: 'mfa_auth_success',
    actorEmail: user.email,
  }, c.executionCtx);

  return c.json({
    ok: true,
    data: {
      token: session.token,
      user: {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
      },
    },
  });
});

authRouter.post('/login/mfa/recovery-verify', zValidator('json', RecoveryVerifyLoginSchema), async (c) => {
  const { email, password, recoveryCode } = c.req.valid('json');

  const rateLimit = await checkRateLimitDO(c.env, 'auth_admin_mfa_recovery', email.toLowerCase(), {
    maxRequests: 5,
    windowMs: 300_000,
  });
  if (!rateLimit.allowed) {
    return apiError(c, 429, 'TOO_MANY_REQUESTS', 'Too many attempts. Please try again later.');
  }

  const user = await queryFirst<{ id: string; email: string; global_role: string; disabled_at: string | null; compromised_at: string | null }>(
    c.env,
    `SELECT id, email, global_role, disabled_at, compromised_at FROM users WHERE email = ?`,
    [email.toLowerCase()],
  );

  if (!user || user.global_role !== 'admin' || user.disabled_at || user.compromised_at || !(await userHasMfa(c.env, user.id))) {
    return apiError(c, 401, 'MFA_REQUIRED', 'MFA is required to complete sign-in');
  }

  // Both factors must hold: the code is consumed single-use only on the
  // successful path (verifyRecoveryCode rewrites on match). Do not reveal which
  // factor failed — and never burn a valid single-use code on a wrong password.
  const validPassword = await verifyAccountPassword(c.env, user.id, password);
  const validCode = validPassword && (await verifyRecoveryCode(c.env, user.id, recoveryCode));

  if (!validPassword || !validCode) {
    await logAudit(c.env, {
      entityType: 'user',
      entityId: user.id,
      action: 'mfa_recovery_failure',
      actorEmail: user.email,
    }, c.executionCtx);
    // A valid password with an unverifiable single-use recovery code is a
    // replay/tamper signal on the recovery code (ADR-234 item 7). Observational.
    if (validPassword && !validCode) {
      await logRiskEvent(c.env, c.executionCtx, {
        kind: RISK_EVENTS.tokenReplay,
        actorEmail: user.email,
        entityId: user.id,
        entityType: 'user',
        payload: { kind: 'recovery_code', account: user.email },
      });
    }
    return apiError(c, 401, 'INVALID_CREDENTIALS', 'Recovery verification failed');
  }

  const session = await createAdminSessionMfa(c.env, {
    id: user.id,
    email: user.email,
    role: user.global_role,
  }, {
    ipHash: await hashString(getClientIp(c)),
    deviceLabelHash: await deviceFingerprint(c.req.header('User-Agent')),
  });

  await logAudit(c.env, {
    entityType: 'user',
    entityId: user.id,
    action: 'mfa_recovery_success',
    actorEmail: user.email,
  }, c.executionCtx);

  return c.json({
    ok: true,
    data: {
      token: session.token,
      user: {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
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

// =============================================================================
// ADR-234 items 5+6: WebAuthn passkey MFA (enroll/list/remove) + recovery codes.
// Admin accounts only. Passkey authentication raises the session to `mfa`
// assurance; MFA-management and high-sensitivity mutations are guarded by
// `requireMfa`. Recovery codes are SHA-256 hashed at rest and single-use.
// =============================================================================

const MFA_CEREMONY_TIMEOUT_MS = 5 * 60 * 1000;

authRouter.get('/account/mfa/status', adminAuth, async (c) => {
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

authRouter.post('/account/mfa/register-start', adminAuth, requireStepUp, zValidator('json', MfaRegisterStartSchema), async (c) => {
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

authRouter.post('/account/mfa/register-verify', adminAuth, requireStepUp, zValidator('json', MfaRegisterVerifySchema), async (c) => {
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

authRouter.post('/account/mfa/authenticate-start', adminAuth, async (c) => {
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

authRouter.post('/account/mfa/authenticate-verify', adminAuth, zValidator('json', MfaAuthenticateVerifySchema), async (c) => {
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

authRouter.delete('/account/mfa/passkey/:id', adminAuth, requireMfa, zValidator('json', MfaRemoveSchema), async (c) => {
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

authRouter.post('/account/mfa/recovery-codes/regenerate', adminAuth, requireMfa, zValidator('json', RecoveryCodeRegenSchema), async (c) => {
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

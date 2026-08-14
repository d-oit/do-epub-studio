import type { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import {
  LoginSchema,
  RecoveryVerifyLoginSchema,
  LoginMfaVerifySchema,
  LoginMfaStartSchema,
} from '@do-epub-studio/schema';
import {
  generateAuthenticationOptions,
  type AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { checkRateLimitDO } from '../../../lib/rate-limit-client';
import {
  createAdminSession,
  createAdminSessionMfa,
  revokeAdminSession,
} from '../../../auth/admin-middleware';
import {
  getAccountByEmail,
  accountIsLocked,
  verifyAccountPassword,
} from '../../../auth/account';
import {
  storeChallenge,
  createLoginTicket,
  findLoginTicket,
  isLoginTicketUsable,
  consumeLoginTicket,
  userHasMfa,
  verifyRecoveryCode,
  listPasskeys,
  updatePasskeyCounter,
} from '../../../auth/mfa';
import { logAudit } from '../../../audit';
import { logRiskEvent, RISK_EVENTS, deviceFingerprint } from '../../../audit/risk';
import { queryFirst } from '../../../db/client';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { apiError } from '../../../lib/api-error';
import { getClientIp, hashString, MFA_CEREMONY_TIMEOUT_MS } from './shared';
import { verifyPasskeyFactor, logLoginTicketReplay } from './login-mfa';
import type { AuthApp, RouteContext } from './types';

// =============================================================================
// Route handlers for the public admin login ceremony. Each is a top-level named
// function so it stays readable and independently verifiable; `registerLogin`
// below is a thin set of registrations.
// =============================================================================

async function login(c: RouteContext): Promise<Response> {
  const { email, password } = c.req.valid('json') as z.infer<typeof LoginSchema>;

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
}

async function loginMfaStart(c: RouteContext): Promise<Response> {
  const { loginTicket } = c.req.valid('json') as z.infer<typeof LoginMfaStartSchema>;

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
}

async function loginMfaVerify(c: RouteContext): Promise<Response> {
  const { loginTicket, authenticationResponse } = c.req.valid('json') as z.infer<typeof LoginMfaVerifySchema>;
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
}

async function loginMfaRecoveryVerify(c: RouteContext): Promise<Response> {
  const { email, password, recoveryCode } = c.req.valid('json') as z.infer<typeof RecoveryVerifyLoginSchema>;

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
}

async function logout(c: RouteContext): Promise<Response> {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '') ?? '';

  if (!token) {
    return apiError(c, 400, 'MISSING_TOKEN', 'Authorization token required');
  }

  await revokeAdminSession(c.env, token);

  return c.json({ ok: true });
}

// =============================================================================
// ADR-234 MFA gap closure: public login-time second-factor completion (no
// bearer token required). These run only for enrolled admins after /login
// returns mfaRequired, and are the only pre-session paths that mint an `mfa`
// session.
// =============================================================================

export function registerLogin(router: AuthApp): void {
  router.post('/login', zValidator('json', LoginSchema), login);
  router.post('/login/mfa/start', zValidator('json', LoginMfaStartSchema), loginMfaStart);
  router.post('/login/mfa/verify', zValidator('json', LoginMfaVerifySchema), loginMfaVerify);
  router.post('/login/mfa/recovery-verify', zValidator('json', RecoveryVerifyLoginSchema), loginMfaRecoveryVerify);
  router.post('/logout', logout);
}

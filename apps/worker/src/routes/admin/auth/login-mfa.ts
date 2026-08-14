import type { Env } from '../../../lib/env';
import {
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
  type WebAuthnCredential,
} from '@simplewebauthn/server';
import {
  decodeClientDataChallenge,
  findChallenge,
  isChallengeUsable,
  consumeChallenge,
  getPasskeyByCredentialId,
  decodeBase64UrlToBytes,
} from '../../../auth/mfa';
import { logAudit } from '../../../audit';
import { logRiskEvent, RISK_EVENTS } from '../../../audit/risk';

/**
 * Factor-2 (WebAuthn passkey) verification for admin login. Encapsulates the
 * single-use challenge consumption, credential lookup/ownership check, and
 * passkey verification so the `/login/mfa/verify` handler stays readable
 * (ADR-234 items 5+6 + 7). On failure it emits the existing `mfa_auth_failure`
 * audit event and returns a response shape the handler maps to an apiError.
 */
export interface MfaFactorContext {
  env: Env;
  executionCtx: { waitUntil: (p: Promise<unknown>) => void } | undefined;
}

export type MfaFactorOutcome =
  | {
      ok: true;
      stored: { raw_challenge: string };
      credential: { credential_id: string; public_key: string; counter: number; transports: string | null };
      newCounter: number;
    }
  | { ok: false; status: number; code: string; message: string };

/** Emit the `mfa_auth_failure` audit event and return a failure outcome. */
export const MFA_FAILURE_OUTCOME: { ok: false; status: number; code: string; message: string } = {
  ok: false,
  status: 401,
  code: 'MFA_FAILED',
  message: 'MFA authentication failed',
};

/** Reason a WebAuthn authentication verification can fail. */
export type PasskeyVerifyFailureReason =
  | 'missing_challenge'
  | 'invalid_challenge'
  | 'unknown_credential'
  | 'credential_not_owned'
  | 'verification_error'
  | 'not_verified';

export interface PasskeyVerifyOk {
  ok: true;
  stored: { raw_challenge: string };
  credential: { credential_id: string; public_key: string; counter: number; transports: string | null };
  newCounter: number;
}

export type PasskeyVerifyResult = PasskeyVerifyOk | { ok: false; reason: PasskeyVerifyFailureReason };

/**
 * Shared WebAuthn authentication-verify core: decode + consume the single-use
 * challenge, look up the credential and enforce ownership, then verify the
 * passkey signature and return the new counter. Used by both the public
 * login-time factor (verifyPasskeyFactor) and the session `/account/mfa/
 * authenticate-verify` handler so the challenge-consume-verify-passkey logic
 * lives exactly once.
 */
export async function verifyPasskeyAuthentication(
  env: Env,
  response: AuthenticationResponseJSON,
  userId: string,
): Promise<PasskeyVerifyResult> {
  const challengeId = decodeClientDataChallenge(response.response.clientDataJSON ?? '');
  if (!challengeId) {
    return { ok: false, reason: 'missing_challenge' };
  }

  const stored = await findChallenge(env, challengeId);
  if (!isChallengeUsable(stored, { userId, purpose: 'authentication' })) {
    return { ok: false, reason: 'invalid_challenge' };
  }

  // Consume first: single-use + expiry enforced atomically before verification.
  const consumed = await consumeChallenge(env, challengeId);
  if (!consumed) {
    return { ok: false, reason: 'invalid_challenge' };
  }

  const credentialRow = await getPasskeyByCredentialId(env, response.id);
  if (!credentialRow) {
    return { ok: false, reason: 'unknown_credential' };
  }

  if (credentialRow.user_id !== userId) {
    return { ok: false, reason: 'credential_not_owned' };
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: stored.raw_challenge,
      expectedOrigin: env.WEBAUTHN_ORIGIN,
      expectedRPID: env.WEBAUTHN_RP_ID,
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
    return { ok: false, reason: 'verification_error' };
  }

  if (!verification.verified) {
    return { ok: false, reason: 'not_verified' };
  }

  return {
    ok: true,
    stored,
    credential: credentialRow,
    newCounter: verification.authenticationInfo.newCounter,
  };
}

export async function logMfaFailure(
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
export async function logLoginTicketReplay(
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

export async function verifyPasskeyFactor(
  c: MfaFactorContext,
  user: { id: string; email: string },
  response: AuthenticationResponseJSON,
): Promise<MfaFactorOutcome> {
  const result = await verifyPasskeyAuthentication(c.env, response, user.id);
  if (result.ok) {
    return { ok: true, stored: result.stored, credential: result.credential, newCounter: result.newCounter };
  }
  if (result.reason === 'missing_challenge') {
    return { ok: false, status: 400, code: 'INVALID_CHALLENGE', message: 'Invalid or missing WebAuthn challenge' };
  }
  if (result.reason === 'invalid_challenge') {
    return { ok: false, status: 400, code: 'INVALID_CHALLENGE', message: 'Invalid, used, or expired challenge' };
  }
  await logMfaFailure(c, user, result.reason);
  return MFA_FAILURE_OUTCOME;
}

// ADR-234 item 7: the single-use recovery-code completion path of the public
// admin login ceremony, extracted from `login.ts` (ADR-278 warn-zone
// extraction). Runs only for enrolled admins after `/login` returns
// `mfaRequired`; mints an `mfa` session.
import type { z } from 'zod';
import type { RecoveryVerifyLoginSchema } from '@do-epub-studio/schema';
import { checkRateLimitDO } from '../../../lib/rate-limit-client';
import { createAdminSessionMfa } from '../../../auth/admin-middleware';
import { verifyAccountPassword } from '../../../auth/account';
import { userHasMfa, verifyRecoveryCode } from '../../../auth/mfa';
import { logAudit } from '../../../audit';
import { logRiskEvent, RISK_EVENTS, deviceFingerprint } from '../../../audit/risk';
import { queryFirst } from '../../../db/client';
import { apiError } from '../../../lib/api-error';
import { getClientIp, hashString } from './shared';
import type { RouteContext } from './types';

export async function loginMfaRecoveryVerify(c: RouteContext): Promise<Response> {
  const { email, password, recoveryCode } = c.req.valid('json') as z.infer<
    typeof RecoveryVerifyLoginSchema
  >;

  const rateLimit = await checkRateLimitDO(c.env, 'auth_admin_mfa_recovery', email.toLowerCase(), {
    maxRequests: 5,
    windowMs: 300_000,
  });
  if (!rateLimit.allowed) {
    return apiError(c, 429, 'TOO_MANY_REQUESTS', 'Too many attempts. Please try again later.');
  }

  const user = await queryFirst<{
    id: string;
    email: string;
    global_role: string;
    disabled_at: string | null;
    compromised_at: string | null;
  }>(
    c.env,
    `SELECT id, email, global_role, disabled_at, compromised_at FROM users WHERE email = ?`,
    [email.toLowerCase()],
  );

  if (
    !user ||
    user.global_role !== 'admin' ||
    user.disabled_at ||
    user.compromised_at ||
    !(await userHasMfa(c.env, user.id))
  ) {
    return apiError(c, 401, 'MFA_REQUIRED', 'MFA is required to complete sign-in');
  }

  // Both factors must hold: the code is consumed single-use only on the
  // successful path (verifyRecoveryCode rewrites on match). Do not reveal which
  // factor failed — and never burn a valid single-use code on a wrong password.
  const validPassword = await verifyAccountPassword(c.env, user.id, password);
  const validCode = validPassword && (await verifyRecoveryCode(c.env, user.id, recoveryCode));

  if (!validPassword || !validCode) {
    await logAudit(
      c.env,
      {
        entityType: 'user',
        entityId: user.id,
        action: 'mfa_recovery_failure',
        actorEmail: user.email,
      },
      c.executionCtx,
    );
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

  const session = await createAdminSessionMfa(
    c.env,
    {
      id: user.id,
      email: user.email,
      role: user.global_role,
    },
    {
      ipHash: await hashString(getClientIp(c)),
      deviceLabelHash: await deviceFingerprint(c.req.header('User-Agent')),
    },
  );

  await logAudit(
    c.env,
    {
      entityType: 'user',
      entityId: user.id,
      action: 'mfa_recovery_success',
      actorEmail: user.email,
    },
    c.executionCtx,
  );

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

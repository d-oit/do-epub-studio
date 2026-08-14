import type { MiddlewareHandler } from 'hono';
import type { Env } from '../lib/env';
import { queryFirst } from '../db/client';
import { hashToken } from '../auth/admin-middleware';
import { apiError } from '../lib/api-error';

// =============================================================================
// ADR-234 items 5+6: MFA (passkey) enforcement for sensitive admin mutations.
//
// Mirrors `requireStepUp` (middleware/step-up.ts) but requires the session to
// have reached the `mfa` assurance level specifically. A baseline `password`
// session or even a `step_up` session is NOT sufficient — the admin must have
// authenticated with a passkey (or otherwise had the account's MFA assurance
// established) to mutate MFA state or change the most sensitive account/role
// settings. `adminAuth` must run BEFORE this middleware at every call site (it
// populates `adminUser` and validates the session).
// =============================================================================

const MFA_ASSURED: Record<string, true> = { mfa: true };

export const requireMfa: MiddlewareHandler<{ Bindings: Env; Variables: { adminUser: { email: string; id: string; role: string } } }> = async (c, next) => {
  const authHeader = c.req.header('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  if (!token) {
    return apiError(c, 428, 'MFA_REQUIRED', 'MFA authentication required', { 'X-Mfa-Required': 'true' });
  }

  const tokenHash = await hashToken(token);
  const session = await queryFirst<{ assurance_level: string }>(
    c.env,
    `SELECT assurance_level FROM admin_sessions
     WHERE token_hash = ? AND revoked_at IS NULL AND datetime(expires_at) > datetime('now')`,
    [tokenHash],
  );

  if (!session) {
    return apiError(c, 401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  if (!MFA_ASSURED[session.assurance_level]) {
    return apiError(c, 428, 'MFA_REQUIRED', 'MFA authentication required', { 'X-Mfa-Required': 'true' });
  }

  await next();
};

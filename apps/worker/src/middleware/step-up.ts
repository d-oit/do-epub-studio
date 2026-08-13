import type { MiddlewareHandler } from 'hono';
import type { Env } from '../lib/env';
import { queryFirst } from '../db/client';
import { hashToken } from '../auth/admin-middleware';
import { apiError } from '../lib/api-error';

// =============================================================================
// ADR-234: step-up reauthentication for sensitive admin mutations.
//
// Sensitive mutations (grant issuance/modification/revocation, book file
// upload/delete) must not be performable by a session created at the baseline
// `password` assurance level alone. The client first POSTs the current password
// to /api/admin/account/step-up, which rotates the bearer token onto a session
// with assurance_level `step_up`. This middleware enforces that upgrade at the
// route boundary, returning 428 STEP_UP_REQUIRED until the session is elevated.
//
// ADR-234 sensitive-action categories intentionally NOT guarded here because
// the corresponding routes do not exist in this codebase (per plan, do not
// invent endpoints): admin account disable/reenable, and demo-seed enablement.
// When those routes are added they must be composed with `requireStepUp`.
// =============================================================================

// Assurance levels that satisfy a step-up requirement. `mfa` also implies the
// reauthentication threshold has been met (assurance is monotonically raised).
const STEP_UP_ASSURED: Record<string, true> = { step_up: true, mfa: true };

export const requireStepUp: MiddlewareHandler<{ Bindings: Env; Variables: { adminUser: { email: string; id: string; role: string } } }> = async (c, next) => {
  const authHeader = c.req.header('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  if (!token) {
    return apiError(c, 428, 'STEP_UP_REQUIRED', 'Step-up authentication required', { 'X-Step-Up-Required': 'true' });
  }

  const tokenHash = await hashToken(token);
  const session = await queryFirst<{ assurance_level: string }>(
    c.env,
    `SELECT assurance_level FROM admin_sessions WHERE token_hash = ? AND revoked_at IS NULL`,
    [tokenHash],
  );

  if (!session) {
    return apiError(c, 401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  if (!STEP_UP_ASSURED[session.assurance_level]) {
    return apiError(c, 428, 'STEP_UP_REQUIRED', 'Step-up authentication required', { 'X-Step-Up-Required': 'true' });
  }

  await next();
};

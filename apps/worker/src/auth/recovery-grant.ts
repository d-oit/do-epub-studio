import type { Env } from '../lib/env';
import { getGrantByBookAndSession, getGrantsBySession, type GrantRow } from './password';

export interface RecoveryGrantResolution {
  grant: GrantRow;
  targetBookId: string;
}

export type RecoveryGrantOutcome =
  | { ok: true; resolution: RecoveryGrantResolution }
  | { ok: false; reason: 'no_grant_for_book' | 'no_grant'; entityId: string };

/**
 * Resolve which grant a reader recovery session may use (ADR-232).
 *
 * A reader magic-link token minted for a specific book carries that book's id,
 * so the recovered session must be bound to a live, ALLOWED grant for EXACTLY
 * that book — never a different same-email book. Legacy tokens without a book
 * binding fall back to the oldest deterministic live grant.
 *
 * The caller owns the audit trail and the HTTP response, so this stays a pure
 * lookup that reports *why* it failed.
 */
export async function resolveRecoveryGrant(
  env: Env,
  grantedEmail: string,
  boundBookId?: string,
): Promise<RecoveryGrantOutcome> {
  if (boundBookId) {
    const grant = await getGrantByBookAndSession(env, boundBookId, grantedEmail);
    if (!grant) return { ok: false, reason: 'no_grant_for_book', entityId: boundBookId };
    return { ok: true, resolution: { grant, targetBookId: boundBookId } };
  }

  const grants = await getGrantsBySession(env, grantedEmail);
  const grant = grants.find(
    (g) =>
      g.allowed === 1 && !g.revoked_at && (!g.expires_at || new Date(g.expires_at) > new Date()),
  );
  if (!grant) return { ok: false, reason: 'no_grant', entityId: grantedEmail };
  return { ok: true, resolution: { grant, targetBookId: grant.book_id } };
}

import type { Env } from '../lib/env';
import { logAudit } from './index';

/**
 * ADR-234 item 7 — observational risk-event handling.
 *
 * Risk events are dedicated audit entries (action = `risk_*`) that tag the
 * audit log with potential account-compromise signals (single-use token replay,
 * lockout, unexpected device change) WITHOUT changing any auth behaviour. Every
 * event merges `facility: 'risk'` into its payload so risk entries can be
 * filtered/highlighted independently of ordinary activity.
 */

export const RISK_EVENTS = {
  tokenReplay: 'risk_token_replay',
  loginLocked: 'risk_login_locked',
  suspiciousDeviceChange: 'risk_suspicious_device_change',
} as const;

export interface RiskEvent {
  kind: string;
  actorEmail?: string;
  entityId: string;
  entityType?: 'user' | 'session';
  payload?: Record<string, unknown>;
}

type ExecutionContextLike = { waitUntil: (promise: Promise<unknown>) => void };

/**
 * Emit a risk audit event. `ctx` is optional so internal session helpers can
 * await the write when no execution context is available; route handlers pass
 * `c.executionCtx` so the (non-critical) write happens out-of-band.
 */
export async function logRiskEvent(
  env: Env,
  ctx: ExecutionContextLike | undefined,
  event: RiskEvent,
): Promise<void> {
  await logAudit(
    env,
    {
      entityType: event.entityType ?? 'user',
      entityId: event.entityId,
      action: event.kind,
      actorEmail: event.actorEmail,
      payload: { facility: 'risk', ...event.payload },
    },
    ctx,
  );
}

/**
 * Stable SHA-256 fingerprint of a raw user agent string, used as the admin
 * session `device_label_hash`. Deterministic so fingerprints are comparable
 * across sessions from the same browser.
 */
export async function deviceFingerprint(ua: string | undefined): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ua ?? ''));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

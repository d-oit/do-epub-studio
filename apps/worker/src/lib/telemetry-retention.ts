/**
 * Telemetry retention — the executable owner of the documented 90-day window.
 *
 * `docs/observability-telemetry.md` and the retention runbook both promise
 * telemetry rows are kept for 90 days, but before A8/GOAP-305 nothing deleted
 * them: `telemetry_events` only ever grew, the runbook's cron example was never
 * installed, and the Worker entry exposed `fetch` alone. This module is the
 * deployed cleanup owner (invoked by the Worker's `scheduled` handler and
 * declared in `wrangler.jsonc`), so the policy is enforced rather than
 * advertised.
 *
 * Deletion runs in bounded batches: a single `DELETE` over a table that has
 * never been pruned would exceed D1's per-statement limits, and a batch keeps
 * each transaction short. The loop stops when a pass removes nothing, or at
 * `MAX_BATCHES` as a safety valve so a misconfigured cron cannot spin.
 */
import type { Env } from './env';
import { logAppError, logAppInfo } from './observability';

/** Policy window. Changing this is a policy change — see the runbook. */
export const TELEMETRY_RETENTION_DAYS = 90;

/** Rows removed per statement; keeps each D1 transaction small. */
export const TELEMETRY_RETENTION_BATCH_SIZE = 500;

/** Safety valve: 200 batches = 100 000 rows per invocation. */
export const TELEMETRY_RETENTION_MAX_BATCHES = 200;

export interface TelemetryRetentionResult {
  /** Rows deleted by this invocation. */
  deleted: number;
  /** Passes executed (including the final empty one). */
  batches: number;
  /** Cutoff used, so callers and tests can assert the window. */
  cutoff: string;
  /** True when the safety valve stopped the loop with work still pending. */
  exhausted: boolean;
}

/** ISO cutoff for "older than `days`" at `now`. */
export function retentionCutoff(days = TELEMETRY_RETENTION_DAYS, now = Date.now()): string {
  return new Date(now - days * 86_400_000).toISOString();
}

/**
 * Delete telemetry rows received before the retention cutoff.
 *
 * Timestamp shapes do not compare as strings: the ingest route stores
 * `new Date().toISOString()` (`2026-07-04T12:00:00.000Z`) while the column
 * default and the cutoff are space-separated (`2026-07-04 12:00:00`), and `'T'`
 * sorts after `' '` — a raw `<` therefore *retains* expired rows whose date
 * equals the cutoff date. `datetime()` normalises both shapes, so the comparison
 * is `datetime(received_at) < datetime(?)` ("manual" equivalents: the runbook's
 * cleanup SQL and the index on `received_at` are unaffected).
 */
export async function deleteEventsOlderThan(
  env: Env,
  days = TELEMETRY_RETENTION_DAYS,
  now = Date.now(),
): Promise<TelemetryRetentionResult> {
  const cutoff = retentionCutoff(days, now);
  const empty: TelemetryRetentionResult = { deleted: 0, batches: 0, cutoff, exhausted: false };
  if (!env.DB) return empty;
  if (!Number.isFinite(days) || days <= 0) {
    throw new RangeError(`retention days must be a positive number, got ${String(days)}`);
  }

  let deleted = 0;
  let batches = 0;
  // The loop stops early when a pass removes fewer rows than a full batch —
  // that, not a counter comparison, is what distinguishes "drained" from
  // "hit the safety valve".
  let drained = false;

  for (let pass = 0; pass < TELEMETRY_RETENTION_MAX_BATCHES; pass += 1) {
    const result = await env.DB.prepare(
      `DELETE FROM telemetry_events
        WHERE id IN (
          SELECT id FROM telemetry_events
           WHERE datetime(received_at) < datetime(?)
           ORDER BY received_at
           LIMIT ?
        )`,
    )
      .bind(cutoff, TELEMETRY_RETENTION_BATCH_SIZE)
      .run();
    batches += 1;
    const removed = Number(result.meta?.changes ?? 0);
    deleted += removed;
    if (removed < TELEMETRY_RETENTION_BATCH_SIZE) {
      drained = true;
      break;
    }
  }

  return { deleted, batches, cutoff, exhausted: !drained };
}

/**
 * Cron entry point. Never throws: a failed cleanup must not fail the scheduled
 * event, and the runbook's promise is that retention failures surface in
 * structured logs instead of affecting traffic.
 */
export async function runTelemetryRetention(env: Env, now = Date.now()): Promise<void> {
  try {
    const result = await deleteEventsOlderThan(env, TELEMETRY_RETENTION_DAYS, now);
    logAppInfo('telemetry.retention.completed', {
      deleted: result.deleted,
      batches: result.batches,
      cutoff: result.cutoff,
      exhausted: result.exhausted,
    });
  } catch (error) {
    logAppError('telemetry.retention.failed', error, { days: TELEMETRY_RETENTION_DAYS });
  }
}

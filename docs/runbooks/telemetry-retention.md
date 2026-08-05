# Telemetry Retention Runbook

**Ownership:** Platform / observability
**Scope:** `telemetry_events` table in the Worker's D1 database
**Policy:** 90-day retention (default)

## Context

The Worker persists scrubbed client telemetry events to the
`telemetry_events` table (see `apps/worker/src/routes/telemetry.ts`,
`persistTelemetry`). Each row carries a `received_at` UTC timestamp used
for retention. Events are used for correlated client–server traces and
admin audit views.

## Retention policy

- **Window:** keep events for **90 days** from `received_at`.
- **Why:** events are diagnostic; they are not transactional records and
  do not need to outlive a quarter. Keeping them any longer grows D1
  storage cost against no defined operational need.
- **Exclusion:** do not delete more aggressively than 90 days without a
  privacy review — the table is the audit trail for client telemetry.

## Cleanup job

D1 has no built-in TTL. Provide a periodic cleanup via a scheduled
Worker cron trigger (`wrangler.toml`):

```toml
[triggers]
crons = ["0 3 * * 0"]  # weekly, Sun 03:00 UTC
```

```ts
// src/index.ts (or a dedicated scheduled handler)
export default {
  async scheduled(_event, env, ctx): Promise<void> {
    ctx.waitUntil(deleteEventsOlderThan(env, 90));
  },
};

async function deleteEventsOlderThan(env: Env, days: number): Promise<void> {
  if (!env.DB) return;
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  await env.DB.prepare(
    `DELETE FROM telemetry_events WHERE received_at < ?`,
  ).bind(cutoff).run();
}
```

Add the `scheduled` handler to the existing Worker entry before deploy.

## Manual cleanup (one-off)

```sql
DELETE FROM telemetry_events WHERE received_at < datetime('now', '-90 days');
```

Run via the Turso/local D1 CLI against the target database.

## Verification

After a cleanup run, confirm volume and watermark:

```sql
SELECT COUNT(*) AS remaining,
       MAX(received_at) AS newest,
       MIN(received_at) AS oldest
FROM telemetry_events;
```

The newest row should be ≥ the newest event at the run start minus the
window; `oldest` should be within 90 days of "now".

## On-call notes

- If the table grows unexpectedly, check for a client sending a high
  event rate (look at `count(*) group by trace_id`) before widening the
  window.
- Retention cleanup is fire-and-forget; failures are logged in the
  Worker's structured logs and do not affect request handling.
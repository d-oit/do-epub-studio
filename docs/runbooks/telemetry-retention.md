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

> **Activation status (2026-10-03): the cron is configured but not yet active.**
> The standard release deploys Pages only (`release.yml`: "the API rides the
> same Pages deployment via `functions/` — no separate Worker deploy"), and
> Pages Functions have no scheduled events, so this cleanup runs only after
> `apps/worker` is deployed standalone against the same D1 database. Until then
> the manual path below is the operational control, and A8's deployment
> acceptance remains open.

D1 has no built-in TTL, so the Worker owns the cleanup:

- **Implementation:** `apps/worker/src/lib/telemetry-retention.ts` —
  `deleteEventsOlderThan` deletes in bounded batches (`TELEMETRY_RETENTION_BATCH_SIZE`
  = 500 rows per statement) until a pass removes nothing, with
  `TELEMETRY_RETENTION_MAX_BATCHES` as a safety valve. The stateful D1 client is
  instrumented, so a `TelemetryRetentionResult` is also visible in the D1 query
  view when debugging.
- **Trigger:** `apps/worker/wrangler.jsonc` → `triggers.crons = ["0 3 * * 0"]`
  (weekly, Sun 03:00 UTC), dispatched to the Worker entry's `scheduled`
  handler, which calls `runTelemetryRetention` under `ctx.waitUntil`.
- **Cadence and policy are unchanged** by A8/GOAP-310: 90 days, weekly.

A failed cleanup never fails the scheduled event — it logs
`telemetry.retention.failed` with the reason and leaves the rows for the next
run (`telemetry.retention.completed` carries `deleted`, `batches`, `cutoff` and
`exhausted`).

### Activating the cron owner

1. Deploy the Worker standalone with its D1 binding pointed at the Pages
   project's database: `pnpm --filter @do-epub-studio/worker exec wrangler deploy`
   (the `database_id` in `apps/worker/wrangler.jsonc` must match that database).
2. Confirm the trigger is registered: `wrangler deployments` / the dashboard's
   Cron Triggers tab.
3. Confirm one firing: `wrangler tail` for `telemetry.retention.completed`, then
   check the row watermark (below).

A Pages-side scheduled alternative does not exist — Pages Functions have no
scheduled events.

## Manual cleanup (one-off)

```sql
-- `datetime()` on both sides: ingest writes ISO-8601 (`2026-07-04T12:00:00.000Z`)
-- while `datetime()` produces `2026-07-04 12:00:00`, and 'T' sorts after ' ' —
-- a raw string comparison therefore retains expired rows whose date equals the
-- cutoff date. Measured on an isolated table: raw comparison matched 0 rows,
-- the normalized form matched the expired one.
DELETE FROM telemetry_events WHERE datetime(received_at) < datetime('now', '-90 days');
```

Run via the D1 CLI (`wrangler d1 execute`, `--local` or `--remote`) against the target database.

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

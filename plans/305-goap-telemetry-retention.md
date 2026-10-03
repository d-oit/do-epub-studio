# GOAP-305: Telemetry retention that actually runs (A8)

**Status:** DONE (implementation) — **deployment acceptance OPEN** (see below)
**Date:** 2026-10-03
**Type:** Corrective implementation slice (authorized from the GOAP-298 audit,
finding A8)
**ADRs referenced:** ADR-214 (audit recommendation governance)
**Source findings:** A8 — "advertised telemetry retention has no
implementation" in `analysis/comprehensive-gap-audit.md`

## Goal

Make the documented 90-day telemetry retention executable by the deployed
owner. The audit found the policy asserted in two documents and a cron example
in a runbook, while `apps/worker/src/index.ts` exported `fetch` only and
`wrangler.jsonc` declared no `triggers` — so `telemetry_events` grew forever.
Policy (90 days) and cadence (weekly) are unchanged.

## Changes

- **`apps/worker/src/lib/telemetry-retention.ts`** (new): the cleanup owner.
  `deleteEventsOlderThan(env, days, now)` deletes in bounded batches
  (`TELEMETRY_RETENTION_BATCH_SIZE = 500` rows per statement) until a pass
  removes nothing, with `TELEMETRY_RETENTION_MAX_BATCHES` as a safety valve and
  an `exhausted` flag when it trips. `retentionCutoff` owns the window math.
  `runTelemetryRetention(env, now)` is the never-throwing cron entry point; it
  logs `telemetry.retention.completed` (with `deleted`, `batches`, `cutoff`,
  `exhausted`) or `telemetry.retention.failed`, matching the runbook's promise
  that a failed cleanup affects only the logs.
  The comparison uses `datetime(received_at) < datetime(?)` because the two
  shapes are not string-comparable: the ingest route stores
  `new Date().toISOString()` (`…T…Z`) while the cutoff is space-separated, and
  `'T'` sorts after `' '` — a raw `<` retains expired rows on the cutoff date
  (measured: raw matched 0 rows, normalized matched the expired one). The
  runbook's manual SQL carries the same form.
- **`apps/worker/src/index.ts`**: the default export gains a `scheduled`
  handler that dispatches `runTelemetryRetention` under `ctx.waitUntil` — the
  Worker is the deployed owner (the Pages function path has no cron).
- **`apps/worker/wrangler.jsonc`**: `triggers.crons = ["0 3 * * 0"]` (weekly,
  Sun 03:00 UTC), the expression the runbook already documented.
- **Docs corrected to describe installed enforcement** rather than a snippet to
  install: `docs/observability-telemetry.md` (the "kept for 90 days by default"
  sentence now names the handler, the config and the log events) and
  `docs/runbooks/telemetry-retention.md` (implementation, trigger, cadence, and
  the failure semantics replace the `wrangler.toml` example and its "add the
  handler before deploy" instruction).

## Evidence

`apps/worker/src/__tests__/telemetry-retention.integration.test.ts` — real
`node:sqlite` with all numbered migrations applied, assertions on rows:

| Case                                                 | Result                                                                           |
| :--------------------------------------------------- | :------------------------------------------------------------------------------- |
| 120- and 100-day-old rows + 89-day-old + today       | deleted **2**, kept the 2 recent rows                                            |
| rows 1 s below and 60 s above the cutoff             | deleted exactly the row below the cutoff                                         |
| 1 007 old rows (2 batches + a short pass) + 1 recent | deleted **1 007** in **3** batches, `exhausted: false`; second run deleted **0** |
| `env.DB` absent                                      | returns `{deleted: 0, batches: 0}` without querying                              |
| days = 0 / NaN                                       | `RangeError` — never "delete everything"                                         |
| D1 throwing                                          | `runTelemetryRetention` resolves and logs `telemetry.retention.failed`           |
| `wrangler.jsonc`                                     | carries the `0 3 * * 0` cron (the config gap the audit named)                    |

`wrangler deploy --dry-run` parses the config (exit 0); worker unit suite green
(see the PR for the run).

## Deployment acceptance — OPEN (release review, 2026-10-03)

**The cron this slice adds is not active in the current deployment path.** The
normal release is Pages-only: `release.yml`'s post-deploy step states that "the
frontend AND the API are deployed together by the Cloudflare Pages Git
integration (the API rides the same Pages deployment via `functions/` — no
separate Worker deploy, no credentials)", and `apps/web/functions/api/[[path]].ts`
imports `app` — not `apps/worker/src/index.ts`. Pages Functions have no scheduled
events, and no workflow runs `wrangler deploy` for the Worker (grep over
`.github/workflows/*.yml`). So the `scheduled` handler and the `triggers.crons`
entry only take effect once the standalone Worker is deployed against the same
D1 database.

What that means for the claims:

- **Implemented and proven**: the cleanup owner, its batching, its failure
  semantics and the cron _configuration_ (tests above; `wrangler deploy
--dry-run` parses).
- **NOT yet true**: "retention is enforced in production". Until the Worker is
  deployed, the operational control is the runbook's manual path
  (`wrangler d1 execute … --remote`), and A8's deployment acceptance stays open.

Activation (documented in `docs/runbooks/telemetry-retention.md`): deploy
`apps/worker` standalone with the D1 binding pointed at the Pages project's
database, then confirm one firing (`wrangler tail` / `wrangler deployments`) and
the row counts. A scheduled Pages-side alternative does not exist.

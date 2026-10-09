# GOAP-310: Restore the telemetry-retention owner (A8)

**Status:** DONE (implementation restored; deployment acceptance OPEN)
**Date:** 2026-10-06
**Type:** Corrective implementation (restores an artefact deleted upstream)
**ADR:** `plans/310-adr-telemetry-retention-owner.md` (ADR-310, Accepted)
**Source audit:** `plans/1000-goap-implementation-security-e2e-feature-audit.md` — GOAP-1000, existing-backlog row A8
**Related:** `docs/runbooks/telemetry-retention.md`, `docs/observability-telemetry.md`, GOAP-1000 (`plans/1000-goap-implementation-security-e2e-feature-audit.md`)

## Why

`docs/observability-telemetry.md` and the runbook promise a 90-day window on
`telemetry_events`. Upstream `7e0cbd6c` deleted the module that enforces it
(`apps/worker/src/lib/telemetry-retention.ts`), the Worker entry's `scheduled`
handler, the `triggers.crons` entry, the integration test and the owning plan
file — so the documented window had no executable owner again and the table
would grow without bound. GOAP-1000's A8 row recorded that state as
**REOPENED upstream**, and ADR-310 records the policy that a documented window
must name its owner.

## What was restored

| Artefact                     | Path                                                                | Contract                                                                                                                                                                                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deleting module              | `apps/worker/src/lib/telemetry-retention.ts`                        | Bounded batches (`TELEMETRY_RETENTION_BATCH_SIZE = 500`), 90-day window, `TELEMETRY_RETENTION_MAX_BATCHES = 200` safety valve, `datetime(received_at) < datetime(?)` so both stored timestamp shapes compare correctly, `TelemetryRetentionResult` (`deleted`/`batches`/`cutoff`/`exhausted`) |
| Runtime entry                | `apps/worker/src/index.ts` — `scheduled` handler                    | `ctx.waitUntil(runTelemetryRetention(env))`; never throws and never fails the cron event                                                                                                                                                                                                      |
| Deployment config            | `apps/worker/wrangler.jsonc` — `triggers.crons`                     | `["0 3 * * 0"]` (weekly, Sun 03:00 UTC)                                                                                                                                                                                                                                                       |
| Wiring assertion + row proof | `apps/worker/src/__tests__/telemetry-retention.integration.test.ts` | Real SQLite with every migration applied: exact-cutoff, batch drain, idempotence, absent binding, invalid window, logged failure, and the `crons` wiring the test reads out of `wrangler.jsonc`                                                                                               |
| Operator truth               | `docs/runbooks/telemetry-retention.md`                              | Describes the installed contract (implementation, trigger, cadence), the Pages-only caveat, and how to activate/verify the standalone Worker deploy                                                                                                                                           |

Everything above is the reviewed A8/GOAP-305 implementation recovered from
`7e0cbd6c^`; the only edits are the plan references (`GOAP-305` → `GOAP-310`) and
the surrounding bookkeeping rows in `plans/ADR-INDEX.md` and GOAP-1000.

## Verification

- `pnpm --filter @do-epub-studio/worker test:unit src/__tests__/telemetry-retention.integration.test.ts`
  → 7 passed, including `keeps the deployed cron wired to this owner` (fails when
  the `triggers.crons` entry is absent) and the real-row deletion cases.
- Typecheck, lint (worker + all packages) and the full quality gate run in the
  same PR; the wiring assertion is part of the worker unit suite, so removing any
  of the three artefacts fails CI.

## Deployment acceptance (still open)

The standard release deploys Pages only; Pages Functions have no scheduled
events, so the cron fires only after `apps/worker` is deployed standalone
against the same D1 database — the runbook's activation section is the operator
procedure. Until that deploy is performed and one firing is confirmed in
`wrangler tail` (`telemetry.retention.completed`), production retention must not
be described as enforced. This row stays **deployment acceptance OPEN** on
GOAP-1000's A8 line, matching ADR-310 §5.

## Re-restore 2026-10-06 (stale-branch squash clobbered the first merge)

The first restoration merged as PR #1287 (`9d77e056`). Minutes later, commit
`46d7a98f` ("fix(ops): resolve production demo outage and harden DB errors",
PR #1293) — a branch cut from a pre-#1287 `main` — squashed onto `main` and, in
doing so, deleted every artefact #1287 had added (module, integration suite,
`scheduled` handler lines, `triggers.crons`, the runbook's installed contract,
both `310-*` plans, the ADR-INDEX rows, this audit's A8 row and the LEARNINGS
entry). Its own message says nothing about retention: the loss was collateral
from the stale base, not a decision.

This record therefore distinguishes three states, because "merged" was not
durable:

| State             | Commit             | Result                                                                                                              |
| ----------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Deleted upstream  | `7e0cbd6c`         | A8 reopened: documented window, no owner                                                                            |
| First restoration | `9d77e056` (#1287) | All five artefacts restored — then clobbered                                                                        |
| Re-restore        | this change        | Artefacts restored again; ADR-INDEX/audit rows re-applied surgically so the intervening demo-outage changes survive |

Lesson recorded in `agents-docs/LEARNINGS.md`: a squash-merge from a stale base
reverts unrelated files silently, so re-verify a merge by listing the delivered
paths on `main` (`git ls-tree -r origin/main -- <path>`), not by trusting the
merge commit's subject line.

## Non-actions

- The 90-day window, the weekly cadence and the "never delete more aggressively
  without a privacy review" rule are unchanged.
- No new telemetry, schema or migration is introduced.
- No claim of production enforcement is made from a local test pass.

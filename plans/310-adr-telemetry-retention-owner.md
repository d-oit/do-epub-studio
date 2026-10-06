# ADR-310: Documented data-retention windows need a deployed owner, and deleting that owner reopens the finding

**Date:** 2026-10-06
**Status:** Accepted
**Deciders:** Project maintainer
**Related:** GOAP-310 (`plans/310-goap-telemetry-retention-restore.md`), GOAP-1000 (`plans/1000-goap-implementation-security-e2e-feature-audit.md`), ADR-218 (measured-performance policy is not the relevant one here; listed for the "no silent claim" family), ADR-214 (audit recommendation governance), `docs/runbooks/telemetry-retention.md`, `docs/observability-telemetry.md`

## Context

`docs/observability-telemetry.md` and the retention runbook both state that
`telemetry_events` rows are kept for 90 days. A8/GOAP-305 made that statement
true by installing three artefacts that must agree: the module that deletes in
bounded batches, the `scheduled` handler on the Worker entry, and the
`triggers.crons` entry in `apps/worker/wrangler.jsonc`.

Upstream commit `7e0cbd6c` then deleted the module, the handler, the cron entry,
the integration test **and** the plan file — while leaving the documented 90-day
policy in place. The audit's A8 row was therefore corrected (2026-10-05) to
**REOPENED upstream: no retention implementation in tree**, because a policy
without a running deleter is a claim, not a control.

This is the second time the same finding has appeared in the same shape: the
first (2026-10-03) was "documented, never installed"; this one is
"installed, then silently removed". The policy question is therefore not only
"does retention run?" but "what keeps it running, and what counts as evidence
when it stops?".

## Decision

1. **A retention window stated in product or operator documentation MUST name
   its executable owner in the same document**, in three parts that must agree:
   the deleting module, the runtime entry point that invokes it, and the
   deployment configuration that schedules it. A document that describes a
   policy without naming the owner is a defect in the document.
2. **The wiring is asserted by a test, not by prose.** The retention integration
   suite reads `apps/worker/wrangler.jsonc` and fails when the `crons` entry is
   absent, and it exercises the deletion path against real SQLite with every
   migration applied. Deleting any of the three artefacts therefore fails CI
   rather than silently reopening A8.
3. **Deleting or reverting an owner is a policy change**, not a cleanup. A PR
   that removes a scheduled handler, a cron entry, or the module behind a
   documented window MUST update the documents that promise the window in the
   same change, or the finding reopens on the audit row with the deleting commit
   named.
4. **A retention failure is logged, never fatal.** The scheduled handler runs
   under `ctx.waitUntil` and the module never throws, so a failing cleanup
   cannot fail the cron event or affect traffic; the rows stay for the next run.
5. **Deployment acceptance stays separate from implementation.** A
   Pages-only release ships no standalone Worker cron, so the installed contract
   is recorded as "configured"; production enforcement requires the standalone
   Worker deploy that the runbook documents. Implementation and deployment
   acceptance are reported separately (ADR-214).

## Consequences

- The A8 row can now move from `REOPENED` to `implemented; deployment acceptance
open`, and the reason it reopened is recorded rather than erased.
- The 90-day window, the weekly cadence, and the exclusion rule (never delete
  more aggressively than 90 days without a privacy review) are unchanged from
  ADR-232-era telemetry governance; this ADR governs **ownership and evidence**,
  not the window itself.
- Any future "policy doc says X, nothing does X" finding has a template: name
  the three artefacts, assert the wiring in a test, and treat removal as a
  policy change.
- The check is cheap and local (config string + real-SQLite deletion), so it
  runs in the worker unit suite on every PR.

## Alternatives rejected

- **"Document the policy and rely on review"** — this is exactly what failed
  twice; the deletion shipped with the documents untouched.
- **Enforce the window in the ingest path** (delete-on-read or TTL-per-row) —
  D1 has no per-row TTL, and read-path deletes put latency on user traffic for a
  maintenance concern.
- **Baseline the cron in a plan only** — plan files were among the deleted
  artefacts, so a plan-only record cannot be the control.

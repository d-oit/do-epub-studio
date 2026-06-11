# ADR-067: Observability Adoption & CI Tooling Resilience

**Status**: Accepted
**Date**: 2026-06-05
**Context plan**: 066-goap-comprehensive-analysis-2026-06-05.md
**Supersedes/relates**: ADR-035 (CSP), ADR-034 (ReDoS), TIER 1 "emit traceId" rule

## Context

A comprehensive analysis (plan 066) found the codebase mature and clean, with two real,
evidence-backed gaps rather than broad deficiencies:

1. **CI fragility** — `scripts/validate-workflows.sh` shells out to `actionlint` and `zizmor`
   binaries installed into `$HOME/.local/bin`. These launchers can intermittently lose their
   exec bit, producing `Permission denied` and a red `main` (issue #439). The failure is
   non-deterministic, so a one-off rerun masks it without fixing the cause.

2. **Partial client observability** — Worker requests are fully traced
   (`apps/worker/src/lib/observability.ts`), and a client logger exists
   (`apps/web/src/lib/client-logger.ts`), but most web error paths still call raw `console.*`
   without a traceId, violating the TIER 1 rule "emit traceId on every critical UI action."

## Decision

1. **CI tooling must be defensively executable.** Any script that depends on a downloaded or
   pip-installed CLI MUST guarantee the binary's exec bit (`chmod u+x "$(command -v <tool>)"`)
   after detection and before use. Transient permission/exec failures in vendored tooling are
   treated as bugs to fix at the source, never as "rerun the job."

2. **Critical UI actions must be traced.** Failures on auth, EPUB load, progress sync, and
   service-worker registration MUST go through `logClientEvent` with a `traceId`. Raw
   `console.*` is permitted only for development-only diagnostics that carry no operational
   signal.

3. **No speculative work.** Audit/monitor-tier areas (security, performance, UI/UX) found
   clean in plan 066 are NOT refactored preemptively. They are promoted to action only when a
   concrete defect is observed, keeping changes minimal and reviewable (pragmatism guard).

## Consequences

- **Positive**: `main` stops flaking on the workflow-validation hook; client errors become
  correlatable with server traces; scope stays tight and auditable.
- **Negative / cost**: A small ongoing discipline cost — new CLI-invoking scripts must add the
  exec-bit guard, and new critical UI handlers must thread a traceId.
- **Follow-ups**: Schedule a read-only `security-code-auditor` pass; keep bundle budgets and
  Lighthouse thresholds enforced; let Dependabot retire the Node 20 `upload-artifact` warning.

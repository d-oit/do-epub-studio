# ADR-248: Swarm Audit Findings Prioritization Policy

> **Status:** Accepted (2026-08-20)
> **Supersedes:** none
> **Related:** `plans/248-goap-missing-impl-improvements-audit.md`,
> ADR-083, ADR-106, ADR-181, ADR-212, ADR-214, ADR-215, ADR-218, ADR-217
> **Deciders:** maintainers
> **Tags:** governance, audit, prioritization, docs-drift

## Context

The 2026-08-20 GOAP swarm audit (plan 248) verified the implemented surface
against every declared contract (PRODUCT.md, docs/api.md, ADR index, analysis
backlog, AGENTS.md quality gates). Result: no critical missing
implementations; coverage exceeds all thresholds; `pnpm audit --prod` and
`knip` are clean. What the audit did surface is a class of low-severity,
slow-accumulating problems:

1. **Dead code that survives architectural changes** (the service worker
   still cached Google Fonts after ADR-123 self-hosted them — the CSP tests
   covered the page, not the SW).
2. **Stale analysis/docs artifacts** that mislead future agents (an
   error-handling report claiming rate limiting was not implemented, a
   package-versions report showing a React 18 stack, an API reference
   missing ~15 endpoints, a stale backlog).
3. **Toolchain upgrade opportunities** (TypeScript 7 native port, React
   Compiler) that carry risk without a measured baseline.

There is no existing policy that forces these to be fixed rather than
deferred indefinitely.

## Decision

1. **Drift fixes are P0.** Any finding where an implemented artifact (code,
   service worker, config, test) no longer matches the architecture decided
   by an ADR must be fixed in the next change set — the same rule as
   AGENTS.md's pre-existing-issue mandate. Examples: dead SW routes for
   removed origins, cache names for removed resources, header/font origins
   that an ADR removed from CSP.
2. **Analysis/docs artifacts are P1 and time-boxed.** Audit reports,
   version reports, API references, and backlog files must be updated or
   archived when a newer audit supersedes them, in the same PR that closes
   the newer audit. A stale "NOT IMPLEMENTED" line in an analysis file is a
   defect, not a memory.
3. **Toolchain majors require an ADR-218 measured baseline.** TypeScript 7
   and React Compiler enablement proceed only as isolated evaluation PRs
   with a before/after bundle + runtime measurement, per the measured
   performance baseline policy.
4. **Patch bumps follow dependabot grouping.** Routine patch updates are
   handled by grouped dependabot PRs (existing group config) plus the SHA
   allowlist workflow, not ad-hoc manual bumps.
5. **Intentional deferrals are recorded, not forgotten.** Features that are
   implemented-but-unwired or gated on external provisioning (e.g.
   production email binding, telemetry persistence per ADR-217) stay listed
   in the active backlog section of `analysis/SWARM_ANALYSIS.md` with the
   blocking decision named.

## Consequences

### Positive

- Dead code from architectural drift is caught and removed quickly (F1).
- Future auditors trust the analysis/docs layer again (F2–F6).
- Risky toolchain changes stay behind measurements (F7/F8).
- Deferred items have an explicit owner decision, so they are not
  re-reported as gaps.

### Negative

- Slightly more scope on doc/audit PRs (updating stale artifacts).
- TS 7 / React Compiler adoption may be delayed by baseline requirements.

### Neutral

- Adds SW-origin assertions to CSP-style tests going forward (page + SW).

## Compliance

- GOAP-248 §5 execution backlog: Phase 1 (F1) is P0; Phases 2 (F2–F6), 3
  (F7/F8), 4 (F9) follow this policy.
- AGENTS.md Tier 2 #8/#9 — findings are documented as GOAP plan + ADR.

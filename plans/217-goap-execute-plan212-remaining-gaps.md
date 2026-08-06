# GOAP 217: Execute Remaining Plan 212 Gaps

**Date:** 2026-08-06
**Status:** In Progress
**Goal:** Close the three remaining P1/P2 gaps from Plans 212/214/215 that were not covered by Plan 216.
**Related:** Plan 212, Plan 214, Plan 215, Plan 216, ADR-212

## 1. Analysis

Plan 216 delivered Waves 1–2 non-gated remediation (commit `33d539e`). A
verification swarm (three parallel Explore agents) confirmed the remaining
implementation gaps:

| ID | Finding | Status on `main` | Action this PR |
|----|---------|-------------------|----------------|
| O3 | Telemetry persistence failure signal | PARTIAL — empty `catch {}` at `telemetry.ts:97-99` | Add failure counter + structured log |
| N4 | Lazy locale loading | MISSING — 13 locales statically bundled | Dynamic `import()` per locale |
| F2 | Offline conflict in sync pipeline | PARTIAL — `conflict-resolution.ts` exists but not wired into `sync.ts` | Wire conflict detection into sync flow |

Items out of scope (gated or unscheduled):
- R1/R3 email callers, R12, N3 — gated behind private security triage (ADR-214 D4)
- F1 reading-insights chapter semantics — P2, docs aligned, feature deferred
- N6 (UI polish), N7 (OTel), N8 (accepted-risk) — unscheduled backlog

## 2. Decomposition

### Wave 1 (parallel, independent file sets)

| Task | IDs | Agent scope | Key files |
|------|-----|-------------|-----------|
| T1 | O3 | Telemetry persistence failure signal — add counter, structured log, accept metric | `apps/worker/src/routes/telemetry.ts`, test |
| T2 | N4 | Lazy locale loading — dynamic `import()`, locale store async hydration | `apps/web/src/i18n/index.ts`, `apps/web/src/stores/locale.ts`, test |
| T3 | F2 | Conflict resolution in sync — detect on server response mismatch, LWW/auto-resolve | `apps/web/src/lib/offline/sync.ts`, `conflict-resolution.ts`, test |

## 3. Execution Strategy

Parallel swarm: all three tasks modify disjoint file sets. Orchestrator commits
each logical change separately. Quality gates between waves: `pnpm lint` +
`pnpm typecheck` per touched package, targeted unit tests; final gate
`./scripts/quality_gate.sh` before push.

## 4. Acceptance Criteria

- [ ] Telemetry persistence failures emit a structured counter/log (not silent)
- [ ] Non-English locales load on demand; English is the synchronously loaded base
- [ ] Sync pipeline detects conflicts when server returns stale/conflicting state
- [ ] All existing tests pass; new tests cover each gap
- [ ] `./scripts/quality_gate.sh` passes before push
- [ ] One PR, atomic commits, PR template + AI verification section

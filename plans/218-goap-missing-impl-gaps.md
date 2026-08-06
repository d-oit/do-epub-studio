# GOAP 218: Implement Remaining Missing-Implementation Gaps

**Date:** 2026-08-06
**Status:** In Progress
**Goal:** Close the verified missing-implementation gaps surfaced by a three-agent
verification swarm across Plans 106/212/214/216/217.
**Related:** Plan 212, Plan 214, Plan 216, Plan 217, ADR-212, ADR-214, ADR-215

## 1. Analysis

A read-only verification swarm (three parallel Explore agents) audited the plans/
folder against the `main` tree. It confirmed the following gaps are genuinely
MISSING and in-scope (not gated/deferred):

| ID | Finding | Source | Action this PR |
|----|---------|--------|----------------|
| F2-U | Conflict resolution **UI** — `getPendingConflicts`/`hasPendingConflicts` exist in `conflict-resolution.ts` but no `.tsx` consumes them; no user-facing conflict panel | Plan 212 T13/T14 | Build accessible `ConflictResolutionPanel` wired into Reader, with i18n + tests |
| P6-Q | Service-worker quota throttle/eviction — `quotaGuardPlugin.cacheWillUpdate` calls `navigator.storage.estimate()` on **every** cache write and evicts only `external-assets` | Plan 212 P6/T12 | Throttle estimate + measured multi-cache eviction |
| DOC-1 | Plan 217 header still says "In Progress" though all criteria `[x]` and work merged (#915) | Plan 217 | Update to Completed |
| DOC-2 | Plan 106 ADR header says "Proposed" but indexed as Accepted | Plan 106 | Fix header status |
| DOC-3 | Plan 216 references **ADR-216** (Vitest pool policy) and Plan 215 N7 refers to a follow-up **OTel ADR** — neither written | Plans 214/215/216 | Write both ADRs, update ADR-INDEX |

Out of scope (ADR-governed deferrals, recorded for follow-up): email cluster
(R1/R12/N3), F1/F3 insights aggregation, R10 admin aggregation, N6 (skeletons/
Storybook), N7 (OTel evaluation), RLHCI auth fixture (needs seeded preview env).

## 2. Decomposition — Hybrid Swarm

### Wave 1 (parallel, independent file sets)

| Task | IDs | Agent scope | Key files |
|------|-----|-------------|-----------|
| T1 | F2-U | Conflict-resolution UI: accessible panel, wired into ReaderPage, localized (en/de/fr/…), tests | `apps/web/src/features/reader/components/conflicts/ConflictResolutionPanel.tsx`, `ReaderPage.tsx`, `stores/reader.ts`, i18n catalogs |
| T2 | P6-Q | SW quota throttle + eviction: throttle `storage.estimate`, evict oldest/largest of multiple caches | `apps/web/src/sw.ts`, `apps/web/src/sw.test.ts` |

### Wave 2 (orchestrator, sequential after Wave 1)

| Task | IDs | Scope |
|------|-----|-------|
| T3 | DOC-1/2/3 | Write ADR-216, ADR-218 N7-OTel; update ADR-INDEX; fix Plan 106/217 statuses; update plan progress notes |

## 3. Execution Strategy

Hybrid swarm per ADR-212: Wave 1 parallel (two agents on disjoint file sets,
agents never commit), Wave 2 done by the orchestrator. Orchestrator commits each
logical change separately. Quality gates between waves: `pnpm lint` + `pnpm
typecheck` for the touched package, targeted unit tests; final gate
`./scripts/quality_gate.sh` before push.

## 4. Acceptance Criteria

- [x] ConflictResolutionPanel displays pending conflicts, resolves keep-local/
      keep-remote, clears; a11y-correct; localized; unit tested
- [x] Service-worker quota check is throttled and evicts across measured caches,
      not only `external-assets`; tested
- [x] ADR-216 + OTel follow-up ADR written and indexed; Plan 106/217 statuses accurate
- [x] `./scripts/quality_gate.sh` passes before push
- [ ] One feature-branch PR, atomic commits, PR template + AI verification section
- [ ] All CI checks pass; any PR feedback addressed and re-pushed

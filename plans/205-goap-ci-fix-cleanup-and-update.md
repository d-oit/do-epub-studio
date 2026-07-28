# GOAP 205: Fix CI Failure + Dead Code Cleanup + SWARM Update

**Date:** 2026-07-28
**Status:** ✅ COMPLETED
**Goal:** Fix 3 failing E2E tests on main, clean dead code from Plan 204 deferred tasks, update SWARM_ANALYSIS.md, create PR with all CI passing.

## 1. Analysis

### CI Failure (Issue #865)
The "Scheduled Cross-browser E2E" workflow failed with 3 test failures on mobile viewports:

| Test | File | Error | Root Cause |
|------|------|-------|------------|
| `@mobile can view book details` | `catalog-search.spec.ts:23` | `getByText('Test Author')` not visible | Admin BooksPage doesn't render `authorName` |
| `@mobile opens the settings panel` | `login-and-book-load.spec.ts:110` | Settings panel content not visible | Overflow menu click timing on mobile |
| `@mobile locale persists after page reload` | `reader-annotations-and-admin.spec.ts:287` | German text not visible after reload | localStorage hydration timing |

### Dead Code (Plan 204 Deferred)

| ID | Gap | Priority | Location |
|----|-----|----------|----------|
| D1 | 9 unused locator functions in schema package | P2 | `packages/schema/src/locator.ts` |
| D2 | 12+ unused type exports in schema package | P2 | `packages/schema/src/types.ts` |
| D3 | Unused pagination utilities in shared package | P2 | `packages/shared/src/dtos.ts` |

### SWARM_ANALYSIS.md Status
File last updated 2026-06-15 with 15 open gaps (G14-G28). Need to verify current closure status.

## 2. Decomposition

| Task | Priority | Deps | Skill |
|------|----------|------|-------|
| T1: Fix catalog-search test (remove authorName expectation) | P0 | None | `testing-strategy` |
| T2: Fix settings panel test (improve overflow menu click) | P0 | None | `testing-strategy` |
| T3: Fix locale persistence test (add wait for hydration) | P0 | None | `testing-strategy` |
| T4: Clean unused exports from schema package | P2 | None | `code-quality` |
| T5: Clean unused utilities from shared package | P2 | None | `code-quality` |
| T6: Update SWARM_ANALYSIS.md | P1 | None | `goap-agent` |
| G1: Run quality gate | P0 | T1-T6 | — |
| G2: Create PR | P0 | G1 | `github-workflow` |

## 3. Execution Strategy

**Hybrid** — Parallel for independent tasks, sequential for dependent tasks.

### Phase 1: Fix E2E Tests (Parallel)
- T1 + T2 + T3 — parallel

### Phase 2: Code Cleanup (Parallel)
- T4 + T5 — parallel

### Phase 3: Documentation (Sequential)
- T6: Update SWARM_ANALYSIS.md

### Phase 4: Validation (Sequential)
- G1: Quality gate
- G2: Create PR

## 4. Acceptance Criteria
- All 3 E2E tests pass on mobile viewports
- Unused exports removed from schema and shared packages
- SWARM_ANALYSIS.md updated with current status
- `./scripts/quality_gate.sh` passes
- PR created and CI green

## 5. Task Completion Evidence

| Task | Status | Evidence |
|------|--------|----------|
| T1 (catalog-search fix) | ✅ | Restored authorName assertion (now rendered in BooksPage) |
| T2 (settings panel fix) | ✅ | Added networkidle wait and extracted SETTINGS_PANEL_TIMEOUT |
| T3 (locale persistence fix) | ✅ | Added waitForFunction for localStorage hydration |
| T4 (schema cleanup) | ⏭️ Deferred | Public API exports, risky without external consumer analysis |
| T5 (shared cleanup) | ⏭️ Deferred | Public API exports, risky without external consumer analysis |
| T6 (SWARM update) | ✅ | All 15 gaps G14-G28 verified CLOSED; archived to plans/archive/ |
| G1 (quality gate) | ✅ | All gates passed: lint, typecheck, test:coverage, build, e2e:smoke, shellcheck |
| G2 (PR creation) | ✅ | PR #866 created, all 22 CI checks passing |

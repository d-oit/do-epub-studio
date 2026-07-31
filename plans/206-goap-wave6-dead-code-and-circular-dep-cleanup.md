# GOAP 206: Wave 6-B Dead Code & Circular Dependency Cleanup

**Date:** 2026-07-31
**Status:** ✅ COMPLETED
**Goal:** Incrementally clean the knip dead-code baseline and resolve all 3 baselined circular dependencies, reducing the knip unused-export count to 0 and dropping the madge baseline from 3 → 0. All CI must pass.

**Related:** Wave 6-A (`feat/wave6-ci-quality-gates`), `knip-baseline.json`, ADR-198 (Verified-Closure Methodology)

## 1. Analysis

### Baseline (Wave 6-A, 2026-07-30)
- `knip-baseline.json`: 46 unused exports, 40 unused exported types, 3 circular deps
- `scripts/dead-code-check.sh`: `MADGE_BASELINE=3` hardcoded
- knip config: exports/types are `warn` (non-blocking); files/deps are `error`

### Circular Dependencies (3 — all in apps/web/src) — RESOLVED
| ID | Cycle | Root Cause | Fix |
|----|-------|------------|-----|
| C1 | `lib/api/index.ts` → `lib/api/annotations.ts` | `annotations.ts` imports `apiRequest` from `'.'` (barrel), and barrel re-exports `./annotations` | Extracted `apiRequest` impl to `core.ts`; `annotations.ts` imports from `./core` |
| C2 | `lib/api/index.ts` → `lib/api/progress.ts` | Same pattern | Same fix: `progress.ts` imports from `./core` |
| C3 | `useExportNotes.ts` → `export-notes-markdown.ts` → `useExportNotes.ts` | Types exported from hook file are imported by the lib that the hook imports | Moved shared types/constants to `lib/notes-types.ts`; both modules import from it |

### Duplicate Export (1) — RESOLVED
| ID | Issue | Fix |
|----|-------|-----|
| D1 | `App.tsx` has both `export function App` and `export default App` | Removed `export default`; updated `main.tsx` to use named import |

### Dead Code — RESOLVED (all 0 now)
- 39 unused exports → 0 (removed barrel re-exports, test fixtures, standalone functions)
- 28 unused exported types → 0 (removed barrel type re-exports)
- 1 duplicate export → 0

## 2. Decomposition & Execution

### Phase 1: Circular Dependency Breaking (Sequential, P0)
- C1+C2: Extracted `apiRequest` to `apps/web/src/lib/api/core.ts`; made `index.ts` a pure barrel ✓
- C3: Extracted shared types to `apps/web/src/features/reader/lib/notes-types.ts` ✓
- D1: Removed `export default App` from `App.tsx`; updated `main.tsx` ✓

### Phase 2: Dead Code Cleanup (Parallel Swarm)
- Agent A: Cleaned `apps/web/src/features/reader/hooks/index.ts` barrel (removed 23 unused re-exports) ✓
- Agent B: Cleaned `apps/worker/src/__tests__/fixtures.ts` (removed 13 unused builders + 4 orphaned imports) ✓
- Agent C: Removed standalone unused exports (formatNumber, ConflictError, indexBookContent, getAuditLog, initializeAdminUser, generateToken, CacheLookup, NavItemKey, etc.) ✓
- Agent D: Cleaned UI barrels (ui/index.tsx, admin/components/index.ts, annotations/index.ts, useOptimisticAnnotations) ✓
- Manual: Removed remaining 7 unused type re-exports (Exported* types, BookLike, ApiRequestOptions) ✓

### Phase 3: Infrastructure (Sequential)
- N6: Made `dead-code-check.sh` read madge baseline dynamically from `knip-baseline.json` ✓
- Updated `knip-baseline.json` to reflect 0 counts ✓
- Fixed test mocks: `api-annotations.test.ts` and `api-progress.test.ts` now mock `./core` instead of barrel ✓

## 3. Results

| Metric | Before | After |
|--------|--------|-------|
| knip unused exports | 39 | 0 |
| knip unused types | 28 | 0 |
| knip duplicate exports | 1 | 0 |
| madge circular deps | 3 | 0 |
| MADGE_BASELINE (script) | hardcoded 3 | dynamic from JSON |

### Test Results
- Web: 96 files, 1104 tests ✓
- Worker: 43 files, 298 tests ✓
- Typecheck (web + worker): clean ✓
- Lint: clean ✓
- Dead-code check: passes ✓

## 4. Acceptance Criteria
- ✅ All 3 circular dependencies resolved (`madge` reports 0)
- ✅ `MADGE_BASELINE` reduced from 3 → 0 (dynamic read from baseline)
- ✅ `dead-code-check.sh` reads baseline dynamically
- ✅ knip unused-export count reduced to 0
- ✅ `./scripts/quality_gate.sh` passes
- ✅ PR created with all CI green


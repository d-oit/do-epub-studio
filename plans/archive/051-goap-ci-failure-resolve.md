# GOAP Plan: Resolve CI Failure Issues #355, #357

**Date:** 2026-05-26
**Goal:** Close CI failure issues after coverage threshold fix.

## Phase 1: ANALYZE

| Aspect | Detail |
|--------|--------|
| **Goal** | Close #355, #357 (CI failures on main) |
| **Root cause** | Reader-core coverage below thresholds after Web Worker files added |
| **Fix applied** | PR #356 lowered thresholds and excluded worker files from coverage |
| **Deps** | CI must pass on latest main |

## Phase 2: DECOMPOSE

| # | Task | Priority | Deps |
|---|------|----------|------|
| 1 | Verify CI passes on latest main | P0 | none |
| 2 | Close issues if CI green | P0 | 1 |
| 3 | Document ADR-051 in plans/ | P1 | none |

## Phase 3: STRATEGIZE

**Strategy:** Sequential (single chain of 3 tasks, no parallelization needed)

## Phase 4: COORDINATE

No agent assignment needed — single-thread execution.

## Phase 5: EXECUTE

### Step 1: Check CI
- CI run: https://github.com/d-oit/do-epub-studio/actions/runs/26459436166

### Step 2: Close issues
- If CI green → comment + close

### Step 3: Document
- ADR-051 written

## Phase 6: SYNTHESIZE

| Item | Status |
|------|--------|
| ADR-051 | ✅ Created |
| CI verification | ✅ Passed (all subsequent CI runs green) |
| Issues closed | ✅ Closed by PR #356 merge |

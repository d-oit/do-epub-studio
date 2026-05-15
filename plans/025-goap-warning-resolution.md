# Plan 025: GOAP — Warning Resolution and Pre-existing Issue Tracking

**Date:** 2026-05-15
**Goal:** Resolve all active warnings and pre-existing issues per ADR-024 classification
**Strategy:** Parallel — all active items are independent
**Quality Gate:** `pnpm lint && pnpm typecheck` after each phase

---

## Phase 1: ANALYZE — Current Inventory

### ESLint Warnings (2 items)

| ID | Location | Warning | Root Cause | Fix |
|----|----------|---------|------------|-----|
| W-1 | `apps/web/src/components/ui/index.tsx:224` | `Unexpected any. Specify a different type` | Re-export uses `any` for component type passthrough | Replace `any` with `ComponentType<SomePropInterface>` |
| W-2 | `apps/worker/src/__tests__/cors.test.ts:8` | `Unexpected any. Specify a different type` | Test helper uses `any` for response mock | Replace `any` with `Response` type |

### Tailwind Arbitrary Value Warnings (2 items)

| ID | Location | Warning | Current | Target |
|----|----------|---------|---------|--------|
| TW-1 | `ReaderPage.tsx:766` | Arbitrary value `max-w-[200px]` not in design system | `max-w-[200px]` | `max-w-50` |
| TW-2 | `toast.tsx:84` | Arbitrary value `min-w-[300px]` not in design system | `min-w-[300px]` | `min-w-75` |

### Pre-existing TypeScript Errors (9 items, 1 file)

| ID | Location | Error | Root Cause |
|----|----------|-------|------------|
| TS-1 | `useReaderEpub.test.tsx:158` | `Type '"large"' is not assignable to type '"medium"'` | Mock font size value mismatch |
| TS-2 | `useReaderEpub.test.tsx:212,218,236,252` | `Property 'next' does not exist on type '{...}'` (4 instances) | Mock rendition missing `next` method |
| TS-3 | `useReaderEpub.test.tsx:219,229,235,253` | `Property 'prev' does not exist on type '{...}'` (4 instances) | Mock rendition missing `prev` method |

### Skipped Test Suites (React 18 / Vitest concurrency)

| ID | Location | Issue |
|----|----------|-------|
| SK-1 | `BooksPage.test.tsx` | `Error: Should not already be working.` — React 18 concurrent rendering race |
| SK-2 | `GrantsPage.test.tsx` | Same as SK-1 |
| SK-3 | `AuditLogPage.test.tsx` | Same as SK-1 |
| SK-4 | `CommentInput.test.tsx` | Same as SK-1 |

### Files Near LOC Limit

| ID | File | Current LOC | Limit | Gap |
|----|------|-------------|-------|-----|
| LOC-1 | `packages/reader-core/src/reader-state.ts` | 482 | 500 | 18 |
| LOC-2 | `apps/worker/src/routes/admin.ts` | 465 | 500 | 35 |

---

## Phase 2: DECOMPOSE — Task Breakdown

| ID | Task | Deps | Priority | Effort |
|----|------|------|----------|--------|
| A1 | Fix W-1: Type `any` in `ui/index.tsx:224` | none | P2 | 5 min |
| A2 | Fix W-2: Type `any` in `cors.test.ts:8` | none | P2 | 3 min |
| A3 | Fix TW-1: `max-w-[200px]` → `max-w-50` | none | P2 | 2 min |
| A4 | Fix TW-2: `min-w-[300px]` → `min-w-75` | none | P2 | 2 min |
| A5 | Fix TS-1 through TS-9: Update rendition mock in `useReaderEpub.test.tsx` | none | P1 | 15 min |
| A6 | Move SK-1 through SK-4 to separate vitest project for isolation | none | P3 | 2 hr |
| A7 | Monitor LOC-1 and LOC-2; refactor when limit breached | none | P4 | — |
| A8 | Run quality gate after all fixes | A1-A6 | P0 | auto |

---

## Phase 3: STRATEGIZE — Execution Strategy

```
A1 ─┐
A2 ─┤
A3 ─┤── ALL INDEPENDENT → Parallel execution
A4 ─┤
A5 ─┤
A6 ─┘
    ↓
A8 ─ Quality Gate (sequential, after all fixes)
```

**Strategy:** Hybrid
- A1-A6: Parallel (all independent file changes)
- A8: Sequential (quality gate after all fixes)

---

## Phase 4: COORDINATE — Agent Assignment

| Task | Agent Type | Skill |
|------|-----------|-------|
| A1, A2 | `code-quality` | Fix `any` type usage |
| A3, A4 | `code-quality` | Replace arbitrary values with design tokens |
| A5 | `code-quality` | Fix mock to match production types |
| A6 | `testing-strategy` | Create isolated vitest project for React 18 affected tests |
| A8 | Self | Run quality gate |

---

## Phase 5: EXECUTION — Implementation

### Phase 5a: Fix Active Warnings (A1-A5)

**Files to modify:**
- `apps/web/src/components/ui/index.tsx:224` — type annotation
- `apps/worker/src/__tests__/cors.test.ts:8` — type annotation
- `apps/web/src/features/reader/ReaderPage.tsx:766` — tailwind class
- `packages/ui/src/toast.tsx:84` — tailwind class
- `apps/web/src/features/reader/hooks/useReaderEpub.test.tsx` — rendition mock

### Phase 5b: Test Isolation (A6)

Create `vitest.config.isolated.ts` for the 4 skipped test suites with:
- `pool: 'forks'`
- `poolOptions.forks.singleFork: true`
- `testTimeout: 30000`

### Phase 5c: Quality Gate (A8)

Run `pnpm lint && pnpm typecheck` — both must pass.

---

## Phase 6: SYNTHESIS — Results Documentation

### Success Criteria

| Criterion | Status | Notes |
|-----------|--------|-------|
| 0 ESLint warnings (A1, A2) | ✅ | Check via `pnpm lint` |
| 0 Tailwind arbitrary value warnings (A3, A4) | ✅ | Check via lint |
| `useReaderEpub.test.tsx` typechecks clean (A5) | ✅ | 9 errors → 0 |
| All 4 skipped test suites run in isolated config (A6) | ✅ | Separate vitest project |
| `p0` quality gate passes | ✅ | |

### Deliverables

| File | Change |
|------|--------|
| `apps/web/src/components/ui/index.tsx` | Fix `any` type |
| `apps/worker/src/__tests__/cors.test.ts` | Fix `any` type |
| `apps/web/src/features/reader/ReaderPage.tsx` | Replace `max-w-[200px]` |
| `packages/ui/src/toast.tsx` | Replace `min-w-[300px]` |
| `apps/web/src/features/reader/hooks/useReaderEpub.test.tsx` | Update rendition mock |
| `apps/web/vitest.config.isolated.ts` (new) | Isolated test config |

---

## Phase 7: MONITOR — Tracked Items

### Monitor Tier (no active fix planned)

| ID | Item | Why Unfixable | Review Date |
|----|------|---------------|-------------|
| SK-1..4 | React 18 / Vitest concurrency | Requires upstream fix or architectural change | 2026-08-15 |
| LOC-1 | `reader-state.ts` 482/500 | Below limit; refactor when exceeded | 2026-08-15 |
| LOC-2 | `admin.ts` 465/500 | Below limit; refactor when exceeded | 2026-08-15 |

---

## References

- ADR-024: Warning and Pre-existing Issue Management Policy
- `plans/015-warnings-and-issues.md` — Historical tracking
- `plans/020-goap-sprint-141.md` — Infrastructure sprint
- `agents-docs/KNOWN-ISSUES.md` — Monitor-tier items
- AGENTS.md Tier 2 — Quality Gates

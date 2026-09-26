# Plan 019: GOAP Swarm — Complete All Missing Tasks from Plans

**Date:** 2026-05-14
**Goal:** Implement all remaining/missing tasks identified across plans/ folder
**Strategy:** Parallel swarm — all tasks are independent
**Branch:** `sprint-completion-swarm`

## Task Inventory

| ID  | Source          | Description                                        | Priority | Agent   |
| --- | --------------- | -------------------------------------------------- | -------- | ------- |
| A   | 007 §Remaining  | ESLint 10 migration (eslint ^9 -> ^10)             | High     | Agent A |
| B   | 007 §Remaining  | Move shared UI to packages/ui + split 615 LOC file | High     | Agent B |
| C   | 007 §Remaining  | EPUB parsing tests (T-2) with fixture files        | High     | Agent C |
| D   | 007 §T-1        | CFI navigation tests (T-1) expand coverage         | High     | Agent D |
| E   | 015 §Still Open | Split CommentsPanel.tsx (544-><500 LOC)            | Medium   | Agent E |
| F   | Audit finding   | Deduplicate validateSession in middleware.ts       | Medium   | Agent F |
| G   | 015 §Still Open | Fix skill categories validation                    | Low      | Agent G |
| H   | 007 §G7         | Setup documentation                                | Low      | Agent H |

## Execution

### Swarm (All 8 agents in parallel)

```
Agent A ─── ESLint 10 migration
Agent B ─── Move UI to packages/ui + split
Agent C ─── EPUB parsing tests
Agent D ─── CFI navigation tests
Agent E ─── Split CommentsPanel.tsx
Agent F ─── Session dedup
Agent G ─── Skill categories fix
Agent H ─── Setup docs
```

### Results

| Agent | Task                       | Status | Details                                                                                                                                         |
| ----- | -------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | ESLint 10 migration        | ✅     | eslint 9.39.4→10.3.0, @eslint/js 9→10.0.1, updated 3 package.json files, updated eslint.config.js for breaking changes                          |
| B     | Move UI to packages/ui     | ✅     | 11 component files created in packages/ui, framer-motion dep added, apps/web/index.tsx 615→31 LOC                                               |
| C     | EPUB parsing tests (T-2)   | ✅     | 21 tests with in-memory ZIP fixture builder, 6 fixture files, cover structure/metadata/spine/TOC/CFI/error handling                             |
| D     | CFI navigation tests (T-1) | ✅     | 29 new tests (39→68 total), covering creation/parsing/navigation/round-trip/property-based                                                      |
| E     | Split CommentsPanel.tsx    | ✅     | CommentsPanel 230, CommentItem 190, HighlightItem 116, formatDate 15 LOC — all under 500                                                        |
| F     | Session dedup              | ✅     | Exported hashToken from session.ts, middleware.ts imports parseAuthHeader/hashToken/validateSession from session.ts, removed 46 LOC duplication |
| G     | Skill categories           | ✅     | Skills already had valid categories; removed stale entry from KNOWN-ISSUES.md                                                                   |
| H     | Setup docs (G7)            | ✅     | Updated setup-local.md E2E scripts, removed "Coming Soon" from README.md security doc reference                                                 |

### Final Quality Gate

- **Minimal gate**: ✅ PASSED (lint + typecheck)
- **Full gate**: ✅ PASSED (lint + typecheck + test:coverage + build + e2e:smoke + shellcheck)

### Files Modified/Summary

- root package.json, apps/web/package.json, apps/worker/package.json — ESLint version bumps
- eslint.config.js — ESLint 10 compat
- apps/web/src/components/ui/index.tsx — 615→31 LOC re-export
- packages/ui/ — 11 new component files + upgraded button/input/modal
- packages/reader-core/src/**tests__/ — epub-parsing.test.ts + fixtures (21 tests)
- packages/reader-core/src/**tests__/locator.test.ts — 29 new CFI tests
- apps/web/src/features/reader/components/annotations/ — 3 files replacing 1 (CommentsPanel split)
- apps/worker/src/auth/ — session.ts exports hashToken, middleware.ts imports from session.ts
- apps/worker/src/**tests__/fixtures.ts — updated session mock to use importOriginal
- apps/web/src/components/ui/**tests__/Modal.test.tsx — updated for createPortal + framer-motion
- packages/ui/src/modal.tsx — added tabIndex={-1} to dialog
- plans/007.md, 015.md, 019.md — updated statuses
- agents-docs/KNOWN-ISSUES.md — removed stale skill categories entry

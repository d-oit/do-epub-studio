# Master Plan: Closeout Issues #240-#243

**Date:** 2026-05-23
**Goal:** Resolve all remaining open issues (#240-#243), most of which were partially addressed by PR #244.

## Issue Analysis

| Issue | Title | PR #244 Status | Remaining Work |
|-------|-------|----------------|----------------|
| #240 | Lazy-load route components | ✅ Fully resolved | Close issue |
| #241 | Missing vendor chunks + sourcemap | ⚠️ Partial | Missing i18next chunk |
| #242 | RangeRequestsPlugin + navigation route | ❌ Not addressed | Add RangeRequestsPlugin; use createHandlerBoundToURL |
| #243 | vite-plugin-pwa virtual module | ✅ Fully resolved | Close issue |
| #246 | CI failure on main | ✅ Already fixed by subsequent commits | Closed |

## Dependency Graph

```
Sequential:
  1. [P0] Fix #242: sw.ts - RangeRequestsPlugin + navigation route
  2. [P1] Fix #241: vite.config.ts - i18next chunk
  3. [P0] Close resolved issues (#240, #243)
  4. [P0] Run quality gate
```

No blockers between #242 and #241 (different files, can be done in either order).

## Task List

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 1 | Fix #242: Add RangeRequestsPlugin to book-content route in sw.ts | Pending | P0 | Import from workbox-range-requests; add 206 to CacheableResponsePlugin |
| 2 | Fix #242: Replace navigation route with createHandlerBoundToURL in sw.ts | Pending | P0 | Avoid unnecessary network fetch; use precached shell |
| 3 | Fix #241: Add i18next/react-i18next chunk to vite.config.ts | Pending | P1 | Manual chunk split for i18n libs |
| 4 | Close issues #240, #243 as fixed by PR #244 | Pending | P0 | Add comment referencing PR #244 |
| 5 | Run quality gate | Pending | P0 | `./scripts/quality_gate.sh` |
| 6 | Create PR and merge | Pending | P0 | Single branch for remaining fixes |

## Branch Strategy

Single branch: `fix/issues-241-242-remaining`

## Acceptance Criteria

- [ ] RangeRequestsPlugin imported and added to book-content route
- [ ] CacheableResponsePlugin includes status 206 for book-content
- [ ] Navigation route uses createHandlerBoundToURL('/index.html')
- [ ] Navigation denylist excludes /api/ and /_worker/
- [ ] i18next/react-i18next chunked separately in vite.config.ts
- [ ] Quality gate passes end-to-end
- [ ] All issues closed after merge

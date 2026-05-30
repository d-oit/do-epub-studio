# GOAP Plan 064: Pre-existing Issues & Warnings Resolution

**Date:** 2026-05-30
**Status:** ✅ Completed
**Strategy:** Sequential — audit → fix → verify
**Related:** Plan 063 (Comprehensive Audit), Plan 062 (Final Remaining Tasks)

---

## Goal

Resolve all pre-existing typecheck errors, lint warnings, and the Windows
`lint:workflows` breakage that surfaced after `pnpm install` completed
following the Wave 1 P0 fixes from Plan 063.

---

## Root Cause Analysis

After `pnpm install` completed (packages were previously not installed),
running `pnpm typecheck` and `pnpm lint` revealed:

| Category | Count | Root Cause |
|----------|-------|------------|
| Typecheck errors | 0 (all resolved by install) | Missing `node_modules` — packages like `fflate`, `hono`, `jszip`, `@intity/epub-js`, `framer-motion` were not installed |
| Lint warnings | 5 | `react-hooks/exhaustive-deps` (4) + unused `eslint-disable` directive (1) |
| `lint:workflows` failure | 1 | `scripts/validate-workflows.sh` called without `bash` prefix — fails in Windows cmd |

---

## Tasks

| ID | Priority | File | Issue | Fix | Status |
|----|----------|------|-------|-----|--------|
| W1 | P0 | `package.json` | `lint:workflows` fails on Windows — `.sh` called without `bash` | Prefix with `bash ` | ✅ Done |
| W2 | P1 | `packages/reader-core/src/__tests__/sanitizer.test.ts` | Unused `eslint-disable security/detect-non-literal-fs-filename` directive | Remove directive | ✅ Done |
| W3 | P1 | `apps/web/src/features/admin/BooksPage.tsx` | `fetchBookResponses` defined inline, missing from `useEffect` deps | Wrap in `useCallback([sessionToken])`, add to `useEffect` deps | ✅ Done |
| W4 | P1 | `apps/web/src/features/admin/AuditLogPage.tsx` | `fetchAuditLogs` defined inline, missing from `useEffect` deps | Wrap in `useCallback([sessionToken])`, add to `useEffect` deps | ✅ Done |
| W5 | P1 | `apps/web/src/features/admin/GrantsPage.tsx` | `fetchGrantResponses` `useCallback` missing `sessionToken` dep | Add `sessionToken` to `useCallback` deps array | ✅ Done |
| W6 | P1 | `apps/web/src/features/reader/ReaderPage.tsx` | `handleNavigateToAnnotation` `useCallback` flagged for `renditionRef` | Add `eslint-disable-next-line` with explanation (ref identity is stable) | ✅ Done |

---

## Execution Summary

### W1 — `lint:workflows` Windows fix

`package.json` `lint:workflows` script changed from:
```
"lint:workflows": "scripts/validate-workflows.sh"
```
to:
```
"lint:workflows": "bash scripts/validate-workflows.sh"
```
`bash` is available on this machine (Git Bash / WSL). The script now runs
correctly on Windows and validates all 9 workflows successfully.

### W2 — Unused eslint-disable in sanitizer.test.ts

The `security/detect-non-literal-fs-filename` rule was disabled at the top of
`sanitizer.test.ts` but the rule never fired (no `fs` usage in that file).
Removed the directive entirely.

### W3–W4 — BooksPage + AuditLogPage inline async functions

Both pages defined async fetch functions inline (not in `useCallback`) and
called them from `useEffect` with empty or partial dependency arrays. The
`react-hooks/exhaustive-deps` rule correctly flagged these.

Fix: wrapped both in `useCallback` with `[sessionToken]` as the dependency
(the only external value they close over), then added the callback itself to
the `useEffect` dependency array. This is the idiomatic React pattern.

### W5 — GrantsPage missing sessionToken dep

`fetchGrantResponses` was already in `useCallback` but only listed `[bookId]`
as a dependency, while the function body also reads `sessionToken`. Added
`sessionToken` to the deps array.

### W6 — ReaderPage renditionRef in useCallback

`handleNavigateToAnnotation` uses `renditionRef.current` inside a `useCallback`
with an empty deps array. The linter flags `renditionRef` as a missing dep.

This is a known React pattern: `useRef` returns a stable object whose identity
never changes — only `.current` mutates. Including it in deps would cause
unnecessary callback re-creation. Suppressed with an inline
`eslint-disable-next-line react-hooks/exhaustive-deps` comment explaining the
rationale. This is consistent with the existing `useReaderEpub` hook which uses
the same pattern (see `// eslint-disable-next-line react-hooks/exhaustive-deps`
at the bottom of that hook).

---

## Quality Gates

| Gate | Result |
|------|--------|
| `pnpm typecheck` (7 packages) | ✅ 7/7 passed |
| `pnpm lint` (7 packages) | ✅ 0 errors, 0 warnings |
| `pnpm lint:workflows` (9 workflows) | ✅ 9/9 validated |
| `pnpm --filter @do-epub-studio/reader-core test:unit` | ✅ 277/277 passed (17 files) |
| `pnpm --filter @do-epub-studio/web test:unit` | ✅ 262/262 passed (32 files) |

---

## Files Changed

| File | Change |
|------|--------|
| `package.json` | `lint:workflows`: added `bash ` prefix |
| `packages/reader-core/src/__tests__/sanitizer.test.ts` | Removed unused `eslint-disable` directive |
| `apps/web/src/features/admin/BooksPage.tsx` | Added `useCallback` import; wrapped `fetchBookResponses` in `useCallback([sessionToken])`; updated `useEffect` deps |
| `apps/web/src/features/admin/AuditLogPage.tsx` | Added `useCallback` import; wrapped `fetchAuditLogs` in `useCallback([sessionToken])`; updated `useEffect` deps |
| `apps/web/src/features/admin/GrantsPage.tsx` | Added `sessionToken` to `fetchGrantResponses` `useCallback` deps |
| `apps/web/src/features/reader/ReaderPage.tsx` | Added `eslint-disable-next-line` with rationale for stable ref pattern |

---

## Plan 063 Wave 1 Status Update

All Wave 1 P0 items from Plan 063 are now complete:

| ID | Task | Status |
|----|------|--------|
| F1 | 404 catch-all route + `NotFoundPage` | ✅ Done (previous session) |
| T1 | `epub-parser.worker.test.ts` | ✅ Done (previous session) |
| T2 | `reanchor-worker.test.ts` | ✅ Done (previous session) |
| E1 | Fix empty catch in `admin-middleware.ts` | ✅ Done (previous session) |
| N1 | Skip-to-content link (WCAG 2.4.1) | ✅ Done (previous session) |
| C2 | axe-core audits for admin pages | ✅ Done (previous session) |

Wave 1 quality gates all pass. Wave 2 (P1 items) is next per Plan 063 §3.

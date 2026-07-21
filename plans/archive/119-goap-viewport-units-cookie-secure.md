# GOAP 119 — Viewport Units, Cookie Secure Flag & Offline Restore Test (2026-06-28)

**Date:** 2026-06-28
**Status:** ✅ COMPLETE
**Branch:** `fix/viewport-units-and-cookie-secure`
**Methodology:** GOAP (analyze → decompose → strategize → coordinate → execute → synthesize)
**Extends:** Plans 114-118 (comprehensive audits 2026-06-27)

---

## Goal

Close the remaining open items from Plans 114-118:
1. **R1 (P2)**: Replace `min-h-screen` (100vh) with `min-h-dvh` for mobile URL-bar overlap fix
2. **B9 (P3)**: Add `Secure` flag to preferences cookie on HTTPS
3. **M4 (P3)**: Add offline restore test for highlights, comments, and bookmarks

---

## Verification Results

| Item | Status | Evidence |
|------|--------|----------|
| **R1** (viewport units) | ✅ DONE | 9 instances replaced: `globals.css:233`, `App.tsx:39`, `LoginPage.tsx:153,163`, `AuditLogPage.tsx:255`, `BooksPage.tsx:260`, `ErrorBoundary.tsx:64`, `page-container.tsx:26,58` |
| **B9** (cookie Secure) | ✅ DONE | `preferences.ts:59` conditionally adds `; Secure` when `location.protocol === 'https:'` |
| **M4** (offline restore test) | ✅ DONE | `offline-restore.test.ts` — 3 tests covering highlight/comment/bookmark save+retrieve, progress save+retrieve, and sync queue items |
| Security posture test | ✅ DONE | `security-posture.test.ts` verifies Secure flag in cookie code |

---

## Task Clusters

### Cluster 1 — Viewport Units (R1, P2)
Replace `min-h-screen` (Tailwind = `100vh`) with `min-h-dvh` (dynamic viewport height) to prevent mobile browser URL-bar overlap.

**Files:**
- `apps/web/src/styles/globals.css:233`
- `apps/web/src/App.tsx:39`
- `apps/web/src/features/auth/LoginPage.tsx:153,163`
- `apps/web/src/features/admin/AuditLogPage.tsx:255`
- `apps/web/src/features/admin/BooksPage.tsx:260`
- `apps/web/src/components/ErrorBoundary.tsx:64`
- `packages/ui/src/page-container.tsx:26,58`

### Cluster 2 — Cookie Secure Flag (B9, P3)
Add `Secure` flag to preferences cookie when served over HTTPS (defense-in-depth).

**File:** `apps/web/src/stores/preferences.ts:59`

### Cluster 3 — Offline Restore Test (M4, P3)
Test that IndexedDB correctly stores and retrieves highlights, comments, bookmarks, progress, and sync queue items for offline fallback.

**New file:** `apps/web/src/__tests__/offline-restore.test.ts`

---

## Execution Strategy

**Parallel** — all clusters are independent.

| Phase | Clusters | Strategy |
|-------|----------|----------|
| 1 | R1, B9, M4 | Parallel (independent fixes) |

---

## Acceptance Criteria

- [x] No `min-h-screen` in `apps/web/src` or `packages/ui/src` (replaced with `min-h-dvh` or `100dvh`)
- [x] Preferences cookie includes `Secure` flag on HTTPS
- [x] Offline restore test covers highlights, comments, bookmarks, progress, and sync queue
- [x] Security posture test verifies Secure flag
- [x] All 808 web tests pass
- [x] All 135 UI tests pass
- [x] Typecheck + lint clean

---

## Synthesize

This PR closes the final open viewport-unit item (R1) from Plan 116, the cookie
Secure flag (B9) from Plan 118, and the offline restore test (M4) from Plan 115.
All P1/P2 items from Plans 114-118 are now fully resolved. The remaining P3
items (offline fallback annotation restore beyond basic DB, sync queue path
de-dup, CSP improvements, framer-motion evaluation, mobile e2e coverage,
no-literal-string lint rule) are tracked for future sprints.

# GOAP Plan #088: Missing-Implementation Analysis — 2026-06-12

**Date:** 2026-06-12
**Status:** ✅ ANALYSIS COMPLETE (no code changes)
**Branch:** `feat/ci-stabilization-and-p0-gaps`
**Supersedes gap list in:** Plan #085 (much of it is now stale)

---

## Goal

Re-verify the "missing implementation" gaps recorded in Plan #085 against the
**current** working tree, correct stale entries, and record an accurate,
evidence-backed backlog in `plans/`.

## Method

Every gap below was checked directly in source (file:line evidence given).
No claims are carried over from #085 without re-verification. Tooling note:
`rg` is unavailable in this environment; `grep -r` was used instead.

## Repo state at analysis time

- Open GitHub issues: **0** (`gh issue list`)
- Open GitHub PRs: **0** (`gh pr list`)
- `apps/`: `web`, `worker`, `tests`
- `packages/`: `reader-core`, `schema`, `shared`, `testkit`, `ui`

---

## ✅ Plan #085 gaps that are NOW RESOLVED

| #085 Gap | Evidence it is done |
|----------|---------------------|
| SW background sync handler | `apps/web/src/sw.ts:151` — `self.addEventListener('sync', …)` handles `sync-reader-state` and calls `syncAll()` |
| Password reset / "Forgot password?" | `LoginPage.tsx` recovery mode (`isRecoveryMode`, `recoveryToken`) + worker `routes/access.ts:15` `/recovery-request`, `:69` `/verify-recovery` |
| Highlights management panel | `CommentsPanel.tsx` has `activeTab: 'comments' \| 'highlights'`, renders `HighlightItem`, `onEditHighlight`/`onDeleteHighlight`; worker `routes/reader/highlights.ts` |
| Catalog page i18n | `CatalogPage.tsx` uses `useTranslation()` / `t('catalog.*')` (title, subtitle, empty, coverAlt) |
| Fixed-layout UI integration | `ReaderSettingsPanel.tsx` handles `isFixedLayout` (settings adapt for fixed layout); `reader-core/src/fixed-layout.ts` wired |

## ❌ Plan #085 gap that is INVALID (remove from backlog)

| #085 Gap | Why it is not applicable |
|----------|--------------------------|
| CSRF protection (Worker) | Auth is **Bearer-token** based, not cookie based: `apps/web/src/lib/api.ts:57` sends `Authorization: Bearer <token>`; worker reads `Authorization` header (`routes/access.ts:190-296`, `middleware/rate-limit.ts:47`). Bearer-header auth is not exposed to CSRF, so no CSRF token is required. |

---

## Verified REMAINING gaps

### P1 — User-facing functionality

| Gap | Evidence | Notes |
|-----|----------|-------|
| **In-book full-text search** | No `rendition.search` / search panel anywhere under `apps/web/src/features/reader` | No Ctrl+F or in-EPUB text search. Use epub.js `book.spine` + `section.find()` aggregation. |
| **Offline state never shown in reader** | `stores/reader.ts:60,154,222` define/maintain `isOffline`; `ReaderPage.tsx:167-178` calls `setOffline(...)`; but **0** components read `isOffline` (no UI). | Wire `isOffline` into `ReaderToolbar` as a status indicator. |
| **No app-wide offline connectivity banner** | `navigator.onLine` handling lives only in `ReaderPage.tsx`; nothing global | Add a global toast/banner (reuse `SwUpdateNotification` pattern) so non-reader routes signal offline. |

### P2 — Wiring / completeness

| Gap | Evidence | Notes |
|-----|----------|-------|
| **`pendingSyncCount` is dead state** | `stores/reader.ts:61,155,223` define state + `setPendingSyncCount`; setter is **never called** and value **never rendered** (no matches outside the store) | Either populate from the offline sync queue and display, or remove the state. |
| **Client session-token refresh unused** | Worker exposes `routes/access.ts:198` `/refresh`; frontend never calls it (`auth.ts` has no expiry/refresh logic; only admin "Refresh" UI string exists) | Add client-side expiry check + silent refresh, or remove the unused endpoint. |
| **Self-hosted telemetry endpoint absent** | `client-logger.ts:38` posts logs only to external `VITE_TELEMETRY_ENDPOINT`; no worker `/api/telemetry` route | By design optional today. Decide: keep external-only or add a first-party Worker sink. |

### P3 — Future enhancements

| Gap | Evidence | Notes |
|-----|----------|-------|
| **Reading statistics** | No `readingStat` / `timeSpent` / `pagesRead` anywhere | Time-spent / pages-read tracking + display. |
| **Fixed-layout pinch-zoom / spread polish** | Basic `isFixedLayout` integration exists; no pinch-zoom or two-page spread controls | Enhancement on top of existing integration. |

---

## Recommended sequencing (GOAP)

```
Phase 1 (P1, parallel-safe):
  A. In-book search        → reader-ui-ux + epub-rendering-and-cfi
  B. Reader offline badge  → reader-ui-ux (consume existing isOffline)
  C. Global offline banner → reader-ui-ux (reuse SwUpdateNotification)

Phase 2 (P2, sequential per item):
  D. Decide+wire pendingSyncCount (pwa-offline-sync)
  E. Client token refresh OR remove /refresh (secure-invite-and-access)
  F. Telemetry sink decision (cloudflare-worker-api) — ADR first

Phase 3 (P3, backlog):
  G. Reading statistics
  H. Fixed-layout zoom/spread
```

**Quality gate between phases:** `./scripts/quality_gate.sh` + targeted Vitest;
E2E for A/B/C via `apps/tests`.

## Notes / non-goals

- This plan is analysis only; **no production code was changed**.
- CSRF is explicitly dropped from the backlog (Bearer auth, not cookies).
- Items D and E are partly "dead code" decisions — removal is a valid resolution.

## References

- Plan #085 — prior (now partly stale) state analysis
- ADR-081 — preexisting-issue integration policy
- ADR-005 — offline sync; ADR-006 — annotation model

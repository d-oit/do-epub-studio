# GOAP Plan #085: Codebase State Analysis — 2026-06-12

**Date:** 2026-06-12
**Status:** 🔍 ANALYSIS
**Branch:** `fix/pr499-codacy` (diverged from remote; main has PR #507 merged)

---

## Current State

### CI / PRs
- **Open PRs:** 0
- **Failed CI runs:** 0
- **Latest main merge:** PR #507 — `fix(web): resolve Codacy high issues in theme toggle`

### Open Issues (12)

| # | Title | Category | Local Status |
|---|-------|----------|--------------|
| 484 | Login inputs: aria-label but no visible `<label>` | bug/a11y | ✅ Implemented (uncommitted) |
| 485 | Locale selector persistence across sessions | i18n | ✅ Implemented (uncommitted) |
| 486 | Show app branding/logo on login page | ui/ux | ✅ Implemented (uncommitted) |
| 487 | Skip-to-main-content link target bug | bug/a11y | ✅ Implemented (uncommitted) |
| 488 | Loading/spinner state on Sign In button | ui/ux | ✅ Implemented (uncommitted) |
| 489 | Design token system (typography, color, spacing) | design-system | ✅ Implemented (uncommitted) |
| 490 | Full i18n infrastructure EN/DE/FR | i18n | ✅ Implemented (uncommitted) |
| 492 | Structured client logging + tracing | observability | ✅ Implemented (uncommitted) |
| 493 | Security hardening (CSP, OWASP) | security | ✅ Implemented (uncommitted) |
| 494 | Responsive app shell (mobile/tablet/desktop) | ui/ux | ✅ Implemented (uncommitted) |
| 495 | Offline-ready banner redesign | pwa | ✅ Implemented (uncommitted) |
| 496 | Complete login page redesign | ui/ux | ✅ Implemented (uncommitted) |
| 497 | Design token system (fluid type, OKLCH, dark mode) | design-system | ✅ Implemented (uncommitted) |

**All 12 issues have local implementations but none are merged to main.**

---

## Missing Implementations (Beyond Open Issues)

### P0 — Security & Core

| Gap | Location | Impact |
|-----|----------|--------|
| Password reset flow | `LoginPage.tsx` L133-137 | Dead "Forgot password?" button; no backend endpoint |
| CSRF protection | Worker API | Login form POST has no CSRF token mitigation |
| SW background sync handler | `sw.ts` | Registers `sync-reader-state` tag but no `sync` event handler |

### P1 — User-Facing Features

| Gap | Location | Impact |
|-----|----------|--------|
| Offline connectivity banner | App-wide | `navigator.onLine=false` shows nothing outside reader |
| Highlights panel | Reader features | Can create highlights but no list view to manage them |
| In-book search | Reader features | No Ctrl+F or search panel for within-EPUB text search |
| Catalog page i18n | `CatalogPage.tsx` | All text hardcoded English |

### P2 — Observability & Polish

| Gap | Location | Impact |
|-----|----------|--------|
| Client telemetry endpoint | Worker routes | No `/api/telemetry` to receive client logs |
| Hardcoded English aria-labels | `BookmarksPanel`, `AnnotationToolbar`, `App.tsx` skip link | a11y strings bypass i18n |
| `pendingSyncCount` unused | `reader.ts` store | State exists but never populated or displayed |
| Reader offline indicator | `ReaderToolbar` | `isOffline` tracked but not shown in UI |

### P3 — Future Enhancements

| Gap | Location | Impact |
|-----|----------|--------|
| Reading statistics | Reader | No time-spent/pages-read tracking |
| Fixed-layout integration | `fixed-layout.ts` | Module exists but no pinch-zoom or spread view in UI |
| Session token refresh | `auth.ts` store | No automatic expiry check or refresh |

---

## Recommended Next Actions

### Immediate (merge existing work)
1. Create feature branch from latest `origin/main`
2. Cherry-pick or rebase the 12-issue implementations
3. Run full quality gate (`./scripts/quality_gate.sh`)
4. Open PR to merge all open-issue resolutions
5. Close issues #484–#497 after merge

### Short-term (P0/P1 gaps)
6. Implement password reset flow (worker endpoint + frontend form)
7. Add CSRF token middleware to worker
8. Implement SW `sync` event handler for `sync-reader-state`
9. Add global offline connectivity toast (reuse `SwUpdateNotification` pattern)
10. Internationalize `CatalogPage.tsx`
11. Move hardcoded aria-labels to i18n keys

### Medium-term (P2)
12. Create `/api/telemetry` worker endpoint
13. Build highlights management panel
14. Add in-book search (epub.js `rendition.search()`)
15. Wire `pendingSyncCount` to display in UI

---

## Quality Gates Verified
- [x] `pnpm run lint` — passes on working tree
- [x] `pnpm run typecheck` — passes on working tree
- [x] `pnpm run test:unit` — 265 tests pass
- [x] No failed CI on main

---

## References
- Plan #083: All 12 issues swarm implementation
- ADR-084: Resolution decisions for #484–#497
- Plan #082: Modern UI design overhaul
- ADR-063: Accessibility design tokens

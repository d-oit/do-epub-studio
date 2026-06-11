# GOAP Plan 063: Comprehensive Codebase Audit — Missing Implementation, Features, Docs, UI, Tests, Logging, Error Handling, Navigation, Contrast

**Date:** 2026-05-30
**Status:** 🟡 In Progress — Wave 1 ✅ Complete, Wave 2 pending
**Strategy:** Hybrid — Swarm analysis completed; execution prioritizes P0/P1 items in waves
**Based on:** Skills-driven analysis using accessibility-auditor, code-quality, testing-strategy, security-code-auditor, reader-ui-ux, safe-regex-authoring + code-searcher swarms
**Previous gap analyses:** Plans 033, 052 (both resolved) — this plan fills remaining gaps not covered
**Companion ADR:** `docs/plans/063-adr-comprehensive-audit-policy.md` ✅ Created — establishes recurring audit cadence

---

## 1. Executive Summary

The codebase is mature and well-structured with strong foundations in security (Argon2id, signed URLs, multi-signal locators), observability (traceId/spanId throughout), and accessibility (axe-core audits, ARIA attributes, LiveRegion). However, systematic analysis across 10 dimensions reveals **65 actionable gaps** — a mix of missing features, documentation drift, test coverage gaps, accessibility polish, error handling hardening, performance monitoring, and i18n completeness.

---

## 2. Findings by Category

### A. Missing Implementation & Features (10 gaps)

| ID | Priority | Area | Finding | Evidence |
|----|----------|------|---------|----------|
| F1 | P0 | Navigation | **No 404/catch-all route** in App.tsx — unmatched routes render blank page | `apps/web/src/App.tsx` — no `<Route path="*">` |
| F2 | P1 | Reader | **Search within book** referenced in coding-guide §20 (Reader controls) but not implemented — large scope, split into P1 | `docs/coding-guide.md` line 1329 |
| F3 | P1 | Editorial | **Export notes** capability (`canExportNotes`) exists in auth model but no export route or UI | `packages/schema/src/schemas.ts`, `apps/worker/src/routes/` — no export endpoint |
| F4 | P1 | Editorial | **Threaded comment resolution workflow** — comments support parent/child but no resolution lifecycle UI | `apps/web/src/features/reader/components/annotations/CommentItem.tsx` |
| F5 | P1 | Admin | **Book delete endpoint** not implemented — admin can create books but not delete. Previously noted in plan 052 (G1-G4 context) | `apps/worker/src/routes/admin/books.ts` — POST/PUT only, no DELETE |
| F6 | P2 | Reader | **RTL (right-to-left) EPUB support** — referenced in archived plan 049 Wave 3 (#301) but never implemented. Large scope | `packages/reader-core/src/epub-loader.ts` — no RTL detection |
| F7 | P2 | Reader | **Chapter progress indicator** (e.g., "Chapter 3 of 12") not shown in reader toolbar | `apps/web/src/features/reader/components/toolbar/ReaderToolbar.tsx` |
| F8 | P2 | Admin | **Admin dashboard overview** — admin lands on books list; no summary stats (total books, active grants) | `apps/web/src/features/admin/BooksPage.tsx` |
| F9 | P2 | Reader | **Bookmark annotation/note** — bookmarks can be created/deleted but no note field | `apps/worker/src/routes/reader/bookmarks.ts` — no `note` field |
| F10 | P3 | Platform | **AI-assisted editorial workflows** — mentioned in coding-guide as future phase, not started | `docs/coding-guide.md` line 836 |

### B. Missing Documentation (8 gaps)

| ID | Priority | Area | Finding | Evidence |
|----|----------|------|---------|----------|
| D1 | P1 | Docs | **`docs/accessibility.md`** referenced in coding-guide §8 but does not exist | `docs/coding-guide.md` line 493 |
| D2 | P1 | Docs | **`docs/api.md`** referenced in coding-guide §8 but does not exist | `docs/coding-guide.md` line 493 |
| D3 | P1 | Docs | **`docs/setup-cloudflare.md`** + **`docs/setup-turso.md`** referenced in coding-guide §8 but missing | `docs/coding-guide.md` lines 493-494 |
| D4 | P1 | Docs | **JSDoc coverage is minimal** — only 2 files (`LiveRegion.tsx`, `useFocusTrap.ts`) have JSDoc on exported functions. 198+ exported symbols lack documentation | Code search: `@param` found only 2 files |
| D5 | P1 | Docs | **Storybook docs missing** — 13 stories exist but no README explaining how to run/contribute stories | `packages/ui/src/__stories__/` — no README |
| D6 | P2 | Docs | **Plan archive README** references plan 049 but may be stale after recent archival | `docs/plans/archive/README.md` |
| D7 | P2 | Docs | **Worker README** (`apps/worker/README.md`) — flagged resolved in plan 020 but content may be minimal | `apps/worker/README.md` |
| D8 | P2 | Docs | **`docs/observability/` directory** exists but contains only `performance-budgets.md` — missing runbooks for tracing, logging architecture | `docs/observability/` |

### C. Missing UI Components & Patterns (7 gaps)

| ID | Priority | Area | Finding | Evidence |
|----|----------|------|---------|----------|
| U1 | P1 | UI | **Toast system not functional in production** — `toast()` function in `packages/ui` logs `console.warn('Toast not initialized')` instead of showing UI. Graceful fallback exists (console.warn) | `packages/ui/src/toast.tsx:66` |
| U2 | P1 | UI | **`PageContainer` component unused** — exists in `packages/ui` but not applied to web app pages; pages lack consistent layout wrapper | `packages/ui/src/page-container.tsx` — only imported in ui/index.tsx |
| U3 | P1 | UI | **No offline status indicator** in reader UI — E2E test checks for it but component may not exist or render consistently | `apps/tests/reader-annotations-and-admin.spec.ts:365` |
| U4 | P1 | UI | **No dedicated error page component** — only `ErrorBoundary` provides generic fallback; no 404/500/offline-specific pages | `apps/web/src/components/ErrorBoundary.tsx` |
| U5 | P2 | UI | **Loading skeleton patterns inconsistent** — `Skeleton` component exists but `Spinner` used more often; no content-specific skeletons (paragraph, image) | `packages/ui/src/skeleton.tsx` |
| U6 | P2 | UI | **Reader toolbar missing "jump to page/location" input** — coding guide §20 mentions chapter navigation but no location input | `apps/web/src/features/reader/components/toolbar/ReaderToolbar.tsx` |
| U7 | P2 | UI | **Admin mobile responsiveness** — admin pages (Books, Grants, Audit) lack responsive design passes | `apps/web/src/features/admin/` — no mobile-first layouts |

### D. Missing Tests (8 gaps)

| ID | Priority | Area | Finding | Evidence |
|----|----------|------|---------|----------|
| T1 | P0 | Tests | **`epub-parser.worker.ts` has no test file** — critical EPUB parsing worker excluded from coverage | `packages/reader-core/vitest.config.ts` — excludes `*.worker.ts` |
| T2 | P0 | Tests | **`reanchor-worker.ts` has no test file** — excluded from coverage; core annotation re-anchoring logic | `packages/reader-core/vitest.config.ts` — excludes `reanchor-worker.ts` |
| T3 | P1 | Tests | **9 UI components lack tests**: `badge.tsx`, `card.tsx`, `header.tsx`, `icon-button.tsx`, `page-container.tsx`, `skeleton.tsx`, `tooltip.tsx`, `LiveRegion.tsx`, `useFocusTrap.ts` — only 6/15 UI components tested | `packages/ui/src/` vs `packages/ui/src/__tests__/` |
| T4 | P1 | Tests | **`safe-regex.ts` has no dedicated tests** — ReDoS prevention helpers untested despite Tier 1 AGENTS.md rule | `packages/shared/src/safe-regex.ts` — no `safe-regex.test.ts` |
| T5 | P1 | Tests | **Schema package coverage extremely low** (15% lines) — schemas.ts and locator.ts need more tests | `packages/schema/vitest.config.ts` |
| T6 | P2 | Tests | **No property-based tests beyond reanchor** — `fast-check` is in project but only used in reanchor tests | Search for `fast-check` imports limited to reanchor |
| T7 | P2 | Tests | **No integration tests for sync queue replay** — offline sync is critical path but tested only at unit level | `apps/web/src/lib/offline/sync.ts` |
| T8 | P2 | Tests | **Worker middleware tests incomplete** — cors, security-headers, rate-limit, validation middleware tested; observability middleware has no dedicated test | `apps/worker/src/__tests__/` vs `apps/worker/src/middleware/` |

### E. Missing Logging & Observability (5 gaps)

| ID | Priority | Area | Finding | Evidence |
|----|----------|------|---------|----------|
| L1 | P1 | Logging | **44+ `console.log/warn/error` calls without traceId context** — reader hooks, EPUB loader, service worker use bare console calls. Large scope — split across waves (reader hooks first) | 44 matches across `apps/web/src/`, `packages/reader-core/` |
| L2 | P1 | Logging | **Client logger only writes to console** — `logClientEvent()` doesn't send logs to any remote endpoint; logs are lost on page close | `apps/web/src/lib/client-logger.ts` |
| L3 | P1 | Logging | **No performance monitoring** for key user interactions (EPUB load time, annotation create latency, sync duration) | No Performance API or `performance.mark()` usage found |
| L4 | P2 | Logging | **Worker `console.log` in production** — observability middleware and rate limiter use `console.log` which is noisy in Cloudflare Workers | `apps/worker/src/lib/observability.ts:49` |
| L5 | P2 | Logging | **No audit logging for client-side actions** — admin audit trail exists server-side but client actions (e.g., failed login attempts) not logged | `apps/web/src/lib/client-logger.ts` — no audit-specific events |

### F. Missing Error Handling (6 gaps)

| ID | Priority | Area | Finding | Evidence |
|----|----------|------|---------|----------|
| E1 | P0 | Error | **Empty catch block** in `admin-middleware.ts:98` — `.catch(() => {})` silently swallows session revocation errors | `apps/worker/src/auth/admin-middleware.ts:98` |
| E2 | P1 | Error | **No retry with backoff in API client** — `apiRequest()` catches errors but doesn't retry; transient network failures cause hard failures | `apps/web/src/lib/api.ts` |
| E3 | P1 | Error | **EPUB loading errors lack user-friendly recovery** — reader shows generic error; no "try again" or "check your connection" guidance | `apps/web/src/features/reader/ReaderPage.tsx` |
| E4 | P1 | Error | **`epub-parser.worker.ts` error handling has no tracing** — worker catches errors but doesn't create traceId or log structured errors | `packages/reader-core/src/epub-parser.worker.ts` |
| E5 | P2 | Error | **No AbortController cleanup in reader** — concurrent EPUB loading or annotation operations may race without cancellation | `apps/web/src/features/reader/hooks/useReaderEpub.ts` |
| E6 | P2 | Error | **Sync queue error handling** — items exceeding `MAX_RETRY_ATTEMPTS` (5) are silently dropped; no dead-letter queue or user notification | `apps/web/src/lib/offline/sync.ts:85` |

### G. Missing Navigation Patterns (5 gaps)

| ID | Priority | Area | Finding | Evidence |
|----|----------|------|---------|----------|
| N1 | P0 | Nav | **No skip-to-content link** — required by WCAG 2.4.1; 0 search results for skip-link/skipNav | Code search: skip-link returned 0 results |
| N2 | P1 | Nav | **No breadcrumbs navigation** for admin pages (Books > Book Grants, Admin > Audit) | `apps/web/src/features/admin/` |
| N3 | P1 | Nav | **No deep link support for chapters/annotations** — URLs like `/read/:slug#chapter-3` not supported | `apps/web/src/App.tsx` — no hash-based routing |
| N4 | P2 | Nav | **Reader chapter navigation** — next/previous chapter buttons exist but no chapter dropdown or progress scrubber | `apps/web/src/features/reader/components/viewer/ReaderViewer.tsx` |
| N5 | P2 | Nav | **No browser back button integration for reader panels** — opening TOC/settings doesn't push history state; back button closes reader instead of panel | `apps/web/src/features/reader/ReaderPage.tsx` |

### H. Missing Contrast & Accessibility (8 gaps)

### I. Missing Performance & Bundle Size Monitoring (4 gaps)

| ID | Priority | Area | Finding | Evidence |
|----|----------|------|---------|----------|
| P1 | P1 | Perf | **Performance budgets not enforced in CI** — `.performance-budgets.json` exists but no CI gate validates bundle sizes against budgets | `.performance-budgets.json`, `scripts/report-performance.mjs` |
| P2 | P1 | Perf | **No memory leak detection** — `analysis/memory-leaks-report.md` exists but findings not tracked as actionable items | `analysis/memory-leaks-report.md` |
| P3 | P2 | Perf | **No Core Web Vitals monitoring in production** — Lighthouse runs in CI on PRs but no RUM (Real User Monitoring) for LCP/INP/CLS | `docs/lighthouse.md` |
| P4 | P2 | Perf | **No image optimization pipeline** — EPUB cover images and assets served directly without compression/format conversion | `apps/worker/src/storage/` |

### J. Missing Internationalization (i18n) (4 gaps)

| ID | Priority | Area | Finding | Evidence |
|----|----------|------|---------|----------|
| I1 | P1 | i18n | **No i18n parity audit** — test exists (`i18n-parity.test.ts`) but only checks for empty/TODO values, not completeness of translations across en/de/fr | `apps/web/src/__tests__/i18n-parity.test.ts` |
| I2 | P1 | i18n | **Date/number formatting not localized** — `formatDate.ts` uses hardcoded `en-US` locale; no `Intl` usage with dynamic locale | `apps/web/src/features/reader/components/annotations/formatDate.ts` |
| I3 | P2 | i18n | **RTL layout support not implemented** — i18n infrastructure exists but no RTL CSS or layout direction switching for future Arabic/Hebrew locales | `apps/web/src/i18n/` |
| I4 | P2 | i18n | **No locale-aware number formatting** for reading progress percentages, chapter numbers | `apps/web/src/features/reader/` |

### H. Missing Contrast & Accessibility (8 gaps) — continued

| ID | Priority | Area | Finding | Evidence |
|----|----------|------|---------|----------|
| C1 | P1 | A11y | **`--color-foreground-muted` light mode contrast needs verification** — `oklch(40% 0 0)` on white computes to ~5.8:1 (passes AA for normal text at 4.5:1 but borderline for small text < 18px). Verify with contrast tool before changing | `apps/web/src/styles/globals.css:13` |
| C2 | P0 | A11y | **Accessibility audit missing for admin pages** — axe-core audits cover login, reader, settings, TOC, admin login but NOT admin books/grants/audit pages | `apps/tests/accessibility-audit.spec.ts` |
| C3 | P1 | A11y | **Touch target sizes not consistently enforced** — `.touch-target` utility class exists in globals.css but not applied to all interactive elements | `apps/web/src/styles/globals.css:253` |
| C4 | P1 | A11y | **Framer Motion animations may not respect `prefers-reduced-motion`** — globals.css sets `animation-duration: 0.01ms` but Framer Motion has its own `useReducedMotion()` hook not integrated | `apps/web/src/styles/globals.css:327-340` |
| C5 | P1 | A11y | **No ARIA landmark regions** for primary navigation — App.tsx has `<Suspense>` but no `<nav>` or `<main>` landmarks | `apps/web/src/App.tsx` |
| C6 | P2 | A11y | **Color-only semantic indicators** — success/error states use only color (OKLCH); need icon or text reinforcement for colorblind users | `packages/ui/src/badge.tsx`, `toast.tsx` |
| C7 | P2 | A11y | **Focus trap in reader panels** — `useFocusTrap` exists in UI package but may not be consistently applied to all reader panels (TOC, Settings, Comments, Bookmarks, Info) | `packages/ui/src/useFocusTrap.ts` |
| C8 | P2 | A11y | **Screen reader announcement on panel transitions** — LiveRegion component exists but may not announce panel open/close events | `packages/ui/src/LiveRegion.tsx` |

---

## 3. Decomposition & Strategy

### Wave 1: Critical P0 Gaps (6 items) — ✅ Complete

| ID | Category | Task | Status |
|----|----------|------|--------|
| F1 | Navigation | Add 404 catch-all route with dedicated NotFoundPage component | ✅ Done — Plan 064 |
| T1 | Tests | Create `epub-parser.worker.test.ts` with coverage for validation, security checks | ✅ Done — Plan 064 |
| T2 | Tests | Create `reanchor-worker.test.ts` | ✅ Done — Plan 064 |
| E1 | Error | Fix empty catch block in admin-middleware — at minimum log the error | ✅ Done — Plan 064 |
| N1 | Nav | Add skip-to-content link for keyboard users (WCAG 2.4.1) | ✅ Done — Plan 064 |
| C2 | A11y | Add axe-core audits for admin books, grants, audit pages | ✅ Done — Plan 064 |

### Wave 2: High P1 Gaps (26 items)

| ID | Category | Task |
|----|----------|------|
| F2 | Features | Implement search-within-book in reader |
| F3 | Features | Implement export notes endpoint + UI |
| F4 | Features | Build comment resolution lifecycle UI |
| F5 | Features | Implement book delete endpoint with cascade |
| D1 | Docs | Create `docs/accessibility.md` |
| D2 | Docs | Create `docs/api.md` |
| D3 | Docs | Create `docs/setup-cloudflare.md` and `docs/setup-turso.md` |
| D4 | Docs | Add JSDoc to key exported APIs (api.ts, epub-loader.ts, session.ts) |
| D5 | Docs | Create Storybook README |
| U1 | UI | Fix toast system — implement functional ToastProvider integration in web app |
| U2 | UI | Apply PageContainer to web app pages for consistent layout |
| U3 | UI | Implement offline status indicator component |
| U4 | UI | Create dedicated 404/500/offline error pages |
| T3 | Tests | Add tests for untested UI components (badge, card, header, icon-button, page-container, skeleton, tooltip, LiveRegion, useFocusTrap) |
| T4 | Tests | Add property-based tests for safe-regex.ts |
| T5 | Tests | Improve schema package coverage (target: 30%+ lines) |
| L1 | Logging | Add traceId to bare `console.log/error/warn` calls in reader hooks (scope reduced from full codebase) |
| L2 | Logging | Implement remote log shipping in client-logger (send to Worker endpoint) |
| L3 | Logging | Add Performance API marks for EPUB load, annotation create, sync duration |
| E2 | Error | Add retry with exponential backoff to apiRequest() |
| E3 | Error | Add user-friendly error recovery UI for EPUB loading failures |
| E4 | Error | Add traceId + structured error logging to epub-parser.worker.ts |
| N2 | Nav | Add breadcrumbs to admin pages |
| N3 | Nav | Implement hash-based deep linking for chapters |
| C1 | A11y | Verify `--color-foreground-muted` contrast with tool; adjust if needed |
| C3 | A11y | Enforce `.touch-target` class on all interactive elements < 44px |
| C4 | A11y | Integrate Framer Motion `useReducedMotion()` with global reduced-motion preference |
| C5 | A11y | Add ARIA landmark regions (`<nav>`, `<main>`) to App.tsx and reader layout |
| P1 | Perf | Wire `.performance-budgets.json` into CI gate |
| P2 | Perf | Triage `analysis/memory-leaks-report.md` findings into actionable issues |
| I1 | i18n | Run i18n parity audit — verify en/de/fr translation completeness beyond TODO check |
| I2 | i18n | Localize date/number formatting with dynamic `Intl` locale |

### Wave 3: Moderate P2 Gaps (27 items)

| ID | Category | Task |
|----|----------|------|
| F6 | Features | RTL EPUB support in reader-core (large scope) |
| F7 | Features | Chapter progress indicator ("Chapter 3 of 12") |
| F8 | Features | Admin dashboard overview with summary stats |
| F9 | Features | Bookmark notes/annotations field |
| D6 | Docs | Refresh plan archive README |
| D7 | Docs | Expand worker README with full route documentation |
| D8 | Docs | Create `docs/observability/runbooks/` with tracing + logging architecture docs |
| U5 | UI | Add content-specific skeleton variants (paragraph, image, card) |
| U6 | UI | Add "jump to location" input in reader toolbar |
| U7 | UI | Responsive design pass for admin pages |
| T6 | Tests | Add property-based tests for additional regex patterns (CFI parsing, URL validation) |
| T7 | Tests | Add sync queue replay integration tests |
| T8 | Tests | Add observability middleware test |
| L4 | Logging | Replace production `console.log` with structured logging in Worker |
| L5 | Logging | Add client-side audit event logging |
| E5 | Error | Add AbortController cleanup for concurrent reader operations |
| E6 | Error | Add dead-letter queue + user notification for failed sync items |
| N4 | Nav | Add chapter dropdown/scrubber in reader toolbar |
| N5 | Nav | Push history state for reader panel open/close |
| C6 | A11y | Add icon/text reinforcement for color-only semantic states |
| C7 | A11y | Apply useFocusTrap to all reader panels consistently |
| C8 | A11y | Add LiveRegion announcements for panel transitions |
| P3 | Perf | Add Core Web Vitals RUM monitoring |
| P4 | Perf | Add image optimization pipeline for covers/assets |
| I3 | i18n | Implement RTL layout direction switching for future locales |
| I4 | i18n | Add locale-aware number formatting for progress/chapter numbers |

### Wave 4: Future P3 (1 item)

| ID | Category | Task |
|----|----------|------|
| F10 | Features | AI-assisted editorial workflows (deferred to future phase per coding-guide) |

---

## 4. Quality Gates

All waves must pass:

1. `./scripts/quality_gate.sh` — lint + typecheck + test (0 errors)
2. `pnpm test:coverage` — all packages meet or exceed thresholds
3. `pnpm build` — clean build
4. `./scripts/validate-workflows.sh` — all workflows valid
5. `pnpm lint` — 0 errors

Wave 1 additional gates:
6. Lighthouse accessibility score ≥ 0.85 (already set in `.lighthouserc.json`)
7. Axe-core audits: 0 critical/serious violations on all pages
8. Color contrast verification for all `foreground-muted` usages

---

## 5. Agent Assignments

| Wave | Category | Primary Skill(s) | Supporting Skills |
|------|----------|-----------------|-------------------|
| 1 | Features (F1) | `reader-ui-ux` | `code-quality` |
| 1 | Tests (T1, T2) | `testing-strategy`, `testdata-builders` | `test-runner` |
| 1 | Error (E1) | `security-code-auditor` | `code-quality` |
| 1 | Nav (N1) | `accessibility-auditor` | `reader-ui-ux` |
| 1 | A11y (C2) | `accessibility-auditor` | `reader-ui-ux` |
| 2 | Features (F2-F5) | `cloudflare-worker-api`, `reader-ui-ux`, `epub-rendering-and-cfi` | `code-quality` |
| 2 | Docs (D1-D5) | `agents-md` | — |
| 2 | UI (U1-U4) | `reader-ui-ux` | `accessibility-auditor` |
| 2 | Tests (T3-T5) | `testing-strategy`, `testdata-builders` | `code-quality` |
| 2 | Logging (L1-L3) | `code-quality` | `security-code-auditor` |
| 2 | Error (E2-E4) | `code-quality`, `security-code-auditor` | `cloudflare-worker-api` |
| 2 | A11y/Nav (C1, C3-C5, N2-N3) | `accessibility-auditor` | `reader-ui-ux` |
| 2 | Perf (P1-P2) | `cicd-pipeline` | `code-quality` |
| 2 | i18n (I1-I2) | `reader-ui-ux` | `code-quality` |
| 3 | All P2 items | Respective primary skills | `code-quality` |
| 4 | F10 | Deferred | — |

---

## 6. Success Criteria

| Criterion | Target |
|-----------|--------|
| 404 page exists and renders for unmatched routes | Wave 1 |
| Worker test files have coverage (no exclusion without ADR) | Wave 1 |
| Empty catch blocks eliminated | Wave 1 |
| Skip-to-content link present and functional (WCAG 2.4.1) | Wave 1 |
| Axe-core audits pass on all pages (0 critical/serious) | Wave 1 |
| `docs/accessibility.md` and `docs/api.md` exist and are accurate | Wave 2 |
| Toast system works end-to-end in production | Wave 2 |
| All 15 UI components have at least basic tests | Wave 2 |
| Export notes feature works end-to-end | Wave 2 |
| Client logger sends remote logs to Worker endpoint | Wave 2 |
| Book delete endpoint works with cascade | Wave 2 |
| Framer Motion respects `prefers-reduced-motion` | Wave 2 |
| ARIA landmarks present on all pages | Wave 2 |
| Performance budgets enforced in CI | Wave 2 |
| i18n parity verified across en/de/fr | Wave 2 |

---

## 7. Out of Scope

- Net new product features beyond whats referenced in existing docs/ADRs
- Schema migrations (unless required by F5 or F9)
- Infrastructure changes beyond CI/CD adjustments
- Third-party service integrations (error tracking, analytics)
- Complete JSDoc coverage (target: key APIs only in Wave 2)

---

## 8. Notes

- Previous gap analyses (033, 052) are resolved. This plan fills remaining gaps not covered by those sweeps.
- Companion ADR `docs/plans/063-adr-comprehensive-audit-policy.md` created — defines bi-weekly audit cadence, 10-category scope, swarm methodology, and wave-based execution.
- Some items were previously identified: D7 (plan 020, 023), F5 (plan 052 G1-G4 context), admin route mismatch (plan 052 G4 — now resolved). Verify status before rework.
- The `toast` system (U1) is already built in `packages/ui` but needs integration into the web app's component tree.
- Test exclusions in `reader-core/vitest.config.ts` (worker files) should be replaced with actual tests, not just config changes.
- `safe-regex-authoring` skill was created in plan 033 — use it when touching any regex (applies to F2 search, U6 jump-to-location, N3 deep linking).
- F6 (RTL support) and F2 (search-within-book) are large-scope items that may need dedicated sub-plans rather than inline execution.
- L1 (traceId on all console calls) scope reduced from full codebase to reader hooks only in Wave 2; remaining files deferred to Wave 3 (L4).

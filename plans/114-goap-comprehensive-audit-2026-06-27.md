# GOAP 114 — Comprehensive Codebase Audit (2026-06-27)

**Date:** 2026-06-27
**Status:** 📋 PROPOSED — analysis only; no code changed by this plan
**Author:** Kiro CLI analysis session
**Methodology:** GOAP (analyze → decompose → strategize → coordinate → execute → synthesize)
**Extends:** Plan 105 (comprehensive audit 2026-06-23), Plan 113 (phase 3 polish — COMPLETE)
**Related ADR:** `plans/114-adr-audit-remediation-policy.md`

---

## Goal

Re-audit post-plan-113 codebase across 10 dimensions: missing implementation,
new features, .gitignore hygiene, UI/UX responsive design, e2e test coverage,
security, performance, lint, build, and CI best practices. Produce a
prioritized, independently-shippable remediation backlog.

---

## Analyze — Baseline

| Signal | Result |
|--------|--------|
| Stack | React 19 / Vite 8 / Tailwind 4 / Hono Workers / Turso / R2 / Durable Objects |
| Last audit | Plan 105 (2026-06-23) — 12 PRs shipped via Plan 113 |
| Plan 113 status | ✅ COMPLETE — B2-B7 security fixes merged, all CI green |
| Remaining plan 105 items | A1-A12 (missing impl), B1 (grant session revoke) |
| TODO/FIXME in prod source | 0 |

---

## Findings by Dimension

### A. Missing Implementation (carried from Plan 105, re-verified)

| ID | Sev | Status | Finding |
|----|-----|--------|---------|
| A1 | P2 | DONE | `/admin/recover` route now exists in App.tsx |
| A2 | P1 | OPEN | Offline sync treats bookmarks as comments — wrong endpoint/shape |
| A3 | P1 | OPEN | Bookmarks/insights have no first-class sync queue type |
| A4 | P1 | OPEN | Reading-insights sync bypasses queue; silent data loss offline |
| A5 | P2 | DONE | InfoPanel now receives insights via `computeInsightSummary` |
| A6 | P2 | OPEN | Offline reader fallback restores only progress, not annotations |
| A7 | P1 | OPEN | Email transport fallback is LoggingEmailTransport when binding absent |
| A8 | P2 | OPEN | Annotation import missing (export-only); export omits CFI metadata |
| A9 | P2 | OPEN | Search chapter lookup uses `spine.get(cfi)` incorrectly |
| A10 | P2 | OPEN | In-book search e2e has no real fixture, asserts nothing |
| A11 | P3 | OPEN | `/api/admin/audit-logs` is only a 301 redirect |
| A12 | P3 | OPEN | VirtualList variable-row-height not implemented (documented) |

### B. Security

| ID | Sev | Status | Finding |
|----|-----|--------|---------|
| B1 | **P1** | OPEN | Grant updates (PATCH) don't revoke active sessions — TIER-1 violation |
| B9 | P3 | NEW | Preferences cookie storage uses `SameSite=Lax` but no `Secure` flag |

### C. .gitignore

| ID | Sev | Finding |
|----|-----|---------|
| C1 | P2 | Missing `.dev.vars` pattern — Cloudflare Workers local secrets file |
| C2 | P3 | Missing `*.tsbuildinfo` — TypeScript incremental build cache |
| C3 | P3 | Missing `.eslintcache` / `.stylelintcache` lint cache patterns |
| C4 | P3 | Missing `.vitest/` directory pattern |
| C5 | P3 | Missing `junit.xml` / `*.lcov` CI artifact patterns |
| C6 | P3 | Stale tracked file: `apps/web/test-results/.last-run.json` needs `git rm --cached` |

### D. UI/UX Responsive Design

| ID | Sev | Component | Finding |
|----|-----|-----------|---------|
| D1 | P2 | `AuditLogPage.tsx` | Table wrapper uses `overflow-hidden` — clips on mobile. Need `overflow-x-auto` |
| D2 | P2 | `AuditLogPage.tsx` | Fixed `p-8` padding — excessive on mobile. Use `p-4 sm:p-6 lg:p-8` |
| D3 | P2 | `BooksPage.tsx:243` | Admin header buttons `flex justify-between` overflows on narrow — add `flex-wrap` |
| D4 | P2 | `BooksPage.tsx:251` | Fixed `p-8` padding — same as D2 |
| D5 | P2 | `ReaderToolbar.tsx:280` | Duplicate nested `role="progressbar"` — accessibility violation |
| D6 | P3 | `ReaderViewer.tsx:35` | Uses `100vh` not `100dvh` — mobile browser URL bar not accounted for |
| D7 | P3 | `AuditLogPage.tsx` | Table scroll wrapper needs `tabindex="0"` + `role="region"` for keyboard access |
| D8 | P3 | `NotFoundPage.tsx` | Hardcoded English strings — needs i18n |
| D9 | P3 | `HighlightItem.tsx:50` | Inline styles instead of Tailwind classes |
| D10 | P3 | `HighlightItem.tsx:82` | Action buttons missing `type="button"` |

### E. E2E Test Coverage Gaps

| ID | Sev | Missing Test Scenario |
|----|-----|----------------------|
| E1 | P1 | Catalog browsing flow (search, filter, pagination) |
| E2 | P1 | Book upload flow (admin creates book, uploads EPUB) |
| E3 | P1 | Admin grants management (create, update, revoke) |
| E4 | P2 | Admin audit log viewing and filtering |
| E5 | P2 | Offline sync recovery (queue → reconnect → sync) |
| E6 | P2 | Reading insights display in InfoPanel |
| E7 | P2 | Mobile viewport tests: most flows lack `@mobile` tag |
| E8 | P3 | Error scenarios: network failure mid-read, auth expiry during session |
| E9 | P3 | Book reading with real EPUB fixture (annotations, bookmarks, navigation) |

### F. Performance

| ID | Sev | Finding |
|----|-----|---------|
| F1 | P3 | `framer-motion` (~30KB gzip) could be replaced with lighter `motion` package or CSS-only animations for current usage (subtle enter/exit) |

### G. Lint

| ID | Sev | Finding |
|----|-----|---------|
| — | — | No issues found. ESLint flat config is comprehensive with 12 plugins. All disabled rules have inline justification. |

### H. Build

| ID | Sev | Finding |
|----|-----|---------|
| — | — | No issues found. Turborepo DAG is correct, caching properly configured. |

### I. CI

| ID | Sev | Finding |
|----|-----|---------|
| I1 | P2 | No Node.js version matrix — single version only. Should test Node 22 + 24 |
| I2 | P3 | E2E retry (`max_attempts: 2`) may mask flaky tests |

---

## Decompose — Task Clusters

### Cluster 1: Security (TIER-1 Critical)
- **B1**: Add session revocation on grant PATCH endpoint
- **B9**: Add `Secure` flag to preferences cookie

### Cluster 2: .gitignore Hardening
- **C1-C6**: Update `.gitignore` + `git rm --cached` stale file

### Cluster 3: Missing Implementation (P1)
- **A2/A3**: First-class offline sync queue for bookmarks + insights
- **A4**: Reading-insights failure → enqueue retry item
- **A7**: Verify email transport binding per environment; add fallback warning

### Cluster 4: UI Responsive Fixes
- **D1-D5**: Admin pages responsive padding/overflow + progressbar a11y fix

### Cluster 5: E2E Test Coverage
- **E1-E4**: Core flows (catalog, upload, grants, audit)
- **E7**: Tag existing flows with `@mobile` for mobile viewport execution

### Cluster 6: Missing Implementation (P2)
- **A6**: Restore cached annotations on offline fallback
- **A8**: Annotation import with CFI metadata
- **A9**: Fix search chapter lookup

### Cluster 7: CI Hardening
- **I1**: Add Node 22/24 matrix to CI

### Cluster 8: Low Priority Polish
- **D6-D10**, **F1**, **A11**, **A12**, **E5-E6**, **E8-E9**, **I2**

---

## Strategize — Execution Order

1. **Cluster 1** (Security) — TIER-1, blocks everything
2. **Cluster 2** (.gitignore) — Quick win, no code risk
3. **Cluster 4** (UI responsive) — Visible, independently testable
4. **Cluster 5** (E2E tests) — Validates existing functionality
5. **Cluster 3** (Missing impl P1) — Core offline correctness
6. **Cluster 7** (CI) — Infrastructure improvement
7. **Cluster 6** (Missing impl P2) — Feature completeness
8. **Cluster 8** (Polish) — Non-blocking, nice-to-have

---

## Coordinate — Ship Strategy

Each cluster ships as 1-2 PRs with feature branch per AGENTS.md:
- `fix/grant-session-revoke` (B1)
- `chore/gitignore-hardening` (C1-C6)
- `fix/admin-responsive-a11y` (D1-D5)
- `test/e2e-catalog-admin-flows` (E1-E4)
- `fix/offline-sync-queue-types` (A2-A4)
- `ci/node-version-matrix` (I1)
- `fix/offline-restore-annotations` (A6)
- `feat/annotation-import-cfi` (A8)

---

## Acceptance Criteria

- [x] B1 grant session revocation merged with unit + e2e test — **already shipped (verified Plan 115)**
- [x] .gitignore updated, stale tracked file removed — **PR #675**
- [x] Admin pages responsive on 320px viewport (no overflow) — **PR #675**
- [x] ≥5 new e2e specs covering catalog, upload, grants, audit — **PR from Plan 118**
- [x] Offline sync queue handles bookmarks + insights — **PR #675, documented in PR #738**
- [x] CI runs on Node 22 + 24 matrix — **PR #675**
- [x] All PRs pass quality gate + Codacy — **PR #738 all 22 CI checks green**

---

## Monitor

Post-execution, track via:
- CI dashboard (all checks green)
- `pnpm test:e2e` passes new specs
- Lighthouse mobile scores stable (performance budgets)
- No new Codacy issues introduced

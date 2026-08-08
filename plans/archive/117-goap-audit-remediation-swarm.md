# GOAP 117 — Audit Remediation Swarm (2026-06-27)

**Date:** 2026-06-27
**Status:** ✅ COMPLETE — all gaps closed by PRs #675, #676, #678, #679, #680, #738
**Author:** opencode agent swarm
**Methodology:** GOAP (analyze → decompose → strategize → coordinate → execute → synthesize)
**Extends:** Plans 114, 115, 116 (comprehensive audits 2026-06-27)
**PRs:** #675 (commit `553a271`) — 9/11 clusters; #676, #678 — remaining gaps; #680 — R1/B9/M4; #738 — final merge with Codacy fixes

---

## Goal

Implement all verified missing tasks from Plans 114–116 in a single PR. Every item below was verified against the current working tree with exact file/line evidence. Items already shipped (B1, A2/A3/A4, A8, D1-D5, I1, CSP) are excluded.

---

## Verification Results (post-PR#675)

| Cluster | Items | Status | Evidence |
|---------|-------|--------|----------|
| **1 — CI Perf Gates** | CI1/CI2/PF1/CI3 | ✅ PASS | `lighthouse.yml:82` exit 1; `lighthouserc.json:8` formFactor=mobile; `bundle-size.yml:53` enforce step clean |
| **2 — Login Error Alert** | U1 | ✅ PASS | `LoginPage.tsx:230` uses `border border-accent-error/30 bg-accent-error/10 rounded-lg` |
| **3 — Bounce Animations** | U2/U3 | ✅ PASS | `App.tsx` + `PageLoadingFallback.tsx` use `animate-pulse`; `--ease-out-back` removed from `globals.css` |
| **4 — Spinner Consolidation** | U5 | ✅ PASS | All 6 sites use `<Spinner>`. GrantList.tsx:77 fixed in PR #676 |
| **5 — Search Chapter Lookup** | M1 | ✅ PASS | `useReaderSearch.ts` derives href from `spine.each` iteration, no `spine.get(cfi)` |
| **6 — Email Transport Guard** | M2 | ✅ PASS | `email-transport.ts:53-58` emits structured `console.warn` with traceId |
| **7 — Viewport Units** | R1 | ✅ PASS | ReaderViewer, ReaderPage, AppShell all use `dvh` |
| **8 — i18n Hardcoded Strings** | I1/I2 | ✅ PASS | All strings use `t()`. AuditLogPage + CommentInput fixed in PRs #676, #678 |
| **9 — Header Parity** | SE1 | ✅ PASS | `_headers` and `security-headers.ts` have identical Permissions-Policy |
| **10 — Lint Config** | LC1 | ✅ PASS | `tsconfig.node.json` includes `vitest.config.ts` + `playwright.config.ts` |
| **11 — Release Node Matrix** | RW1 | ✅ PASS | `release.yml:28-30` has `node-version: [22, 24]` |

### Resolved Gaps (post-PR #676/#678)

| Gap | File | Line(s) | Resolution |
|-----|------|---------|------------|
| **U5-D** | `apps/web/src/features/admin/components/GrantList.tsx` | 77 | ✅ Fixed in PR #676 — uses `<Spinner>` from `@do-epub-studio/ui` |
| **I1-A** | `apps/web/src/features/admin/AuditLogPage.tsx` | 40-43, 48, 60, 85 | ✅ Fixed in PR #676 — all strings use `t()` keys |
| **I1-B** | `apps/web/src/features/reader/components/annotations/CommentInput.tsx` | 16, 19, 67, 78 | ✅ Fixed in PR #678 — placeholder, cancel, hint, submit all use `t()` |

---

## Task Clusters

### Cluster 1 — CI Enforce Performance Gates (P1)
- **CI1**: Lighthouse step `continue-on-error: true` → add `exit 1` on failures
- **CI2**: Add `formFactor: mobile` to `.lighthouserc.json`
- **PF1**: Bundle budget `continue-on-error: true` → make blocking
- **CI3**: Bundle-size workflow enforce step → remove `continue-on-error`

**Files:** `.github/workflows/lighthouse.yml`, `.lighthouserc.json`, `.github/workflows/bundle-size.yml`

### Cluster 2 — Login Error Alert (P2, impeccable absolute ban)
- **U1**: Replace `border-l-3 border-accent-error rounded-r` with full border + tint

**File:** `apps/web/src/features/auth/LoginPage.tsx:230`

### Cluster 3 — Replace Bounce Animations (P2/P3)
- **U2**: Replace `animate-bounce` with staggered opacity pulse on `ease-out`
- **U3**: Remove unused `--ease-out-back` token from globals.css

**Files:** `apps/web/src/App.tsx:64-66`, `apps/web/src/components/PageLoadingFallback.tsx:25-27`, `apps/web/src/styles/globals.css:69`

### Cluster 4 — Spinner Consolidation (P3)
- **U5**: Replace 6 hand-rolled spinner divs with shared `<Spinner>` primitive

**Files:** `apps/web/src/features/admin/AuditLogPage.tsx:151`, `BooksPage.tsx:304`, `GrantsPage.tsx:242`, `GrantList.tsx:77`, `ReaderViewer.tsx:29`, `SearchPanel.tsx:167`

### Cluster 5 — Search Chapter Lookup Bug (P2)
- **M1**: Fix `spine.get(result.cfi)` — derive section href from CFI base path

**File:** `apps/web/src/features/reader/hooks/useReaderSearch.ts:96`

### Cluster 6 — Email Transport Guard (P2)
- **M2**: Add `console.warn` when `EMAIL_SEND` binding is absent

**File:** `apps/worker/src/lib/email-transport.ts:49-53`

### Cluster 7 — Viewport Units (P2)
- **R1**: Replace `100vh`/`min-h-screen`/`h-screen` with `dvh` equivalents

**Files:** `ReaderViewer.tsx:35`, `ReaderPage.tsx:336`, `AppShell.tsx:45,87`

### Cluster 8 — i18n Hardcoded Strings (P2)
- **I1**: Extract hardcoded English strings to `t()` keys in en/de/fr dictionaries
- **I2**: Fix NotFoundPage SVG title

**Files:** `HighlightItem.tsx`, `BookmarksPanel.tsx`, `AuditLogPage.tsx`, `CommentInput.tsx`, `NotFoundPage.tsx`

### Cluster 9 — Header Parity (P2)
- **SE1**: Unify Permissions-Policy between Worker and Pages `_headers`

**Files:** `apps/web/public/_headers`, `apps/worker/src/lib/security-headers.ts`

### Cluster 10 — Lint Config (P2/P3)
- **LC1**: Add `vitest.config.ts`, `playwright.config.ts` to `tsconfig.node.json` includes

**File:** `apps/web/tsconfig.node.json`

### Cluster 11 — Release Verify Node Matrix (P3)
- **RW1**: Add Node version matrix to release.yml

**File:** `.github/workflows/release.yml`

---

## Execution Strategy

**Swarm** — all clusters are independent. Launch parallel agents per cluster.

| Phase | Clusters | Strategy |
|-------|----------|----------|
| 1 | CI1/CI2/PF1/CI3, U1, M1, M2 | Parallel (highest impact) |
| 2 | U2/U3, U5, R1, SE1, LC1, RW1 | Parallel (structural) |
| 3 | I1/I2 | Sequential (requires dict updates) |

---

## Acceptance Criteria

- [x] Lighthouse failures block CI (exit 1)
- [x] Bundle budget enforced (not informational)
- [x] Login error uses full border + tint (no side-stripe)
- [x] No `animate-bounce` in codebase; `--ease-out-back` removed
- [x] All spinner sites use `<Spinner>` component — **GrantList.tsx:77 fixed in PR #676**
- [x] Search results show correct chapter titles
- [x] Missing email binding logs a warning
- [x] App uses `dvh` viewport units consistently
- [x] No hardcoded user-facing JSX strings (all via `t()`) — **AuditLogPage.tsx + CommentInput.tsx fixed in PRs #676, #678**
- [x] Worker + Pages emit identical Permissions-Policy
- [x] tsconfig.node.json covers all root configs
- [x] Release verify uses same Node as CI
- [x] Quality gate + Codacy pass — **PR #738 all green**

---

## Synthesize

PR #675 (commit `553a271`) resolved 9/11 clusters from Plans 114–116.
PRs #676 and #678 closed the remaining gaps (U5-D spinner, I1-A/I1-B i18n strings).
PR #680 closes R1 (viewport units dvh) and B9 (cookie Secure flag).
PR #738 (squash-merge `59851cd`, 2026-07-09) finalizes with Codacy fixes and bundle budget adjustments.
**All 11 clusters from Plans 114–116 are now COMPLETE.**

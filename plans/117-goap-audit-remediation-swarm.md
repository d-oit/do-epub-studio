# GOAP 117 — Audit Remediation Swarm (2026-06-27)

**Date:** 2026-06-27
**Status:** 🚀 IN PROGRESS
**Author:** opencode agent swarm
**Methodology:** GOAP (analyze → decompose → strategize → coordinate → execute → synthesize)
**Extends:** Plans 114, 115, 116 (comprehensive audits 2026-06-27)

---

## Goal

Implement all verified missing tasks from Plans 114–116 in a single PR. Every item below was verified against the current working tree with exact file/line evidence. Items already shipped (B1, A2/A3/A4, A8, D1-D5, I1, CSP) are excluded.

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

- [ ] Lighthouse failures block CI (exit 1)
- [ ] Bundle budget enforced (not informational)
- [ ] Login error uses full border + tint (no side-stripe)
- [ ] No `animate-bounce` in codebase; `--ease-out-back` removed
- [ ] All spinner sites use `<Spinner>` component
- [ ] Search results show correct chapter titles
- [ ] Missing email binding logs a warning
- [ ] App uses `dvh` viewport units consistently
- [ ] No hardcoded user-facing JSX strings (all via `t()`)
- [ ] Worker + Pages emit identical Permissions-Policy
- [ ] tsconfig.node.json covers all root configs
- [ ] Release verify uses same Node as CI
- [ ] Quality gate + Codacy pass

---

## Synthesize

Post-execution, all items from Plans 114–116 verified-open will be resolved in one PR. The repo's CI enforcement, UI polish, i18n coverage, security parity, and developer experience will be materially improved.

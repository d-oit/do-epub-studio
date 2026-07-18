# GOAP 116 — Cross-Cutting Audit: Perf / Security / Lint / Build / CI / Release / i18n / Responsive (2026-06-27)

**Date:** 2026-06-27
**Status:** ✅ COMPLETED (recommendations implemented via PRs #748, #754–#762 and Plans 122, 186–198)
**Author:** Amp analysis session (verified against working tree)
**Methodology:** GOAP (analyze → decompose → strategize → coordinate → execute → synthesize)
**Companion:** `plans/115-goap-missing-impl-ui-modernization-2026-06-27.md` (missing-impl + UI)
**Policy:** follows `plans/115-adr-verified-audit-remediation-policy.md` (verify-before-schedule, correct stale findings, evidence links)

---

## Goal

Extend the verified audit to the dimensions the prior plan did not cover:
**performance, security, lint + lint config, build, CI, release / dev coding
workflow, i18n, and full responsive design.** Every finding is checked against
the current tree with a file/line pointer. Stale prior-plan claims are
corrected so closed work is not re-opened.

---

## ⚠️ Corrections to Plan 114 (verified false-OPEN)

| Plan-114 ID | Claim | Verified reality |
|-------------|-------|------------------|
| **I1** | "No Node.js version matrix — single version only" | **DONE** — [ci.yml](file:///home/doit/do-epub-studio/.github/workflows/ci.yml) runs lint/typecheck/test/build on a `node-version: [22, 24]` matrix |
| **B-CSP (prior)** | CSP missing / overridden on file responses | **DONE** — [security-headers.ts](file:///home/doit/do-epub-studio/apps/worker/src/lib/security-headers.ts) has full CSP + `minimalSecurityHeaders` for file responses; Pages [_headers](file:///home/doit/do-epub-studio/apps/web/public/_headers) ships HTML CSP |

---

## Findings by Dimension (verified)

### 1. Performance

**Strong baseline:** route-aware `manualChunks` + `React.lazy` route splitting ([App.tsx](file:///home/doit/do-epub-studio/apps/web/src/App.tsx#L17), [vite.config.ts](file:///home/doit/do-epub-studio/apps/web/vite.config.ts#L77)); per-route budgets in [.performance-budgets.json](file:///home/doit/do-epub-studio/.performance-budgets.json).

| ID | Sev | Finding | Evidence |
|----|-----|---------|----------|
| PF1 | **P2** | **Bundle budget is non-blocking.** The gzipped-budget step is labelled "informational" and `continue-on-error: true` → a budget regression cannot fail CI | [bundle-size.yml:48-55](file:///home/doit/do-epub-studio/.github/workflows/bundle-size.yml#L48) |
| PF2 | P3 | `framer-motion@^12` (~30 KB gzip) is a dep of **both** `apps/web` and `packages/ui`; usage is subtle enter/exit. Evaluate lighter `motion` core or CSS-only | (cross-ref Plan 115 P1) |
| PF3 | P3 | `index.js` budget is 500 KB and `script:size` Lighthouse cap is 500 KB — generous for an editorial reader. Consider tightening once PF1 makes the budget enforceable | [.performance-budgets.json](file:///home/doit/do-epub-studio/.performance-budgets.json), [.lighthouserc.json:23](file:///home/doit/do-epub-studio/.lighthouserc.json#L23) |

### 2. Security

**Strong baseline:** HSTS+preload, `X-Frame-Options: DENY`, nosniff, Referrer-Policy, Permissions-Policy, COOP/CORP, CSP with `report-uri`, Argon2id, grant session revocation (verified in Plan 115).

| ID | Sev | Finding | Evidence |
|----|-----|---------|----------|
| SE1 | P2 | **Header parity drift between Worker API and Pages SPA.** Worker `Permissions-Policy` restricts 7 features; Pages `_headers` restricts only `camera/microphone/geolocation`. Pages omits `Cross-Origin-Resource-Policy` (Worker sets it). Unify into one source of truth | [security-headers.ts:26](file:///home/doit/do-epub-studio/apps/worker/src/lib/security-headers.ts#L26) vs [_headers](file:///home/doit/do-epub-studio/apps/web/public/_headers) |
| SE2 | P3 | **CSP `style-src 'unsafe-inline'`** on both Worker and Pages. Defense-in-depth weakness. Tailwind v4 + framer-motion inline styles drive this; a nonce/hash strategy would remove it | [security-headers.ts:30](file:///home/doit/do-epub-studio/apps/worker/src/lib/security-headers.ts#L30), [_headers](file:///home/doit/do-epub-studio/apps/web/public/_headers) |
| SE3 | P3 | **External font origins in CSP** (`fonts.googleapis.com`, `fonts.gstatic.com`, `api.fontshare.com`) add a third-party + privacy surface. Self-hosting fonts would let `font-src`/`style-src` drop external hosts (also helps PF/LCP) | [_headers](file:///home/doit/do-epub-studio/apps/web/public/_headers) |
| SE4 | P3 | Missing-email-binding silently falls back to logging transport (no prod alarm) | cross-ref Plan 115 M2 — [email-transport.ts:49](file:///home/doit/do-epub-studio/apps/worker/src/lib/email-transport.ts#L49) |

### 3. Lint & Lint Config

**Strong baseline:** flat config with 12 plugins incl. `security`, `jsx-a11y`, `react-compiler`, type-checked rules, all `no-unsafe-*` as errors ([eslint.config.js](file:///home/doit/do-epub-studio/eslint.config.js)).

| ID | Sev | Finding | Evidence |
|----|-----|---------|----------|
| LC1 | P2 | **Root-level configs are outside local ESLint's type-aware scope.** `apps/web/tsconfig.node.json` includes only `vite.config.ts`; `vitest.config.ts` / `playwright.config.ts` / root `*.config.*` are not in a project referenced by `projectService`, so `pnpm lint` green ≠ Codacy green (AGENTS.md documents this). Add these files to a tsconfig include (or a dedicated flat-config block) so local lint matches Codacy | [eslint.config.js](file:///home/doit/do-epub-studio/eslint.config.js), [apps/web/tsconfig.node.json](file:///home/doit/do-epub-studio/apps/web/tsconfig.node.json#L10) |
| LC2 | P3 | **No lint rule against hardcoded JSX user-facing strings** (see i18n I1). Add `eslint-plugin-i18next`/`no-literal-string` (scoped to feature components) to make i18n gaps fail lint, not slip through | [eslint.config.js](file:///home/doit/do-epub-studio/eslint.config.js) |

### 4. Build

**No defects found.** Vite 8 / Rolldown `manualChunks` with vendor + route isolation, `manifest: true`, `sourcemap: false` (prod), Turborepo DAG correct. Recommendation only: once PF1 lands, wire the budget output into the `build` job so the matrix build asserts size.

### 5. CI

**Strong baseline:** `changes` path-filter, `setup` cache, dep-scan, CodeQL gate, pre-commit, lint/typecheck/test/build on Node 22+24, e2e smoke + full, bench, performance-report, SBOM, failure notification.

| ID | Sev | Finding | Evidence |
|----|-----|---------|----------|
| CI1 | **P1** | **Lighthouse gate does not block.** LHCI step is `continue-on-error: true`; the "Process results" step prints `::error::` on failures but never `exit 1`, so the job passes regardless. This violates AGENTS.md TIER-2 #11 ("CI MUST enforce Lighthouse mobile preset with route-specific budgets") | [lighthouse.yml:50,82](file:///home/doit/do-epub-studio/.github/workflows/lighthouse.yml#L82) |
| CI2 | P2 | **No explicit mobile preset in Lighthouse config.** `.lighthouserc.json` sets resource/timing asserts but no `formFactor: mobile` / `preset`, so the run may default to desktop emulation — TIER-2 #11 requires the mobile preset | [.lighthouserc.json](file:///home/doit/do-epub-studio/.lighthouserc.json) |
| CI3 | P3 | Bundle-budget workflow is informational only (same root cause as PF1) | [bundle-size.yml:50](file:///home/doit/do-epub-studio/.github/workflows/bundle-size.yml#L50) |

### 6. Release / Dev Coding Workflow

**Strong baseline:** [release.yml](file:///home/doit/do-epub-studio/.github/workflows/release.yml) is tag-triggered, verifies (lint+typecheck+test+build) then deploys Worker + Pages, generates SBOM, installs Cosign; `release-management` skill is the mandated path; commitlint + atomic-commit + quality_gate scripts exist.

| ID | Sev | Finding | Evidence |
|----|-----|---------|----------|
| RW1 | P3 | Release `Verify` job runs on a single Node version while `ci.yml` uses a 22+24 matrix — a 24-only build/test break could pass release verify. Align release verify to the same matrix (or pin both to one supported version) | [release.yml:25-46](file:///home/doit/do-epub-studio/.github/workflows/release.yml#L25) |
| RW2 | P3 | Release deploy does not gate on the Lighthouse/bundle budgets (compounds CI1/PF1) — a perf regression can ship. Once CI1 blocks, add the budget check as a release precondition | [release.yml](file:///home/doit/do-epub-studio/.github/workflows/release.yml) |

### 7. i18n

**Strong baseline:** en/de/fr dictionaries with a parity test asserting key parity, no-empty, no-untranslated ([i18n-parity.test.ts](file:///home/doit/do-epub-studio/apps/web/src/__tests__/i18n-parity.test.ts)). **Gap:** the test only validates dictionary keys, not hardcoded JSX literals.

| ID | Sev | Finding | Evidence |
|----|-----|---------|----------|
| I1 | P2 | **Hardcoded English user-facing strings bypass i18n** (parity test can't see them): `placeholder="Add a note..."` [HighlightItem.tsx:67](file:///home/doit/do-epub-studio/apps/web/src/features/reader/components/annotations/HighlightItem.tsx#L67); `title="Add bookmark at current position"` [BookmarksPanel.tsx:53](file:///home/doit/do-epub-studio/apps/web/src/features/reader/components/bookmarks/BookmarksPanel.tsx#L53); `aria-label="Entity Type"`, `placeholder="Filter by entity ID"`, `aria-label="Date From/To"` [AuditLogPage.tsx:289-329](file:///home/doit/do-epub-studio/apps/web/src/features/admin/AuditLogPage.tsx#L289); default `placeholder = 'Write a comment...'` [CommentInput.tsx:16](file:///home/doit/do-epub-studio/apps/web/src/features/reader/components/annotations/CommentInput.tsx#L16) | Move to `t()` keys (add to all three dicts) |
| I2 | P3 | `<title>Decorative face icon</title>` in an SVG is English + redundant with a decorative graphic; mark the SVG `aria-hidden` or localize | [NotFoundPage.tsx:19](file:///home/doit/do-epub-studio/apps/web/src/features/errors/NotFoundPage.tsx#L19) |
| I3 | P3 | Enforce I1 going forward via the LC2 lint rule, so new hardcoded strings fail CI | — |

### 8. Full Responsive

**Strong baseline:** container queries (`@container`, `cq` utilities) in catalog + reader panels; Tailwind breakpoints across features; Playwright `iphone`/`pixel` projects ([playwright.config.ts:69-75](file:///home/doit/do-epub-studio/playwright.config.ts#L69)); responsive admin padding (verified in Plan 115).

| ID | Sev | Finding | Evidence |
|----|-----|---------|----------|
| R1 | P2 | **Inconsistent viewport unit: `min-h-screen` (=`100vh`) vs explicit `100dvh`.** Login/AdminLogin use `100dvh`; ReaderPage/admin/AppShell/ErrorBoundary use `min-h-screen`/`h-screen` → mobile URL-bar overlap on the latter. Standardize on `min-h-dvh`/`h-dvh` (or `dvh`) app-wide | [ReaderViewer.tsx:35](file:///home/doit/do-epub-studio/apps/web/src/features/reader/components/viewer/ReaderViewer.tsx#L35), [ReaderPage.tsx:336](file:///home/doit/do-epub-studio/apps/web/src/features/reader/ReaderPage.tsx#L336), [AppShell.tsx:87](file:///home/doit/do-epub-studio/apps/web/src/components/AppShell.tsx#L87) (cross-ref Plan 115 C1) |
| R2 | P3 | **Mobile-viewport e2e coverage is thin.** Only `app-identity-responsive` and `login-and-book-load` exercise mobile; core flows (catalog, reader annotate, admin grants/audit) run desktop-only. Add `iphone`/`pixel` runs (or `@mobile`-tagged specs) for the core flows | [apps/tests](file:///home/doit/do-epub-studio/apps/tests), [playwright.config.ts](file:///home/doit/do-epub-studio/playwright.config.ts) |

---

## Decompose — Task Clusters (recommendations only)

| Cluster | Items | Ships as |
|---------|-------|----------|
| **1 — Enforce perf gates** (highest signal) | CI1, CI2, PF1, CI3, RW2 | `ci/enforce-lighthouse-and-bundle-budgets` |
| **2 — Header parity** | SE1 (+ SE2/SE3 as follow-on) | `security/unify-worker-pages-headers` |
| **3 — i18n hardcoded strings** | I1, I2 | `fix/i18n-hardcoded-strings` |
| **4 — Lint coverage** | LC1, LC2 (+ enforces I3) | `chore/lint-config-and-no-literal-string` |
| **5 — Viewport units** | R1 | `fix/dvh-viewport-units` |
| **6 — Mobile e2e** | R2 | `test/e2e-mobile-core-flows` |
| **7 — Release alignment** | RW1 | `ci/release-verify-node-matrix` |
| **8 — Perf spikes** | PF2, PF3, SE2, SE3 | investigation (measure first) |

---

## Strategize — Priority Order

1. **Cluster 1** — CI1 is a TIER-2 #11 violation (perf gate doesn't block); fix first
2. **Cluster 4** — LC1 closes the local-vs-Codacy lint gap; LC2 unlocks Cluster 3 enforcement
3. **Cluster 3** — i18n correctness, user-visible
4. **Cluster 2** — header parity (defense-in-depth)
5. **Cluster 5 + 6** — responsive correctness + coverage
6. **Cluster 7** — release/CI alignment
7. **Cluster 8** — measure, then decide

---

## Coordinate — Ship Strategy

Independent feature branches per AGENTS.md (no `main` commits). Quality gate +
Codacy required per PR. Clusters 1/2/4/7 are config-only (low risk); Clusters
3/5/6 add or update tests with each fix.

---

## Acceptance Criteria (when executed in follow-up plans)

- [x] Lighthouse failures `exit 1` (job blocks); mobile preset/`formFactor` set; bundle budget blocking — CI1/CI2/PF1 — **PR #675**
- [x] Worker + Pages emit identical Permissions-Policy / CORP / CSP from one source — SE1 — **PR #675**
- [x] No hardcoded user-facing JSX strings; all via `t()` in en/de/fr — I1/I2 — **PRs #676, #678**
- [x] `pnpm lint` covers root configs — LC1 — **PR #675**
- [ ] `no-literal-string` (scoped) active — LC2 — **P3, still open**
- [x] App-wide `dvh` viewport units; no `100vh` mobile overlap — R1 — **PR #680**
- [ ] Core flows have mobile-viewport e2e — R2 — **P3, not blocking**
- [x] Release verify uses the same Node matrix as CI — RW1 — **PR #675**
- [x] No new Codacy issues; coverage thresholds held — **PR #738 all green**

---

## Synthesize — Headline

The repo's perf/security/lint/build/CI/release/i18n/responsive **foundations are
strong** — and Plan 114's "no Node matrix" / "CSP missing" claims are already
resolved. The one item rising to **P1 is CI1**: the Lighthouse gate prints
errors but never fails the job, so the AGENTS.md TIER-2 #11 perf budget is not
actually enforced. The remaining items are config-parity, i18n string
extraction, viewport-unit consistency, and mobile e2e depth — all small,
independent, and verifiable. No source code was changed by this plan.

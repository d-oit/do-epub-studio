# GOAP 121 — Post-Merge Summary & P3 Backlog (2026-07-09)

**Date:** 2026-07-09
**Status:** 🔄 ACTIVE — PR #744 (plan updates) + PR #745 (design cleanup) merged; consolidates remaining P3 items from Plans 114–120
**Author:** Buffy analysis session
**Methodology:** GOAP (analyze → decompose → strategize → coordinate → execute → synthesize)
**Extends:** Plans 114–120 (comprehensive audit + feature delivery cycle)

---

## Goal

Consolidate the post-merge state of the repository after the 2026-07-09 merge
session (PRs #742, #740, #743, #738, #744, #745) and produce a single prioritized backlog of
all remaining P3 items. This plan supersedes the "remaining" sections of Plans
114–120 as the single source of truth for what is left to do.

---

## Analyze — Merge Session Record (2026-07-09)

### PRs Merged (in order)

| PR | Title | Key Changes | CI |
|----|-------|-------------|-----|
| **#742** | Dev-dependencies bump (12 updates) | Resolved 5 package.json conflicts, regenerated lockfile | 23 checks green |
| **#740** | Reader-core TOC + word extraction perf | Fixed 4 Codacy issues (spread+reverse for index loops), ~23% perf improvement | 20+ checks green |
| **#743** | AGENTS.md trim (154→150 lines) | Merged TIER 4 ref bullets, combined DevOps+Workflow table row, fixed markdownlint table | Codacy green |
| **#738** | Cascade delete, cache invalidation, ConfirmDialog, dashboard, My Library, sync cleanup, offline test, storage quota, settings page | 41 files, 10 commits, 14-locale i18n, 810 tests pass | 22 checks green |
| **#744** | Plan documentation updates (plans 114–121, ADR-INDEX) | Updated 8 plans + created Plan 121 with consolidated P3 backlog | Codacy green |
| **#745** | Design cleanup: removed dead framer-motion mocks, fixed CSS duplicates, updated stale docs/skills | 16 files, 240 insertions, 404 deletions — removed 5 dead test mocks, fixed duplicate `@keyframes shimmer`, removed redundant `dark:` utilities, updated DESIGN.md + 5 skill files + evals.json + LEARNINGS.md | 20+ checks green |

### Post-Merge Baseline

| Signal | Result |
|--------|--------|
| Open PRs | **0** (after #744 + #745 merged) |
| Open GitHub Issues | **0** |
| Quality gate | ✅ Lint, Typecheck, Shellcheck all pass |
| AGENTS.md | 150 lines (meets `MAX_LINES_AGENTS_MD=150`) |
| TODO/FIXME in prod source | 0 |
| CI checks on main | All green |
| Test count | 810 web unit tests, 288 reader-core tests (framer-motion mocks removed — net dead code removal) |
| Design tokens | 113 OKLCH definitions in `globals.css` (duplicate `@keyframes shimmer` removed, `@theme` block expanded) |
| Skills | 39 in `.agents/skills/` |
| Scripts | 27 in `scripts/` |

---

## What Was Delivered (Consolidated)

### From Plans 114–117 (Audit Remediation) — ALL COMPLETE ✅

| Item | PR | Description |
|------|-----|-------------|
| B1 | already shipped | Grant session revocation on PATCH |
| CI1/CI2/PF1 | #675 | Lighthouse blocking + mobile preset + bundle budget enforce |
| U1 | #675 | Login error alert — no side-stripe |
| U2/U3 | #675 | Bounce animations removed, `--ease-out-back` token removed |
| U5 | #676 | All spinner sites use `<Spinner>` component |
| M1 | #675 | Search chapter lookup — derive href from spine iteration |
| M2 | #675 | Email transport warning when binding absent |
| R1 | #680 | Viewport units — all `100vh` → `dvh` |
| I1/I2 | #676, #678 | All hardcoded JSX strings → `t()` keys |
| SE1 | #675 | Worker + Pages header parity (Permissions-Policy/CORP) |
| LC1 | #675 | `tsconfig.node.json` covers root config files |
| RW1 | #675 | Release verify uses Node 22+24 matrix |
| B9 | #680 | Cookie Secure flag on HTTPS |
| M4 | #680, #738 | Offline restore test (highlights + comments + bookmarks) |
| E1–E4 | Plan 118 | E2E specs for catalog, upload, grants, audit |

### From Plan 120 (Missing Implementation & New Features) — Clusters 1–9 COMPLETE ✅

| Cluster | PR | Description |
|---------|-----|-------------|
| A1 — Cascade delete | #738 | DELETE handler cascades to R2 + 8 child DB tables |
| A2 — Cache invalidation | #738 | `bumpCacheVersion()` on upload-complete + PATCH |
| A3 — ConfirmDialog | #738 | Replaced `window.confirm()` with `<ConfirmDialog>` |
| N1 — Admin dashboard | #738 | `/admin` page + `GET /api/admin/stats` endpoint |
| N2 — My Library | #738 | `/library` page with progress tracking |
| A4/A5 — Sync cleanup | #738 | Documented `reading-insight` retry/cleanup path |
| A6/M4 — Offline restore | #738 | Comprehensive IndexedDB round-trip test |
| N4 — Storage quota UI | #738 | `StorageQuota` component with clear-cache guard |
| N5 — User settings | #738 | `/settings` page with reader preferences |
| F1 — LibraryBookResponse | #738 | Shared DTO in `packages/shared` |
| F2 — Audit action i18n | #738 | 11 `admin.stats.action.*` keys in 14 locales |

### From PR #740 (Reader-Core Performance) ✅

- Iterative stack-based TOC traversal (replaced recursion)
- `String.prototype.match()` instead of `matchAll()` (reduced allocations)
- ~23% performance improvement in `reanchorByText`
- Fixed 4 Codacy issues (detect-object-injection + no-unnecessary-condition)

### From PR #743 (AGENTS.md Trim) ✅

- Reduced from 154 → 150 lines (meets `MAX_LINES_AGENTS_MD=150`)
- Consolidated TIER 4 reference bullets
- Merged DevOps + Workflow rows in Skills Reference table

---

## Remaining P3 Backlog (Consolidated)

All remaining items are **P3 — non-blocking polish, tech-debt, or enhancements**.
None block release. Each is independently shippable.

### Missing Implementation / Features

| ID | Source Plan | Description | Ships as |
|----|------------|-------------|----------|
| N3 | 120 (C10) | Server-side full-text search for large EPUBs | `feat/server-side-epub-search` |
| N6 | 120 (C11) | EPUB re-export / packager (download annotated version) | `feat/epub-re-export-packager` |
| N7 | 120 (C12) | Comment reply notifications | `feat/comment-reply-notifications` |
| A6 | 115 | Offline reader fallback annotation restore (beyond progress) | `fix/offline-annotation-restore` |
| M5 | 115 | `/api/admin/audit-logs` 301 alias — document as intentional | `docs/audit-logs-alias` |

### Tech Debt / Cleanup

| ID | Source Plan | Description | Ships as |
|----|------------|-------------|----------|
| M3 | 115 | Redundant sync queue paths (legacy `annotation` vs first-class `bookmark`/`insight`) | `refactor/sync-queue-dedup` |
| F3 | 120 | Cross-isolate cache invalidation via Durable Object or KV (current `bumpCacheVersion` is per-isolate) | `perf/cross-isolate-cache-invalidation` |
| LC2 | 116 | `no-literal-string` lint rule (scoped to feature components) to enforce i18n | `chore/no-literal-string-lint-rule` |

### Design / UI Polish

| ID | Source Plan | Description | Ships as |
|----|------------|-------------|----------|
| U4 | 115 | Typography decision — commit to serif/sans pairing or document Geist as intentional | `docs/typography-decision` |
| M6 | 115 | VirtualList variable-row-height — documented non-goal, track only | — |

### Performance / Security

| ID | Source Plan | Description | Ships as |
|----|------------|-------------|----------|
| ~~P1/F1~~ | ~~115, 116~~ | ~~`framer-motion` evaluation~~ — **RESOLVED in PR #745**: framer-motion was already not installed; all dead test mocks removed, CSS-only animations are the standard |
| SE2 | 116 | CSP `style-src 'unsafe-inline'` — nonce/hash strategy | `security/csp-nonce-strategy` |
| SE3 | 116 | External font origins in CSP → self-host fonts | `security/self-host-fonts` |

### Testing

| ID | Source Plan | Description | Ships as |
|----|------------|-------------|----------|
| R2 | 116 | Mobile-viewport e2e coverage for core flows | `test/mobile-e2e-core-flows` |

---

## Strategize — Priority Recommendations

1. **U4 (Typography decision)** — Zero code, unblocks potential font work
2. **M3 (Sync queue dedup)** — Tech debt that complicates debugging
3. **R2 (Mobile e2e)** — Coverage gap for responsive correctness
4. **SE2/SE3 (CSP hardening)** — Defense-in-depth
5. **LC2 (no-literal-string lint)** — Prevents future i18n regressions
6. **N3/N6/N7 (New features)** — Enhancement, measure demand first
7. **F3 (Cross-isolate cache)** — Architecture improvement, not urgent

> **P1/F1 (framer-motion) RESOLVED** — PR #745 confirmed framer-motion was already not installed; all dead test mocks removed. CSS-only animations are the project standard.

---

## Monitor

- Re-audit after each P3 item is shipped
- Lighthouse mobile scores stable
- No new Codacy issues introduced
- `pnpm test` + `pnpm test:e2e` green
- Bundle budgets: reader 1.15MB, catalog 860KB (adjusted for new features in PR #738)

---

## Synthesize — Headline

The 2026-07-09 merge session closed the entire P1/P2 backlog from Plans 114–120.
Six PRs were merged in dependency order (#742 → #740 → #743 → #738 → #744 → #745)
with all CI green (Codacy, Build, Lighthouse, bundle budget, lint, typecheck, 810+ tests).
The repository now has **zero open PRs, zero open issues, and zero P1/P2 items**.
PR #745 closed the framer-motion P3 item (P1/F1) — the library was already removed
from source, and all dead test mocks were cleaned up. What remains is a well-defined
set of P3 polish/tech-debt/enhancement items, each independently shippable.
The platform is release-ready.

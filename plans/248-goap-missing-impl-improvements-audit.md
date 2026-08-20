# GOAP-248: Missing Implementation & Improvements Audit (Swarm)

**Status:** IN PROGRESS — analysis + execution phase 1/2/3-complete, backlog defined
**Date:** 2026-08-20
**Strategy:** Swarm (8 parallel analysis tracks) → synthesis → prioritized fix backlog
**Related:** ADR-248, ADR-083, ADR-106, ADR-181, ADR-212, ADR-214, ADR-215, ADR-218, ADR-123, ADR-217

## 1. Goal

Determine what (if anything) is missing from the implemented product surface vs
the declared contracts (PRODUCT.md, docs/api.md, ADR index, analysis backlog),
and identify evidence-backed improvements. Orchestrated with the GOAP skill as
a swarm of 8 analysis tracks, with web research for latest stack docs.

## 2. Method

- **Tools run:** `pnpm knip` (0 issues), `pnpm outdated -r` (patch-level lag
  only), `pnpm audit --prod` (0 known vulnerabilities), per-package coverage
  totals from `coverage/lcov.info`, route inventory via code search (122 Hono
  handlers), i18n parity (CI-enforced test), full SW + Vite config review.
- **Web research:** `web_search` API returned empty for every query (outage),
  so authoritative docs were fetched directly: Vite 8 guide (Rolldown bundler,
  Baseline Widely Available prod target) and React 19 release notes (Actions,
  `useActionState`, `useOptimistic`, `use`, form actions). Cloudflare D1 page
  did not extract (JS-rendered). No stack facts below contradict fetched docs.

## 3. Swarm Tracks — Results

| # | Track | Verdict | Evidence |
|---|-------|---------|----------|
| T1 | Worker API | ✅ Complete | 13 routers in `routes/index.ts`; 122 handlers incl. auth (login/lockout/recovery/MFA+passkeys/step-up), books CRUD, grants, audit, stats, insights, search, notifications, export, demo, telemetry, csp-report. Rate limiting via `RateLimiterDO` (auth 10/min, files 30/min, api 60/min) + auth lockout 5/15min + per-email/IP recovery limits (ADR-232). |
| T2 | Web UI | ✅ Complete | All PRODUCT.md flows present: login+help+recover, catalog, reader, library, settings, admin dashboard/books/grants/audit/account, offline. 14 locale catalogs with CI-enforced parity. All routes lazy-loaded with per-route skeletons; View Transitions; skip-link; semantic design tokens (ADR-063). |
| T3 | Reader-core | ✅ Complete | `epub-loader`, DOMPurify `sanitizer`, CFI `reanchor`, `fixed-layout`, `epub-accessibility`, `archive-validator`, `epub-parser.worker.ts` (thread) + `epub-parser-worker.ts` (pool, ready-handshake + fallback, #957) — dash/dot naming is the intentional Vite worker pair, not duplication. |
| T4 | Schema/shared | ✅ Complete | schema 100% lines/fns; shared 88.5%/90%; knip clean — 2026-06 backlog item "dead code in schema/shared" is resolved. |
| T5 | Security | ✅ Strong | Argon2id, session revocation on grant change, signed URLs (R2), CSP 035a/123 (self-hosted fonts, `style-src-attr`), traceId before path-length guard, ReDoS guards (ADR-034), static imports over `readFileSync`, redaction, `pnpm audit --prod` = 0 vulns. |
| T6 | Offline/PWA | ✅ Strong | SW: precache, navigation preload, quota guard + measured eviction, Background Sync, RangeRequests for EPUB, NetworkOnly for admin/access. |
| T7 | Testing | ✅ Strong | web 86.8%/82.8%, worker 83.1%/76.3%, schema 100%, shared 88.5%/90%, reader-core 89.4%/86.5%, ui 86.7%/90.4%, testkit 97.6% — all ≥ AGENTS.md thresholds. 20 E2E specs (a11y, viewport matrix, offline, panel exclusivity, traceid). |
| T8 | CI/Docs | ⚠️ Drift | 11 workflows healthy (ci, codeql, lighthouse, bundle-size, visual-regression, release, scorecard, stale-cleanup, dependabot-auto-merge, smart-update-pr, docs-validation). Several analysis/docs files are stale (F2–F6). |

## 4. Findings

### P0 — Real drift (correctness-adjacent)

- **F1 — SW still caches Google Fonts, dead since ADR-123.**
  `apps/web/src/sw.ts` registers `fonts.googleapis.com` (CacheFirst,
  `google-fonts-stylesheets`) and `fonts.gstatic.com` (CacheFirst,
  `google-fonts-webfonts`) routes and lists both prefixes in
  `EVICTABLE_PREFIXES`. Fonts were self-hosted via `@fontsource` in PR #748
  (ADR-123) and the CSP allowlist no longer contains those origins
  (`apps/web/index.html`, `globals.css` comments confirm). The routes can
  never match and the caches never populate — dead code + false eviction
  priority. Fix: remove both `registerRoute` blocks, drop both prefixes,
  add a SW test asserting no external font origins are cached (mirroring the
  existing `index.html` no-Google-Fonts test).

### P1 — Stale documentation (misleading signals for agents/auditors)

- **F2 — `analysis/error-handling-security-report.md:377`** says "Rate
  limiting - NOT IMPLEMENTED". Wrong today: DO-based rate limiter + lockout
  are implemented and tested (`__tests__/rate-limiter-do.test.ts`,
  `routes.access.test.ts`). Update or archive the report.
- **F3 — `analysis/package-versions-report.md`** (2025-09-25) documents React
  18 / Vite 7-era stack; project is on React 19 / Vite 8.2. Regenerate or
  archive.
- **F4 — `docs/api.md`** omits newer endpoints: search, notifications
  (list/unread/read/read-all), export, demo (reader/admin login), insights
  GET + sync, grants PATCH/revoke, account (password-change/sessions/logout-all/
  step-up), MFA (status/register/authenticate/passkey/recovery-codes),
  csp-report. Route inventory in §3 T1 is authoritative.
- **F5 — `analysis/SWARM_ANALYSIS.md` backlog is partially stale:** item 1
  (dead code schema/shared) resolved (knip clean); item 3 (email transport)
  implemented in code — `EMAIL_SEND` binding present in
  `apps/worker/wrangler.jsonc`, real `SendEmailTransport` with logged fallback
  (delivery requires Cloudflare dashboard provisioning, documented). Item 2
  (telemetry console-only) remains valid and awaits the ADR-217
  OpenTelemetry evaluation decision.
- **F6 — `agents-docs/KNOWN-ISSUES.md`** Playwright-browsers entry
  (2026-05-13) is likely resolved in CI (browser install step). Review and
  archive per the file's quarterly rule.

### P2 — Improvements (evaluate in separate, baseline-gated PRs)

- **F7 — TypeScript 7.0.2** (native tsgo port) is published; repo is on
  6.0.3. Major-version migration — isolate per `migration-refactoring` skill.
- **F8 — React Compiler not enabled — EVALUATED 2026-08-20, NOT adopted.**
  `eslint-plugin-react-compiler` 19.1.0-rc.2 is a devDep (lint-only). Wiring
  per plugin-react v6 requires `@rolldown/plugin-babel` + `reactCompilerPreset`
  (the `react({ babel: { plugins } })` option is ignored on Vite 8/Rolldown).
  Measured app-wide: **+8% gzipped bundle** (reader total +22.7 KB / +8.50%,
  admin entry +11.4 KB — exceeds the 100 KB lazy-chunk budget, 4 files over);
  all 1303 web unit tests still passed (correctness OK). Per ADR-248/218 the
  size regression rejects app-wide adoption; a targeted
  `compilationMode: 'annotation'` + `"use memo"` on hot reader paths remains an
  option if runtime profiling shows re-render hotspots. Config reverted; only
  the findings + learnings remain.
- **F9 — Routine patch bumps:** vitest 4.1.11, @vitest/coverage-v8 4.1.11,
  hono 4.13.3, wrangler 4.124.0, @cloudflare/workers-types 5.20260820.1,
  @cloudflare/vitest-pool-workers 0.22.0, @vitejs/plugin-react 6.1.0, vite
  8.2.2, turbo 2.10.11, uuid 14.0.2, dompurify 3.4.14, @intity/epub-js
  0.3.97, storybook 10.5.9, jest-dom 7.0.1, user-event 14.6.5, zustand
  5.0.15, typescript-eslint 8.67.0, impeccable 3.6.0, knip 6.32.2,
  rollup-plugin-visualizer 7.1.1, js-yaml 5.3.0, globals 17.11.0,
  @axe-core/playwright 4.13.0, commitlint 21.2.2, @sentry 10.70.0. Only the
  `pnpm` SHA-pinned ones need lockfile care.
- **F10 — Intentional deferrals (not bugs):** `useImportNotes.ts` is
  implemented + tested with no UI wiring (GOAP-241 decision); production email
  delivery needs dashboard provisioning; telemetry persistence awaits ADR-217.

## 5. Decomposition & Execution Plan

| Phase | Priority | Tasks | Deps | Gate |
|-------|----------|-------|------|------|
| 1. SW drift fix | P0 | F1: remove Google-Fonts SW routes + evictable prefixes; add SW no-external-fonts test | none | Worker/web tests green; lint/typecheck |
| 2. Docs freshness | P1 | F2–F6: update/archive stale reports, extend `docs/api.md` from route inventory, reconcile SWARM_ANALYSIS backlog, review KNOWN-ISSUES | Phase 1 | `scripts/check-adr-index.mjs`, markdownlint pass |
| 3. Toolchain eval | P2 | F7 (TS 7) + F8 (React Compiler) each in isolated evaluation PRs with ADR-218 baselines | ADR-248 | Baseline before/after + full quality gate |
| 4. Patch bumps | P2 | F9: dependabot-style grouped patch bump PR(s) | Phase 1–2 | CI green incl. Codacy + bundle budget |
| 5. Verification | P0 | `./scripts/quality_gate.sh`, workflow validation, `pnpm audit`, knip | All phases | All checks pass before merge |

Strategy: **Hybrid** — Phase 1 is sequential (SW change first), Phases 3/4
can run parallel after Phases 1–2 land. Swarm agents: `reader-ui-ux` /
`pwa-offline-sync` for F1, `cicd-pipeline` + docs for F2–F6,
`migration-refactoring` for F7/F8, dependabot for F9.

## 5b. Execution Record (2026-08-20, branch `feat/goap-248-swarm-fixes`)

- **F1 (P0)** ✅ Fixed: removed the two Google-Fonts CacheFirst routes + both
  evictable prefixes from `apps/web/src/sw.ts`; added a no-external-font-origin
  SW test in `sw-quota-guard.test.ts` (mirrors the CSP `index.html` test).
- **F2–F6 (P1)** ✅ Refreshed: superseded banners on
  `analysis/error-handling-security-report.md` (rate-limit + test-credential
  checklist rows corrected) and `analysis/package-versions-report.md`; extended
  `docs/api.md` with catalog, search, export, insights, notifications, demo,
  account/MFA/step-up, grants PATCH, admin insights, telemetry, csp-report,
  validate-all; reconciled `analysis/SWARM_ANALYSIS.md` backlog (items 1–2
  resolved, item 3 implemented-in-code); archived the resolved Playwright
  entry to `agents-docs/KNOWN-ISSUES-RESOLVED.md`.
- **F8 (P2)** ✅ Evaluated + rejected (measured, see finding).
- **F9 (P2)** ⏳ Not run — patch bumps remain dependabot-grouped follow-up.
- **F7 (P2)** ✅ Evaluated 2026-08-20, **deferred — not adoptable yet**. TS 7.0.2
  typecheck passes 7/7 packages after a one-line config migration (removing
  `baseUrl` from `tsconfig.base.json` — TS5102, `paths` already relative).
  **Blocker:** typescript-eslint 8.67.0 hard-errors on TS 7.0
  ("typescript-eslint does not support TS 7.0"; support tracked for TS >= 7.1,
  issue #10940), which breaks the lint gate repo-wide. Re-evaluate once
  typescript-eslint ships TS >= 7.1 support; the `baseUrl` removal is the only
  config change required.

## 6. Constraints / Human-in-the-loop

- TS 7 and React Compiler are evaluation PRs — must not be force-merged;
  require maintainer review and measured baselines.
- No production secrets or Cloudflare dashboard actions (email binding
  provisioning) are performed from code.

## 7. Learnings (record in implementation PR per Tier 2 #12)

1. Reader-core worker file pairs (`epub-parser.worker.ts` vs
   `epub-parser-worker.ts`, same for reanchor) look like duplicates but are
   the intentional thread-script / pool-manager Vite pair — never "dedupe"
   them.
2. SW drift surfaces silently: after ADR-123 self-hosted fonts, the old
   Google-Fonts caching routes stayed behind — CSP tests cover the page, not
   the SW. Add SW-origin assertions to CSP-style tests.
3. `web_search` API can return empty for all queries while `read_url` works —
   fall back to fetching authoritative doc pages directly.

## 8. Synthesis

- **No critical missing implementations found.** All PRODUCT.md flows, API
  contracts, security ADRs, offline/PWA, and i18n surfaces are implemented and
  tested; coverage exceeds every threshold; audit is clean.
- **One P0 drift item** (F1, dead SW font caching), **five stale-doc items**
  (F2–F6), and **three improvement tracks** (F7–F9) form the execution
  backlog in §5.
- ADR-248 records the prioritization policy for these findings.

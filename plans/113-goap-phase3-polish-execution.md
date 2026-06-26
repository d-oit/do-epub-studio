# Plan 113 — Phase 3 Polish Execution

**Status:** ✅ COMPLETE  
**Created:** 2026-06-26  
**Supersedes:** Plan 112 (Phase 2/4 tracker — marked SUPERSEDED)

---

## Goal
Execute remaining Phase 3 polish tasks (plan 112 rows 8-22, 26) using GOAP-orchestrated swarm of agents, fix all CI failures, update plans/ folder with new ADR and tracker.

## Policy (ADR-113)
- Per-PR permanent fix closes the corresponding KNOWN-ISSUES.md entry
- LEARNINGS.md compaction is part of every plan's "synthesize" phase
- AGENTS.md + agent skills are updated in the same plan that introduces the pattern
- Worktree-per-PR is the canonical pattern

---

## Task Tracker

| # | PR | Branch | Title | Plan Ref | Status |
|---|-----|--------|-------|----------|--------|
| 1 | [#654](https://github.com/d-oit/do-epub-studio/pull/654) | `fix/bounded-regex-sweep` | fix(shared,reader-core): use matchBounded/matchAllBounded for ReDoS safety | B2/B4 | ✅ MERGED |
| 2 | [#655](https://github.com/d-oit/do-epub-studio/pull/655) | `fix/traceid-path-length-guard` | fix(worker): add traceId to path-length guard 414 response | C1 | ✅ MERGED |
| 3 | [#656](https://github.com/d-oit/do-epub-studio/pull/656) | `fix/root-config-lint` | fix(lint): add root tsconfig.json for project service + remove unused eslint-disable | F1/F2 | ✅ MERGED |
| 4 | [#657](https://github.com/d-oit/do-epub-studio/pull/657) | `feat/security-headers-hsts` | fix(security): remove CSP override on file responses + add HSTS | B3/B5 | ✅ MERGED |
| 5 | [#658](https://github.com/d-oit/do-epub-studio/pull/658) | `fix/errorboundary-dedupe` | fix(ui): remove duplicate ErrorBoundary logging from main.tsx | C4 | ✅ MERGED |
| 6 | [#659](https://github.com/d-oit/do-epub-studio/pull/659) | `refactor/logger-migration` | fix(worker): add traceId to ad-hoc console.error/console.log calls | D2b/D2c | ✅ MERGED |
| 7 | [#660](https://github.com/d-oit/do-epub-studio/pull/660) | `feat/traceids-apiraw` | fix(web): use generated traceIds in reader search + session expiry + apiRaw logging | D3/D4 | ✅ MERGED |
| 8 | [#661](https://github.com/d-oit/do-epub-studio/pull/661) | `perf/reader-main-thread` | perf(reader): parallel chapter preload + parser timeout + search virtualization | E3/E4/E5 | ✅ MERGED |
| 9 | [#662](https://github.com/d-oit/do-epub-studio/pull/662) | `ci/lighthouse-budgets` | ci(lighthouse): add mobile preset + catalog/admin/auth/offline route budgets | E6/E7 | ✅ MERGED |
| 10 | [#664](https://github.com/d-oit/do-epub-studio/pull/664) | `fix/turbo-fixes` | fix(turbo): align build:analyze inputs with build task | G1/G2 | ✅ MERGED |
| 12 | [#663](https://github.com/d-oit/do-epub-studio/pull/663) | `refactor/static-imports` | refactor(web): use static import for app-identity.json in vite.config and tests | B7 | ✅ MERGED |
| 17 | [#665](https://github.com/d-oit/do-epub-studio/pull/665) | `docs/plan-113-tracker` | docs(plan): Plan 113 tracker + ADR-113 | — | ✅ MERGED |

---

## Deferred Tasks (Follow-up)

| Task | Plan Ref | Reason |
|------|----------|--------|
| 105-ui logical properties | 105-ui | High volume of changes across reader/admin components |
| 107 P4 e2e specs | 107 P4 | Requires new test file creation (large scope) |
| 107 P1 Storybook stories | 107 P1 | Requires new file creation |
| 107 P1/P2 coverage raises | 107 P1/P2 | Requires test coverage verification |
| 16 known-issues cleanup | T2.8 | Requires full audit of KNOWN-ISSUES.md |

---

## Acceptance Criteria
- [x] All 12 PRs merged to `main` with all required checks green
- [x] Plan 112 marked SUPERSEDED
- [x] Plan 113 active tracker
- [x] ADR-113 Accepted
- [x] ADR-INDEX.md updated (ADR-105/106/107 Accepted)

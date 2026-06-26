# GOAP 112 — Phase 2/3 Execution & CI Hardening

**Date:** 2026-06-24
**Status:** 🚧 IN PROGRESS
**Author:** Codebase analysis session 2026-06-24
**Methodology:** GOAP (analyze → decompose → strategize → coordinate → execute → synthesize)
**Related ADR:** `plans/112-adr-phase2-3-execution-policy.md`
**Consolidates:** plan 110 Phase 2/3, plan 105 Phase 3, plan 106 Phase 2/3/4/5, plan 107 all phases
**Supersedes (as execution tracker for):** the remaining unmerged items from plans 105/106/107/110

## Why this plan exists

Plan 110 verified that Phase 1 P1 items (V1–V6) shipped in PRs #638–#642
on 2026-06-24. The remaining P2 platform-modernization (V7–V12) and all
Phase 3 polish (B/C/D/E/F/G/A9–A12 from plan 105; logical properties +
scroll-snap + anchor positioning from 105-ui; coverage + e2e + DX from 107)
still need execution. Plan 112 is the single execution tracker; older
plans stay as the detailed evidence record.

## Execution status (live 2026-06-24)

| # | Task | Plan ref | Status | Branch | PR | CI |
|---|------|----------|--------|--------|----|----|
| 1 | V11 annotation import + locator-rich export | 110 V11 | ✅ DONE | feat/v11-annotation-import-export-roundtrip | #643 | pending |
| 2 | Pagination DTO + CatalogQuerySchema | 110 V7-prep | ✅ DONE | feat/v7-prep-pagination-dto | #644 | pending |
| 3 | V7 catalog pagination/search/filter backend+UI | 110 V7 | 🚧 in progress | feat/v7-catalog-pagination | — | — |
| 4 | V9 native popover for tooltips/menus | 110 V9 | ⏳ queued | — | — | — |
| 5 | V8 container queries for panels/tables | 110 V8 | ⏳ queued | — | — | — |
| 6 | V10 React 19 patterns | 110 V10 | ⏳ queued | — | — | — |
| 7 | V12 stream upload + edge cache | 110 V12 | ⏳ queued | — | — | — |
| 8 | Logical properties + scroll-snap + view-transition + anchor | 105-ui | ⏳ queued | — | — | — |
| 9 | B2/B4 ReDoS sweep | 105 B2/B4 | ⏳ queued | — | — | — |
| 10 | B3/B5 file-response security headers + HSTS | 105 B3/B5 | ⏳ queued | — | — | — |
| 11 | C1 path-length guard traceId | 105 C1 | ⏳ queued | — | — | — |
| 12 | C4 dedupe ErrorBoundary logging | 105 C4 | ⏳ queued | — | — | — |
| 13 | D2b/D2c route console → logger migration | 105 D2b/D2c | ⏳ queued | — | — | — |
| 14 | D3/D4 real trace IDs + apiRaw telemetry | 105 D3/D4 | ⏳ queued | — | — | — |
| 15 | E3/E4/E5 reanchor/parser/search perf | 105 E3/E4/E5 | ⏳ queued | — | — | — |
| 16 | E6/E7 Lighthouse mobile + per-route budgets | 105 E6/E7 | ⏳ queued | — | — | — |
| 17 | F1/F2 root-config lint + no-floating-promises | 105 F1/F2 | ⏳ queued | — | — | — |
| 18 | G1/G2 turbo build:analyze + e2e dependsOn | 105 G1/G2 | ⏳ queued | — | — | — |
| 19 | E2E specs (admin-book-crud, catalog-search, offline-conflict, reading-insights, a11y) | 107 P4 | ⏳ queued | — | — | — |
| 20 | Storybook stories (AppLogo, PageContainer, useFocusTrap) | 107 P1 | ⏳ queued | — | — | — |
| 21 | Coverage threshold raises (ui 40/30, worker 65/60) | 107 P1/P2 | ⏳ queued | — | — | — |
| 22 | B7 static imports for bundled assets | 105 B7 | ⏳ queued | — | — | — |
| 23 | Wire run-impeccable.sh into quality gate | 111 → 112 P4 | ⏳ queued | — | — | — |
| 24 | Bundle-size CI budget enforcement | 107 P5 | ⏳ queued | — | — | — |
| 25 | Markdownlint + zizmor in default gate | 107 P5 | ⏳ queued | — | — | — |
| 26 | Update KNOWN-ISSUES.md monitor-tier only | AGENTS.md T2.8 | ⏳ queued | — | — | — |

## Swarm coordination

- Orchestrator: `goap-agent` skill.
- Subagent: `general` for code work; `code-review-assistant` for review passes.
- Pattern: feature branch per task; PR per task; sequential per-PR with
  `gh pr checks` verification before next critical task; parallel where
  files do not overlap.
- Skill assignments per task are listed in `plans/112-adr-phase2-3-execution-policy.md`.

## Quality gates (every PR)

1. `pnpm --filter <pkg> typecheck` — must pass
2. `pnpm --filter <pkg> lint` — must pass (zero errors)
3. `pnpm --filter <pkg> test:unit -- --run` — all new + existing tests pass
4. `./scripts/quality_gate.sh` — full gate green locally
5. All GitHub Actions checks on the PR green (lint, typecheck, unit,
   coverage, build, e2e smoke, Codacy, CodeQL, impeccable, markdownlint,
   zizmor, lighthouse, codecov, Scorecard)
6. No `--admin` merge. No merging with any failing check.

## Synthesize (target)

- 24 independent PRs merged to `main`
- All GitHub Actions required checks green
- Plan 105/106/107/110 marked COMPLETE in their files
- LEARNINGS.md updated with new discoveries
- KNOWN-ISSUES.md updated to monitor-tier only

## Compliance

- AGENTS.md TIER-1 — fix pre-existing issues in same PR; revoke sessions
  on grant change; traceId on every Worker request; bounded regex
  (`matchBounded` / `testBounded`); semantic design tokens; no secrets;
  verify worktree branch matches PR head branch.
- AGENTS.md TIER-2 — `./scripts/quality_gate.sh`; coverage thresholds;
  use `goap-agent`; no direct `KNOWN-ISSUES.md` edits.
- ADR-083 — next ADR number after 111 is 112.

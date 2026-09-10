# GOAP Sprint — Open-Issues Execution (2026-08-29)

Slug: `goap-open-issues-execution`
Master plan: `local://goap-open-issues-execution-plan.md` (user-approved).
Issues in scope: #345, #339, #312, #314, #318, #316, #315, #317.

## Discovery (Step 0) — deviation from master plan

`gh issue list --state open` returned **empty**: all eight target issues were
already closed (`COMPLETED`) on 2026-05-26, before this sprint. Baseline was
synced with `git merge origin/main --ff-only` (15 commits). Per-issue
verification (issue body AC → code + tests on main) is recorded in
`258-goap-issue-345.md` … `265-goap-issue-317.md`.

| Issue | Body AC on main? | Evidence (grounded 2026-08-29) |
|---|---|---|
| #345 CI failure | Yes (historical) | Run 26446431433 failed 10:20:23Z 2026-05-26; issue closed COMPLETED 11:49Z same day; current main CI green (CodeQL + CI runs success on `c2c54d77`) |
| #339 ZIP bomb | Yes | `packages/reader-core/src/archive-validator.ts` (max compressed size, entry count, total uncompressed, ratio, path traversal); wired in `epub-parser.worker.ts` + `epub-parser-worker.ts`; `archive-validator.test.ts` + timeout test |
| #312 dep scanning | Yes | `ci.yml:161` `pnpm audit --audit-level=high`; SBOM `cyclonedx-npm` (`ci.yml:448`, `release.yml:242`); `.github/dependabot.yml`; `.github/workflows/scorecard.yml` |
| #314 schema consolidation | Yes | `packages/schema/src/schemas/*` is the Zod source of truth; `packages/shared/src/schemas.ts` re-exports from schema; worker routes import `@do-epub-studio/schema`; no `schema/src/locator.ts` |
| #316 OKLCH | Yes | `apps/web/src/styles/globals.css`: zero hex/rgb token literals; P3 overrides at `:142-158`; `design-tokens.test.ts` asserts `oklch(` |
| #315 View Transitions | Yes | `apps/web/src/components/ViewTransitionRoutes.tsx` (+ fallback test); `globals.css:538-563` `@layer view-transitions` + reduced-motion block |
| #317 offline E2E | Yes | `apps/tests/offline-reader.spec.ts`: 5 tests — offline reload, status transitions, cached API, queued actions, flush after reconnect |
| #318 AI plugins | **No** | Closed with comment "Plugin architecture design deferred". No interfaces, no registry, no extension points, no PoC, no doc. **Implemented this sprint: `262-goap-issue-318.md`** |

## Baseline (2026-08-29)

- `pnpm install --frozen-lockfile`, `pnpm run typecheck` → exit 0.
- `pnpm test -- --run` under local Node 26.5.0: web unit suite red
  (19 files / 183 tests — jsdom `localStorage` undefined under zustand
  persist). Same command under **Node 22.22.2 (CI matrix target)** →
  exit 0, all packages green. Pre-existing environmental red on Node 26,
  not main rot; all sprint verification runs under Node 22.22.2.
- CI on current main: CI/CodeQL/Scorecard runs conclude `success`
  (`c2c54d77`).

## Remaining work

1. Implement #318 (branch `feat/issue-318-goap-plan`, PR references the issue).
2. Closeout: full `pnpm test && pnpm test:e2e` on synced main; per-issue notes
   finalized here.

## Notes

- Plan-referenced context files `plans/020-goap-sprint-141.md` and
  `plans/007-implementation-phases.md` no longer exist (plans/ starts at 106);
  not load-bearing — noted, not blocked.
- Pre-existing dirty working tree (demo-login e2e vertical, plans/256) belongs
  to a prior session; untouched, excluded from this sprint's commits.

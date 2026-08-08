# Plan 191: GOAP — Plan 186 Remaining Items

**Status:** ✅ COMPLETED
**Date:** 2026-07-16
**Decision:** [ADR-187](187-adr-fail-closed-engineering-gates.md)
**Extends:** Plan 186
**Strategy:** Swarm — independent fixes executed in parallel
**Completed:** 2026-07-16

## Goal

Close the 5 remaining Plan 186 findings (C3, I2, C8, W7, C9) that were not
addressed by Plans 188, 189, or 190. All items share the ADR-187 fail-closed
principle: missing or unavailable evidence must not be treated as success.

## Already Completed (Plans 188–190)

| ID | Status | Evidence |
|----|--------|----------|
| I1 | ✅ | `permissions.ts:109` — `getAllCachedPermissions()` |
| W1 | ✅ | `run.sh:123-141` — verifies remote SHA |
| C1 | ✅ | `validate-workflows.sh:177` — fails on unknown SHAs |
| C2 | ✅ | `release.yml:24-108` — tag/version/ancestry/CI checks |
| W2 | ✅ | `CONTRIBUTING.md:8` — `--body` in invocation |
| W3 | ✅ | `scripts/lib/commit-types.sh` — single source of truth |
| W4 | ✅ | `quality_gate.sh` — exit 3 on skip, fail-closed |
| W5 | ✅ | `validate-workflows.sh:48-54` — exit 2 if tools unavailable |
| W6 | ✅ | `verify.sh:101-106` — exit 1 on zero checks after 60s |
| C4 | ✅ | `.lighthouserc.json` — route-specific mobile budgets |
| C5 | ✅ | CI lint is direct blocking step |
| C6 | ✅ | `ci.yml:159-168` — API errors exit 1 |
| C7 | ✅ | `scorecard.yml:45` — `upload-sarif` step |
| I3 | ✅ | `CommentsPanel.tsx:28-33` — comments not virtualized |
| I4 | ✅ | 7 worker auth test files, 994 total lines |
| I5 | ✅ | `AdminRecoverPage.test.tsx` (215L) |
| I6 | ✅ | `ci.yml:293-320` — worker-build CI job |
| I7 | ✅ | `ReaderPage.tsx` is 451 lines (< 500) |

## Remaining Tasks

### T1: C3 — Lighthouse fail-closed on deployment failure (P1)

**Problem:** `lighthouse.yml:47` uses `continue-on-error: true` on the deploy
step. If deployment fails, Lighthouse is silently skipped and the job passes.
Per ADR-187, Unavailable must block readiness.

**Fix:**
- Add a final step that fails the job when deployment failed
- Emit a clear "Lighthouse unavailable: deployment failed" error

### T2: I2 — VirtualList scrollToIndex + TableOfContents reveal (P1)

**Problem:** `TableOfContents.tsx:55-59` scrolls `activeItemRef.current` into
view, but in a virtualized list the active item is only mounted when in the
visible window. If the active chapter is outside the initial window, the ref
is null and no scroll happens.

**Fix:**
- Add `scrollToIndex` prop to `VirtualList`
- Use it in `TableOfContents` to scroll to the active chapter index

### T3: C8 — Visual regression scope expansion (P2)

**Problem:** `visual-regression.yml` only triggers on `packages/ui/**`.
Style changes in `apps/web/**` are not caught.

**Fix:**
- Add `apps/web/src/**/*.css` and `apps/web/tailwind.config.*` to paths

### T4: W7 — Gate parity manifest (P2)

**Problem:** No machine-readable manifest defines expected checks for local,
PR, and release entry points. Differences are undocumented.

**Fix:**
- Create `scripts/gate-manifest.json` with expected check IDs
- Add `scripts/validate-gate-parity.sh` that compares manifest against workflows

### T5: C9 — Docs-only CI validation (P2)

**Problem:** When only docs change, CI runs the full pipeline or skips entirely.
No lightweight validation catches broken links or structure.

**Fix:**
- Add a docs-validation job to `ci.yml` triggered on docs-only paths
- Validate Markdown structure and link integrity

## Acceptance Criteria

- [x] Lighthouse job fails (not silently passes) when deployment is unavailable
- [x] Opening TOC with a long chapter list scrolls to the active chapter
- [x] Visual regression triggers on web app style changes
- [x] Gate parity manifest exists and is validated in CI
- [x] Docs-only changes get lightweight CI validation
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm build` pass
- [x] `pnpm test:unit` passes across all packages
- [x] `./scripts/validate-workflows.sh` passes

## Task Completion Evidence

| Task | Status | Evidence |
|------|--------|----------|
| T1 (C3) | ✅ | `lighthouse.yml:72-77` — fail-closed step on deploy.outcome != 'success' |
| T2 (I2) | ✅ | `VirtualList.tsx:25,64-75` — scrollToIndex prop; `TableOfContents.tsx:146` — passes activeIndex |
| T3 (C8) | ✅ | `visual-regression.yml:9-11` — apps/web/src/**/*.css and tailwind.config.* in paths |
| T4 (W7) | ✅ | `scripts/gate-manifest.json` + `scripts/validate-gate-parity.sh` |
| T5 (C9) | ✅ | `.github/workflows/docs-validation.yml` — validates Markdown structure and links |

## Execution Strategy

**Swarm** — all 5 tasks are independent and can be executed in parallel.

| Task | Agent Type | Dependencies |
|------|-----------|-------------|
| T1 | cicd-pipeline | None |
| T2 | reader-ui-ux | None |
| T3 | cicd-pipeline | None |
| T4 | code-quality | None |
| T5 | cicd-pipeline | None |

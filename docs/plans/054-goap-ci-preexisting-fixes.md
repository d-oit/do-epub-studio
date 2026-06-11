# GOAP Plan 054: Pre-existing CI Failures Resolution

**Date:** 2026-05-26
**Status:** ✅ Closed — PR #365 merged to main at 92b8930
**Strategy:** Parallel (swarm of 3 agents)
**Related:** `docs/plans/053-goap-gap-closure-complete.md`

## Goal

Fix all pre-existing CI failures identified in Plan 053 that were blocking PR merges.

## Execution

| # | Issue | Fix | Status |
|---|-------|-----|--------|
| CI-1 | SBOM: `cyclonedx-npm` dependency tree error | Added `--ignore-npm-errors` flag to ci.yml and release.yml | ✅ Merged |
| CI-2 | Chromatic: missing `preview-stats.json` for TurboSnap | Added `--stats-json` flag to storybook build in visual-regression.yml | ✅ Merged |
| CI-3 | Scorecard: annotated tag SHA instead of commit SHA | Updated to commit SHA `f49aabe` and updated `validate-shas.sh` | ✅ Merged |

## Files Changed

| File | Change |
|------|--------|
| `.github/workflows/ci.yml` | Added `--ignore-npm-errors` to SBOM generation |
| `.github/workflows/release.yml` | Added `--ignore-npm-errors` to SBOM generation |
| `.github/workflows/visual-regression.yml` | Added `--stats-json` to storybook build |
| `.github/workflows/scorecard.yml` | Updated SHA to commit (not tag object) |
| `scripts/validate-shas.sh` | Updated allowed SHA for `ossf/scorecard-action` |

## Quality Gates

- ✅ All local quality gates passed
- ✅ PR CI: all checks passed (Lighthouse, CodeQL, main CI)
- ✅ Visual Regression: skipped (no ui package changes) — workflow syntax validated

## Learnings

- **cyclonedx-npm in pnpm monorepos**: `@cyclonedx/cyclonedx-npm` fails on pnpm monorepos where `node_modules` has extraneous/invalid packages from npm's perspective. The `--ignore-npm-errors` flag makes it tolerant of these inconsistencies while still generating valid SBOMs.
- **Storybook TurboSnap with Vite**: For Vite-based Storybook (`@storybook/react-vite`), use `--stats-json` (not `--webpack-stats-json`) to generate `preview-stats.json` for Chromatic TurboSnap.
- **GitHub Actions tag vs commit SHA**: The SHA pinned in workflows must be a commit SHA, not an annotated tag object SHA. Use `gh api repos/:owner/:repo/git/tags/:sha --jq '.object.sha'` to resolve tag objects to their actual commit.
- **validate-shas.sh dual responsibility**: The SHA validation script has both the allowed SHAs list AND the validation logic in one file. Updating the SHA in a workflow requires updating both files in sync or the local workflow validation will reject the new SHA.

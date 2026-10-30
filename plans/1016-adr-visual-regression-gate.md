# ADR-1016: Visual Regression Gate — Chromatic Against a `main` Baseline

**Date:** 2026-10-30
**Status:** Accepted
**Deciders:** Project maintainer
**Supersedes:** ADR-107 §DX-2 (visual regression baselines)
**Related:** ADR-107, ADR-187 (fail-closed engineering gates), ADR-246 (do not weaken sensors)

## Context

ADR-107 §DX-2 decided that visual-regression baselines would be "stored in
`playwright-report/baselines/` and updated via `pnpm visual:update`". That
design was never implemented:

- no `visual:update` script exists in any `package.json`;
- no `playwright-report/baselines/` directory exists;
- no Playwright assertion captures pixels — there are zero
  `toHaveScreenshot` or `toMatchSnapshot` calls under `apps/tests` or
  `packages/ui`;
- `packages/ui/package.json` never declared `@storybook/test-runner` or a
  Playwright-based snapshot runner.

What actually runs is `.github/workflows/visual-regression.yml` → Chromatic,
publishing all 70 `packages/ui` stories. That gate was decorative:

1. **It had no baseline.** The workflow triggered only on `pull_request`, so no
   build was ever published from `main`. Chromatic compares against the latest
   build on the baseline branch, so every PR reported "70 changes must be
   accepted as baselines" and the `UI Tests` status stayed pending forever —
   including PRs that changed no UI at all (#1407, #1409).
2. **It could not fail.** The action ran with `exitZeroOnChanges: true` and
   `exitOnceUploaded: true`, so the job always succeeds regardless of drift.
3. **It was not required.** Branch protection on `main` requires exactly
   `pr-title`, `commit-range`, `PR Gate (all paths)`, `Full Quality Gate`,
   `Pre-commit checks` and `CodeQL Alert Check`. `UI Tests` is absent.

Net effect: a permanently-pending status that could never fail and could never
pass, on a check nobody is required to satisfy. That is worse than no gate —
it trains reviewers to ignore the red marker (ADR-246).

## Decision

1. **Chromatic is the visual-regression mechanism.** ADR-107 §DX-2's
   Playwright-baseline design is withdrawn. Rewriting ~70 stories onto committed
   screenshot baselines would introduce cross-environment pixel flakiness
   (font rasterisation, AA) in exchange for a signal Chromatic already provides
   with per-story isolation.
2. **`main` publishes the baseline.** `visual-regression.yml` now also triggers
   on `push` to `main` over the same path filter. Chromatic treats the branch
   that publishes as the baseline, so PR runs compare against the last `main`
   build instead of reporting all stories as new. `onlyChanged: true` keeps a
   `main` run to the stories touched by that merge rather than all 70.
3. **The gate stays advisory.** It is not added to required status checks.
   Making it required would block every UI PR until a human accepts snapshots at
   chromatic.com, which is a deliberate follow-up decision, not part of this
   change. The job remains `exitZeroOnChanges: true` so a visual diff is
   reported for review rather than failing the pipeline.
4. **The gate must be able to distinguish "no change" from "changes pending".**
   That is the acceptance criterion for this ADR: after the first `main` push,
   a PR that does not touch rendered output must show `UI Tests` green, and a PR
   that does must show a non-zero, reviewable diff.

## Consequences

- Visual drift is visible on the PR that introduces it, against a real baseline,
  instead of being masked by an all-new-stories diff.
- Each qualifying merge to `main` consumes snapshots for the stories it changed.
  A Storybook-only change under `packages/ui/**` triggers a `main` run; a PR
  that touches only `apps/web/src/**/*.css` also triggers the PR-side run, and
  its merge triggers the `main`-side baseline update.
- The `UI Tests` status can now resolve to both outcomes, so it carries
  information. It still does not block merges; promoting it to a required check
  is a separate decision that depends on accepting the snapshot-review workflow.
- ADR-107 §DX-1 (bundle budget) and §DX-3/§DX-4 are untouched by this ADR.

## Verification

- `.github/workflows/visual-regression.yml` validates under zizmor and
  `scripts/validate-workflows.sh` (17/17 workflows).
- `gh api repos/d-oit/do-epub-studio/branches/main/protection` confirms the six
  required contexts listed above and that `UI Tests` is not among them.
- The absence of the ADR-107 §DX-2 design was established by searching for
  `visual:update`, `playwright-report/baselines/`, `toHaveScreenshot` and
  `toMatchSnapshot` across the repository (zero hits).

# ADR 086 — CI Failure Resolution Policy, 2026-06-12

## Status

Accepted

## Context

GitHub Actions failures were inspected with `gh` for recent `main` and PR runs. Local `lint`, `test`, `build`, and `test:coverage` gates currently pass on `main`, but CI still shows failures that require different handling.

## Decision

Classify CI failures into one of three categories before making code changes:

1. **Current `main` failures** — failures that reproduce on the latest `origin/main` and must be fixed before release.
2. **Stale PR failures** — failures from PR merge commits that no longer apply to current `main`; document them but do not spend effort fixing them unless they reproduce.
3. **Workflow hygiene failures** — lockfile drift, stale Storybook imports, or missing CI setup that should be prevented by repository policy.

## Consequences

- Reduces wasted work on stale PR failures.
- Keeps `plans/` as the source of truth for CI findings.
- Makes future CI triage faster and more consistent.
- Requires local reproduction or artifact inspection before changing production/test code.

## Findings applied

- Current `main` failure addressed: scheduled cross-browser E2E instability and accessibility contrast failures.
- Stale PR failure documented: PR 502 unit-test failures around global error logging.
- Workflow hygiene failures to prevent:
  - `ERR_PNPM_OUTDATED_LOCKFILE` from workspace dependency changes.
  - Storybook import failures from missing implementation files.
- Remaining blocker is environmental: iPhone/WebKit OS dependencies are missing in the local runner.
- Attempted `pnpm exec playwright install-deps webkit`; it failed because `sudo` required a password/non-interactive sudo was unavailable.

## Next steps

- If full local cross-browser parity is required, install WebKit OS dependencies with `pnpm exec playwright install-deps webkit`, then rerun `PLAYWRIGHT_MODE=preview pnpm test:e2e --retries=1`.
- If dependency installation is not available, keep iPhone as an environment blocker and use Chromium/Firefox targeted evidence plus passing local quality gates.
- Do not spend more effort on stale PR failures unless they reproduce on current `main`.
- Keep this policy active for future CI triage.

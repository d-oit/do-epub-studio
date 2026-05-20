# GOAP Plan 042: Resolve pnpm execution failure in CI

## Status
- **Type**: Bug Fix
- **Status**: Completed
- **Date**: 2026-05-20
- **ADR**: [ADR-042](#adr-042-fix-pnpm-execution-failure-in-github-actions)

## Analysis
The GitHub Actions workflow failed during the `cloudflare/wrangler-action` step with `pnpm` exit code 1. This is a known issue with `pnpm` v10 in certain CI environments when using older versions of `pnpm/action-setup`.

## Strategy
1. Update `pnpm/action-setup` to the latest stable version (v6.0.8) which has better support for `pnpm` v10.
2. Ensure the new SHA is added to the allowed list in `scripts/validate-shas.sh` to maintain security posture.

## Execution
1. Modified `.github/actions/setup-pnpm/action.yml` to use `pnpm/action-setup@0e279bb959325dab635dd2c09392533439d90093` (v6.0.8).
2. Updated `scripts/validate-shas.sh` to include the new SHA and remove the old one.
3. Verified via `scripts/validate-workflows.sh`.

---

## ADR-042: Fix pnpm execution failure in GitHub Actions

### Context
GitHub Actions workflows utilizing `pnpm` v10 encountered execution failures (exit code 1) during the `cloudflare/wrangler-action` step. The failure occurred when the action attempted to verify or use the `pnpm` installation.

### Decision
Update the project's centralized `setup-pnpm` composite action to use `pnpm/action-setup@v6.0.8` (SHA `0e279bb959325dab635dd2c09392533439d90093`).

### Consequences
- **Positive**: Resolves the CI blocker and enables successful deployments and Lighthouse audits.
- **Positive**: Keeps the CI environment aligned with modern `pnpm` versions.
- **Neutral**: Requires updating the allowed SHA list in the security validation script.

## Update 2026-05-20 (Post-failure analysis)
The initial fix to update `pnpm/action-setup` was correct for the first error, but a second error occurred in the `cloudflare/wrangler-action` step:
1. `tar` failed to restore `node_modules` cache with exit code 2.
2. `wrangler-action` v4.0.0 failed with "Not logged in" and incorrect pnpm paths (`.../.bin/bin/pnpm`).

### Revised decision
1. Remove the redundant `Cache node_modules` step from `.github/actions/setup-pnpm/action.yml`. `actions/setup-node` already handles pnpm caching correctly.
2. Downgrade `cloudflare/wrangler-action` to v3.15.0 (SHA `9acf94ace14e7dc412b076f2c5c20b8ce93c79cd`) which is known to be more stable with our current pnpm setup.
3. Update `scripts/validate-shas.sh` to allow v3.15.0 SHA.

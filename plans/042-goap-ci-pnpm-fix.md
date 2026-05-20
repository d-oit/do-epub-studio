# GOAP Plan 042: Resolve pnpm execution failure in CI

## Status
- **Type**: Bug Fix
- **Status**: Completed
- **Date**: 2026-05-20
- **ADR**: [ADR-042](#adr-042-fix-pnpm-execution-failure-in-github-actions)

## Analysis
The GitHub Actions workflow failed during the `cloudflare/wrangler-action` step with `pnpm` exit code 1. The root cause was a path resolution issue where the action looked for pnpm at `/home/runner/setup-pnpm/node_modules/.bin/bin/pnpm`. This was caused by an interaction between the explicit `dest` parameter in `pnpm/action-setup` and the `PNPM_HOME` environment variable.

Additionally, a redundant `node_modules` cache step was failing due to `tar` errors when handling hard links.

## Strategy
1. Upgrade `pnpm/action-setup` to v6.0.8 to support pnpm v10.
2. Simplify `.github/actions/setup-pnpm/action.yml` to remove redundant cache steps and explicit destination paths, allowing the actions to use stable defaults.
3. Upgrade `cloudflare/wrangler-action` to v4.0.0 and simplify its configuration to use the `apiToken` and `accountId` inputs directly.

## Execution
1. Modified `.github/actions/setup-pnpm/action.yml` to use `pnpm/action-setup@v6.0.8` with default settings.
2. Removed redundant `actions/cache` step from the composite action.
3. Updated `.github/workflows/lighthouse.yml` and `.github/workflows/release.yml` to use `cloudflare/wrangler-action@v4.0.0`.
4. Updated `scripts/validate-shas.sh` to include the new SHAs.
5. Verified via `scripts/validate-workflows.sh`.

---

## ADR-042: Fix pnpm execution failure in GitHub Actions

### Context
GitHub Actions workflows utilizing `pnpm` v10 encountered execution failures (exit code 1) during the `cloudflare/wrangler-action` step. The failure occurred when the action attempted to verify or use the `pnpm` installation using a corrupted path.

### Decision
Update the project's centralized `setup-pnpm` composite action to use `pnpm/action-setup@v6.0.8` and remove the custom `dest` and redundant `actions/cache` steps. Use `cloudflare/wrangler-action@v4.0.0` with simplified input configuration.

### Consequences
- **Positive**: Resolves the CI blocker and enables successful deployments.
- **Positive**: Reduces workflow maintenance by relying on action defaults and `actions/setup-node`'s built-in pnpm caching.
- **Positive**: Improves security by ensuring all actions are pinned to verified SHAs.

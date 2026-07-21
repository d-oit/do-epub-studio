# GOAP Plan 042: Resolve pnpm execution failure in CI

## Status
- **Type**: Bug Fix
- **Status**: Completed
- **Date**: 2026-05-21
- **ADR**: [ADR-042](#adr-042-fix-pnpm-execution-failure-in-github-actions)

## Analysis
The GitHub Actions workflow failed during the `cloudflare/wrangler-action` step with `pnpm` exit code 1. The root cause was a combination of corrupted pnpm paths and version conflicts between the action configuration and `package.json`.

## Strategy
1. **Enable Standalone pnpm**: Use `pnpm/action-setup@v6.0.8` with `standalone: true`. This ensures pnpm is installed as a self-contained binary, avoiding path corruption caused by `node_modules` nesting.
2. **Auto-detect Version**: Remove the explicit `version` input in the action config to let it auto-detect from `package.json`, resolving the "Multiple versions of pnpm specified" error.
3. **Clean Cache Environment**: Disable `cache: pnpm` in the composite action's `setup-node` step and remove redundant `actions/cache` to prevent `tar` errors and environment interference.
4. **Upgrade and Standardize**: Standardize on `cloudflare/wrangler-action@v4.0.0` with clean input configuration.

## Execution
1. Modified `.github/actions/setup-pnpm/action.yml` to use `pnpm/action-setup@v6.0.8` with `standalone: true` and no explicit version.
2. Removed redundant and conflicting cache steps.
3. Updated `.github/workflows/lighthouse.yml` and `.github/workflows/release.yml` to use `cloudflare/wrangler-action@v4.0.0`.
4. Updated `scripts/validate-shas.sh` to include the new SHAs.
5. Verified via `scripts/validate-workflows.sh`.

---

## ADR-042: Fix pnpm execution failure in GitHub Actions

### Context
GitHub Actions workflows utilizing `pnpm` v10 encountered execution failures during the `cloudflare/wrangler-action` step and setup jobs. Path corruption and version specification conflicts were the primary issues.

### Decision
Standardize on `pnpm/action-setup@v6.0.8` with `standalone: true` and remove redundant/conflicting settings (explicit version, node-setup cache). Use `cloudflare/wrangler-action@v4.0.0`.

### Consequences
- **Positive**: Resolves the CI blocker and enables successful deployments.
- **Positive**: Eliminates version mismatch errors and path resolution failures.
- **Positive**: Follows 2026 best practices for action versions and security pinning.

# GOAP Plan 042: Resolve pnpm execution failure in CI

## Status
- **Type**: Bug Fix
- **Status**: Completed
- **Date**: 2026-05-20
- **ADR**: [ADR-042](#adr-042-fix-pnpm-execution-failure-in-github-actions)

## Analysis
The GitHub Actions workflow failed during the `cloudflare/wrangler-action` step with `pnpm` exit code 1. The root cause was a corrupted pnpm path (`.../node_modules/.bin/bin/pnpm`) and a failing redundant cache step.

## Strategy
1. **Stabilize pnpm installation**: Use `pnpm/action-setup@v6.0.8` with `standalone: true` and `version: 10`. This ensures pnpm is installed as a global binary rather than a `node_modules` package, avoiding the bin-within-bin path issue.
2. **Remove conflicting cache**: Disable `cache: pnpm` in the composite action's `setup-node` step to prevent interference with `PNPM_HOME`. Rely on standard pnpm behavior.
3. **Simplify and Secure Actions**: Use `cloudflare/wrangler-action@v4.0.0` with clean input configuration and verified SHAs.

## Execution
1. Modified `.github/actions/setup-pnpm/action.yml` to use `pnpm/action-setup@v6.0.8` with `standalone: true`.
2. Removed redundant `actions/cache` and `cache: pnpm` from the composite action.
3. Updated `.github/workflows/lighthouse.yml` and `.github/workflows/release.yml` to use `cloudflare/wrangler-action@v4.0.0`.
4. Updated `scripts/validate-shas.sh` to include the new SHAs.
5. Verified via `scripts/validate-workflows.sh`.

---

## ADR-042: Fix pnpm execution failure in GitHub Actions

### Context
GitHub Actions workflows utilizing `pnpm` v10 encountered execution failures (exit code 1) during the `cloudflare/wrangler-action` step. The failure occurred when the action attempted to verify or use the `pnpm` installation using a corrupted path.

### Decision
Update the project's centralized `setup-pnpm` composite action to use `pnpm/action-setup@v6.0.8` with `standalone: true`. Remove the redundant and conflicting cache steps.

### Consequences
- **Positive**: Resolves the CI blocker and enables successful deployments.
- **Positive**: Eliminates `tar` cache restoration errors.
- **Positive**: Follows 2026 best practices for action versions and security pinning.

# Lighthouse / LHCI

## Status: ACTIVE

Lighthouse CI has been restored per Issue #160. The measurement targets the `/reader` route via a Cloudflare Pages preview deployment.

## Configuration

- **Config file:** `.lighthouserc.json` (project root)
- **Score thresholds:**
  - Performance: ≥0.5 (error)
  - Accessibility: ≥0.85 (error)
  - Best Practices: ≥0.8 (warning)
  - SEO: ≥0.8 (warning)

### Route-Aware Bundle Budgets

In addition to Lighthouse scores, the project enforces hard JS/CSS budget gates for critical routes.

- **Config file:** `.performance-budgets.json` (`routeBudgets` section)
- **Primary target:** Reader route (`/read/:bookSlug`)
- **Budget:** 1MB (Total transitive JS and CSS assets)
- **Enforcement:** PRs will fail CI if the reader route budget is exceeded.

## CI Workflow

- **Workflow:** `.github/workflows/lighthouse.yml`
- **Trigger:** PRs to `main` (with path filters to skip docs-only changes) + manual dispatch
- **Mode:** Advisory-only — assertion failures produce `::warning::` annotations but do not block merging
- **How it works:**
  1. Builds the web app
  2. Deploys a preview to Cloudflare Pages via wrangler-action (OIDC)
  3. Runs Lighthouse CI with 3 passes on the `/reader` URL
  4. Reports score thresholds as advisory annotations (not blocking)
  5. Comments PR with category scores and route-aware bundle sizes.

## Running Locally

### Bundle Size Analysis

```bash
# Build the web app
pnpm --filter @do-epub-studio/web build

# Run size check (including route-aware budgets)
node scripts/check-bundle-size.mjs
```

### Lighthouse Audit

```bash
# Run Lighthouse against the production URL
npx lhci collect --url=https://do-epub-studio.pages.dev/reader
npx lhci assert

# Or against local dev server (requires running API backend)
npx lhci collect --url=http://localhost:5173/reader --settings.preset=desktop
npx lhci assert
```

## Current Scores

Scores are collected on each PR via the Lighthouse workflow. Check the PR comments or the workflow run logs for the latest results.

## Historical Context

- **Issue #160:** Lighthouse / CWV re-measurement post UI/UX 2026 redesign
- **Plan 033 Group E:** Previous deferral of LHCI (archived in `docs/archive/lighthouse.md`)
- **Issue #172:** Decision to archive pending restoration

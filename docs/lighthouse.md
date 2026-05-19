# Lighthouse / LHCI

## Status: ACTIVE

Lighthouse CI has been restored per Issue #160. The measurement targets the `/reader` route via a Cloudflare Pages preview deployment.

## Configuration

- **Config file:** `.lighthouserc.json` (project root)
- **Score thresholds:**
  - Performance: ≥90 (warning)
  - Accessibility: ≥90 (error — blocking)
  - Best Practices: ≥80 (warning)
  - SEO: ≥80 (warning)

## CI Workflow

- **Workflow:** `.github/workflows/lighthouse.yml`
- **Trigger:** PRs to `main` (with path filters to skip docs-only changes) + manual dispatch
- **How it works:**
  1. Builds the web app
  2. Deploys a preview to Cloudflare Pages via wrangler-action (OIDC)
  3. Runs Lighthouse CI with 3 passes on the `/reader` URL
  4. Asserts score thresholds (accessibility is a hard error)
  5. Comments PR with category scores

## Running Locally

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

# Performance Budgets & Bundle Baseline

> Single source for bundle performance enforcement per ADR-218 (Measured
> Performance Baseline Policy) and ADR-107 (Quality/DX Standards).

## Budget Model

One authoritative model, defined in `.performance-budgets.json` under
`gzipBudgets` (main JS 180 KB, main CSS 30 KB, lazy chunks 90 KB), enforced by
`scripts/check-bundle-budget.mjs`. There is **no** separate raw-byte budget —
gzip is the single source of truth (ADR-218 D4).

Two enforcement layers:

1. **Absolute budgets** — every build must stay under `gzipBudgets` or the
   enforced CI step fails (`BUNDLE_BUDGET_FAIL_ON_VIOLATION=1`). Wired in
   `.github/workflows/bundle-size.yml` ("Enforce gzipped bundle budget") and
   the release gate (`.github/workflows/release.yml`).
2. **Baseline delta** — growth relative to a committed `bundle-baseline.json`
   (ADR-218 D5): an entry chunk growing **>10 KB gzip** or a route total
   growing **>3%** fails CI. The comparison runs inside the same enforcement
   step once a `bundle-baseline.json` exists at the repo root.

## Regenerating the Baseline

`bundle-baseline.json` is a committed, machine-generated artifact. Regenerate
it whenever a performance-relevant change intentionally grows a route bundle
beyond the delta thresholds — otherwise CI fails and reviewers see a confusing
red check.

```bash
./scripts/generate-bundle-baseline.sh    # builds web + regenerates the baseline
```

This runs `pnpm --filter @do-epub-studio/web build` then
`node scripts/bundle-baseline.mjs`, writing `bundle-baseline.json` to the repo
root. Review the diff (only bundle sizes should change), then commit the
artifact **in the same PR** as the bundle change.

> **Why this is a reviewable-diff gate, not a magic guard:** CI compares the
> PR build against the baseline committed in the PR itself, so a PR can
> regenerate the baseline and pass. That is the intended contract: bundle
> growth must appear as an explicit, reviewed baseline bump rather than hiding
> in a silent regression. It also catches unintentional drift when the
> contributor forgets to regenerate.

## Coverage

The baseline covers three routes currently: `reader`, `catalog`, `admin`
(per `routeBudgets` in `.performance-budgets.json`). **Auth and offline routes
are not baselined** — tracked as a follow-up in
`plans/221-goap-remaining-audit-items.md` (221-A1).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `bundle:budget:enforce` fails on entry chunk / total delta | Rebuild the route that grew, confirm the growth is intentional, then regenerate and commit the baseline |
| Absolute budget exceeded (not a delta) | Refactor or code-split the offending chunk; do **not** raise `gzipBudgets` without an ADR |
| `bundle-sizes` differ between local and CI | Confirm both used the same lockfile and dependency set; the generator reads the Vite build manifest, so first run `pnpm install --frozen-lockfile` and rebuild |

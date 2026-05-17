# Lighthouse / LHCI

## Status: DEFERRED (Plan 033 Group E)

Lighthouse measurement is deferred per plan 033 Group E. It can be re-enabled when a hosted preview URL is available or a mock API server is set up.

`@lhci/cli` was removed from the project dependencies because:

1. The SPA requires a running API backend — Lighthouse cannot collect meaningful data from the static dist
2. No CI workflow was configured to use it
3. The NO_FCP issue is architectural (SPA needs backend) and cannot be fixed with config changes alone

### To re-add in the future:

1. Re-install `@lhci/cli` and create `.lighthouserc.json` pointing to a deployed preview URL
2. Or serve the app with a mock API server for static Lighthouse runs
3. Or create a static landing page that Lighthouse can measure independently

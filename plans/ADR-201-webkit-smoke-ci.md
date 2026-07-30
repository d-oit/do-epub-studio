# ADR-201: WebKit in PR smoke CI

**Status:** Accepted  
**Date:** 2026-07-30

## Decision
Add WebKit to the `e2e-smoke` CI job so Safari/WebKit regressions are caught on every PR.

## Rationale
The `e2e-full` job already covers WebKit but only runs on `schedule` and `workflow_dispatch`.
Moving WebKit into smoke closes the gap where a PR could break Safari rendering and pass CI
undetected until the nightly run.

The `playwright.config.ts` already has the `webkit` project defined (gated behind
`PLAYWRIGHT_INCLUDE_WEBKIT=1`); this ADR wires that flag into the smoke job rather than
duplicating project config.

## Changes
- `e2e-smoke` job: install `chromium webkit` (was `chromium` only).
- `e2e-smoke` job: set `PLAYWRIGHT_INCLUDE_WEBKIT: '1'` at job level.
- Dev Smoke and Preview Smoke steps: add `--project=webkit` alongside `--project=chromium`.
- `timeout-minutes` bumped from 15 → 20 to accommodate the additional browser.
- Startup Performance test remains Chromium-only (metrics are browser-agnostic).

## Trade-offs
- Smoke job wall time increases by ~30–60 s.
- WebKit in CI requires the additional `playwright install --with-deps webkit` step, which
  downloads ~100 MB of system dependencies on every cold runner.
- Benefit: Safari/WebKit regressions are now surfaced on every PR, not just nightly.

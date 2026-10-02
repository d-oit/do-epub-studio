# GOAP-291: web-ui pack corrective slice — F2, F3, F5, F6, F7

**Status:** DONE (implemented + verified 2026-09-30; F3's computational CI evidence remains open by design)
**Date:** 2026-09-30
**Source:** `analysis/feature-docs-harness-audit.md` (GOAP-290 findings F2/F3/F5/F6/F7)
**Governance:** ADR-246 (do-harness completion contract; same-command parity), ADR-214 (evidence beats aspiration)
**Excluded on purpose:** F1 (creator assistance app integration) and F4
(local DB tooling/docs) need their own decisions and executable specs — this
slice does not touch product surfaces or D1 commands. F3 here covers only the
signal-set membership; the computational CI evidence it also recommends remains
open (no CI/required-check change in this plan).

## Items and acceptance

| #   | Change                                                                                                                                                                                                                        | Acceptance (from the audit)                                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F2  | New `scripts/web-ui/lib/playwright.mjs` resolves `@playwright/test` first, then `playwright`; all six `scripts/*-audit.mjs` runners and `scripts/web-ui/audit.browser.test.mjs` use it instead of importing bare `playwright` | A configured runner attempt reaches browser work instead of printing `SKIP: playwright is not installed`; unconfigured routes still SKIP/WARN and exit 0        |
| F3  | `web-ui-tests` added to the `verification` signal set in `do-harness.toml`                                                                                                                                                    | `do-harness explain --set verification` lists `web-ui-tests`                                                                                                    |
| F5  | `auditLocales` judges `dir`/`lang` after `runProbe(locale)` navigates the locale                                                                                                                                              | Regression test: en/ltr → ar/rtl produces no direction finding; a locale rendering the wrong direction is reported; Arabic last in the list is judged correctly |
| F6  | `missingMetrics()` pure helper in `perf-audit.mjs`; `scripts/perf-audit.mjs` prints a SKIP line and exits 0 instead of `OK: performance budgets met` when any route returns no usable measurements                            | Absent required measurements never yield the OK line; `evaluateBudgets` semantics unchanged (breaches and boundaries as before)                                 |
| F7  | `scripts/web-ui/lib/audit.mjs` gains 375×812; `apps/tests/viewport-matrix.ts` gains 360×800, 412×915, 820×1180, 1280×720                                                                                                      | Every existing size is retained and both matrices now cover the same 13 sizes                                                                                   |

## Verification

- `node --test scripts/web-ui/audit.test.mjs` — pure suite, including the new
  resolver, `missingMetrics`, i18n sequencing, and matrix-coverage tests.
- `node --test scripts/web-ui/audit.browser.test.mjs` — real Chromium against
  the self-served fixtures (binaries are installed in this workspace).
- Runner smoke: serve `scripts/web-ui/fixtures` and run
  `viewport-audit.mjs` (and one ES-`import`-style runner, e.g. `i18n-audit.mjs`
  with two LTR locales) over a configured route; expect browser work and an
  `OK:` line, not a false `SKIP:`.
- `do-harness explain --set verification` lists `web-ui-tests`.
- Targeted lint + prettier on every changed file; no full quality gate for
  this slice.
- No Lighthouse run (not installed/declared): the absence path is verified at
  unit level; a live Lighthouse pass is not claimed.

### Observed results (2026-09-30)

- Pure suite: **27/27 pass** (was 24; +3 guards). The F5 regression test was
  proven to fail on the pre-fix revision (throwaway copy of
  `git show HEAD:scripts/web-ui/lib/i18n-audit.mjs` reported a false `ar`
  direction finding and missed the wrong-dir `he` case; the new code reports
  exactly `he`).
- Browser suite: **1/1 pass** with real Chromium (8.4 s).
- Runner smoke against a served fixture, all six now reach browser work:
  `viewport` → `OK: viewport-ux clean across 13 cells` (13 = converged
  matrix); `i18n` (en,de) → OK; `console` → OK; `visual` → 13 cells audited
  (first run blesses baselines in a temp dir, exit 1 "new" by design);
  `perf` → `SKIP: lighthouse is not installed` after Chromium resolved.
- **F2 fallout, fixed in this slice:** `scripts/a11y-audit.mjs` used
  `browser.newPage()`, which axe-core/playwright 4.13 rejects
  ("Please use browser.newContext()"); the F2 fix unmasked it. Now uses an
  explicit context → `OK: a11y clean on 1 route(s)`. Minimal repro confirmed
  the requirement is axe-side, not page-specific.
- F6 runner branch proven live with a throwaway stubbed Lighthouse under
  `/tmp`: null metrics → `SKIP: no usable performance measurements … budgets
not evaluated` (exit 0, never the OK line); real metrics → `OK: performance
budgets met`; slow metrics → `FAIL: 4 performance budget breach(es)`
  (exit 1). No real Lighthouse run is claimed.
- `do-harness explain --set verification` now selects `web-ui-tests`.
- `eslint --max-warnings 0` and `prettier --check` clean on every changed
  file.

## Deliberate non-actions

- No CI workflow or required-check change (F3's second half stays open).
- No CSP, engine, or `qualification.ts` change; F1/F4 remain with GOAP-290's
  recommendations.

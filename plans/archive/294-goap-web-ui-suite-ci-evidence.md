# GOAP-294: CI evidence for the web-ui audit suite (F3, second half)

**Status:** DONE (implemented + verified 2026-09-30)
**Date:** 2026-09-30
**Source:** `analysis/feature-docs-harness-audit.md` F3 (GOAP-290)
**Governance:** ADR-246 (same-command parity with the do-harness sensor), ADR-286 (required status checks — not touched)

## Problem

F3 had two halves. GOAP-291 wired `web-ui-tests` into the `verification`
signal set; the second half — running the suite in CI so its green status has
computational evidence rather than a local-only claim — is still open. The
suite's own header even claimed CI "treats this path as a required check",
which is not true today.

## Decision

Add a self-contained `Web UI Audit Suite` job to `ci.yml` that installs
Chromium and runs the **identical command** the do-harness sensor runs:

```
node --test scripts/web-ui/audit.test.mjs scripts/web-ui/audit.browser.test.mjs
```

- Deliberately **not** added to the ADR-286 required-check set: promoting a
  context is a merge-policy decision for the maintainer, not a side effect of
  wiring evidence. The job runs on PRs and pushes like the other CI jobs.
- Uses only the already-pinned `actions/checkout` and the local
  `./.github/actions/setup-pnpm` action — no new third-party actions, so
  SHA-pinning/zizmor rules are unaffected.
- The browser half now genuinely runs in CI (Chromium is installed), so the
  suite's header comment is corrected to describe the actual wiring.

## Verification

- `bash scripts/validate-workflows.sh` (repo workflow validator) clean.
- `prettier --check .github/workflows/ci.yml` clean.
- The exact job command re-run locally (pure suite + real-Chromium suite).
- No change to any required-check configuration, `quality_gate.sh`, sensor
  definitions, or ADR-286 records.

## Non-actions

- No promotion to a required context (separate ADR-286 decision).
- No new secrets, permissions, or third-party actions; job-level default
  permissions unchanged.

## Observed results (2026-09-30)

- `.github/workflows/ci.yml` now carries the `Web UI Audit Suite` job
  (`needs: setup`, Chromium installed via `pnpm exec playwright install
--with-deps chromium`, then the sensor's exact `node --test` command).
- `bash scripts/validate-workflows.sh`: all 15 workflows pass actionlint +
  zizmor with no findings; `prettier --check .github/workflows/ci.yml` clean.
- The exact job command locally: 28/28 tests pass (27 pure + 1 real-Chromium
  rendered suite) in ~9.3 s.
- `scripts/web-ui/audit.browser.test.mjs` header now states the real wiring
  instead of the previously inaccurate "required check" claim.

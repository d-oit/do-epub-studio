# Plan 189: GOAP — CI Remediation Execution

**Status:** ✅ COMPLETED
**Date:** 2026-07-15
**Decision:** [ADR-187](187-adr-fail-closed-engineering-gates.md)
**Extends:** Plan 186, Plan 188
**Strategy:** Parallel — independent CI fixes
**Completed:** 2026-07-15 (PR #799 commit 3a4ef97 + this PR)

## Goal

Close the remaining Plan 186 CI and codebase findings that are actionable now:
C4 (Lighthouse routes), C6 (CodeQL error handling), C7 (Scorecard SARIF upload),
and I6 (Worker build validation). Items I4 and I5 were already resolved by prior PRs
(tests exist: session 126L, admin-middleware 216L, rate-limiter-do 183L,
AdminRecoverPage 215L). C5 was already fixed (lint is a direct blocking step).

## Tasks

### T1: Lighthouse route-specific mobile budgets (C4)
- Expand `.lighthouserc.json` with route-specific assertions for catalog, admin, auth, offline
- Update `lighthouse.yml` to audit multiple routes from deployed preview
- Add blocking mobile performance budgets per ADR-187

### T2: CodeQL API error handling (C6)
- Fix `ci.yml:157-161` to treat API errors as failure/unavailable, not zero
- Only report zero when the API call succeeds with an empty result

### T3: Scorecard SARIF upload (C7)
- Add `upload-sarif` step to `scorecard.yml` with proper permissions
- Ensure results are available for security dashboard

### T4: Worker build validation (I6)
- Add `build:worker` script to `apps/worker/package.json`
- Add CI job for Wrangler dry-run bundling validation

## Acceptance Criteria

- [x] Lighthouse audits cover /, /catalog, /admin, /reader routes
- [x] Route-specific mobile budgets are blocking (error, not warn)
- [x] CodeQL API errors fail the check instead of reporting zero
- [x] Scorecard SARIF is uploaded to GitHub Security tab
- [x] Worker build validation runs in CI without deploying
- [x] All tests pass, lint passes, typecheck passes
- [x] `./scripts/validate-workflows.sh` passes

## Task Completion Evidence

| Task | Status | Evidence |
|------|--------|----------|
| T1 | ✅ | `.lighthouserc.json` now has `matchingUrlPattern` per-route budgets for catalog, admin, auth, reader, offline |
| T2 | ✅ | `ci.yml:159-163` — API errors exit 1; `ci.yml:165-168` — malformed response exits 1 (PR #799) |
| T3 | ✅ | `scorecard.yml:45` — `upload-sarif` step with `security-events: write` permission (PR #799) |
| T4 | ✅ | `apps/worker/package.json:11` — `build:worker` script; `ci.yml:293-320` — worker-build CI job (PR #799) |

## Already Verified Resolved

| ID | Status | Evidence |
|----|--------|----------|
| I4 | ✅ | 7 worker auth test files, 994 total lines |
| I5 | ✅ | AdminRecoverPage.test.tsx (215L), notes-roundtrip.test.ts (4L) |
| C5 | ✅ | CI lint job is direct `pnpm lint` (ci.yml:221-223), no advisory pattern |

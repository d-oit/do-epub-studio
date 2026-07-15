# Plan 189: GOAP — CI Remediation Execution

**Status:** In Progress
**Date:** 2026-07-15
**Decision:** [ADR-187](187-adr-fail-closed-engineering-gates.md)
**Extends:** Plan 186, Plan 188
**Strategy:** Parallel — independent CI fixes

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

- [ ] Lighthouse audits cover /, /catalog, /admin, /reader routes
- [ ] Route-specific mobile budgets are blocking (error, not warn)
- [ ] CodeQL API errors fail the check instead of reporting zero
- [ ] Scorecard SARIF is uploaded to GitHub Security tab
- [ ] Worker build validation runs in CI without deploying
- [ ] All tests pass, lint passes, typecheck passes
- [ ] `./scripts/validate-workflows.sh` passes

## Already Verified Resolved

| ID | Status | Evidence |
|----|--------|----------|
| I4 | ✅ | 7 worker auth test files, 994 total lines |
| I5 | ✅ | AdminRecoverPage.test.tsx (215L), notes-roundtrip.test.ts (4L) |
| C5 | ✅ | CI lint job is direct `pnpm lint` (ci.yml:221-223), no advisory pattern |

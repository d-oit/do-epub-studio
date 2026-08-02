# GOAP 210: Close Remaining Logging Violation in Telemetry

**Date:** 2026-08-02
**Status:** ✅ COMPLETED
**PR:** [#894](https://github.com/d-oit/do-epub-studio/pull/894)
**Goal:** Close the remaining gap found in plans/ audit: replace 3 raw console.* calls in telemetry.ts with structured observability logging. All CI must pass.

**Related:** Plan 209 (structured logging — telemetry.ts missed)

## 1. Analysis

| ID | Gap | File | Lines | Fix |
|----|-----|------|-------|-----|
| T1 | Raw console.error/warn/log in telemetry route | `apps/worker/src/routes/telemetry.ts` | 41,43,45 | Route through `logAppInfo` from observability.ts |

### Out of Scope (Investigated, Not Actionable)
- **Plan 098 T5 (i18n @smoke tag)**: The second i18n E2E test (`locale persists after page reload`) cannot be tagged `@smoke` because it requires a running backend (localhost:8787). The E2E smoke suite only starts the Vite dev server, not the worker. The test was intentionally left without `@smoke` for this reason. Plan 098's implementation landed via a different approach (i18n-e2e-helpers.ts + i18n-rendered-text.test.ts snapshot) and is functionally complete.
- Stale unchecked boxes in archived plans 011/186 (historical, not actionable)
- Plan 106 feature completeness (marked verified-completed, unchecked boxes are stale)
- Plan 208 (schema centralization) — verified all criteria PASS
- Plan 209 (structured logging) — only telemetry.ts violation remains

## 2. Decomposition

| Task | Priority | Deps | Skill |
|------|----------|------|-------|
| T1: Fix telemetry.ts console.* calls | P1 | None | `code-quality` |
| G1: Run quality gate | P1 | T1 | — |
| G2: Create PR + address CI feedback | P1 | G1 | `github-workflow` |
| G3: Review and roast PR | P1 | G2 | `code-review-assistant` |

## 3. Execution Strategy

**Single task** — T1 is the only implementation task. G1-G3 are sequential validation/review.

## 4. Acceptance Criteria

- [x] No raw `console.*` calls remain in `apps/worker/src/routes/telemetry.ts`
- [x] All worker logging routes through `observability.ts` helpers
- [x] `./scripts/quality_gate.sh` passes
- [x] PR created and CI green — PR #894
- [x] PR reviewed and feedback addressed

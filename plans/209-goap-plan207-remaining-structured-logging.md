# GOAP 209: Close Plan 207 Remaining Structured Logging Gaps

**Date:** 2026-08-02
**Status:** IN PROGRESS
**Goal:** Close the 3 remaining Plan 207 items (L2, L3, L5) — replace raw console.* calls with structured logging in worker. All CI must pass.

**Related:** Plan 207 (missing impl cleanup), ADR-067 (observability)

## 1. Analysis

### Remaining Gaps from Plan 207 Audit

| ID | Gap | File | Line(s) | Current Code | Fix |
|----|-----|------|---------|--------------|-----|
| L2 | Raw `console.error` in admin session update failure | `apps/worker/src/auth/admin-middleware.ts` | 101 | `console.error(JSON.stringify({...}))` | Use `logRequestError` from observability |
| L3 | Raw `console.error` in rate limiter (×2) | `apps/worker/src/lib/rate-limit-client.ts` | 46, 64 | `console.error(JSON.stringify({...}))` | Use `logRequestError` from observability |
| L5 | Raw `console.log`/`console.warn` in email transport | `apps/worker/src/lib/email-transport.ts` | 17, 53 | `console.log(JSON.stringify({...}))` / `console.warn(JSON.stringify({...}))` | Use `logRequestError`/`logRequestInfo` from observability |

### Pattern to follow

The working pattern (from L1/L4 which are already implemented):
```ts
import { createRequestContext, logRequestError } from '../../lib/observability';
// ...
const ctx = createRequestContext(request);
logRequestError(ctx, err, { event: 'some.event', ...metadata });
```

For non-error logs (email transport info/warning), use `logRequestStart` or a new `logRequestInfo` if available, or log via the observability helper's `console` wrapper.

## 2. Decomposition

| Task | Priority | Deps | Skill |
|------|----------|------|-------|
| T1: Fix L2 — admin-middleware structured logging | P1 | None | `code-quality` |
| T2: Fix L3 — rate-limit-client structured logging | P1 | None | `code-quality` |
| T3: Fix L5 — email-transport structured logging | P1 | None | `code-quality` |
| G1: Run quality gate | P1 | T1-T3 | — |
| G2: Create PR + address CI feedback | P1 | G1 | `github-workflow` |
| G3: Review and roast PR | P1 | G2 | `code-review-assistant` |

## 3. Execution Strategy

**Parallel Swarm** — T1, T2, T3 are independent (different files).

### Phase 1: Implementation (Parallel)
- T1 + T2 + T3 simultaneously

### Phase 2: Validation (Sequential)
- G1: Quality gate
- G2: PR creation + CI

### Phase 3: Review (Sequential)
- G3: Roast the PR

## 4. Acceptance Criteria

- [ ] No raw `console.*` calls remain in worker source (excluding service worker, reader-core lib, test files)
- [ ] All worker logging routes through `observability.ts` helpers
- [ ] `./scripts/quality_gate.sh` passes
- [ ] PR created and CI green
- [ ] PR reviewed and feedback addressed

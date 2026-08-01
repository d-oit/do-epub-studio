# GOAP 208: Schema Centralization & Input Validation Gap Closure

**Date:** 2026-08-01
**Status:** 🔄 IN PROGRESS
**Goal:** Close remaining ADR-078 schema centralization gaps and add missing Zod validation. All CI must pass.

**Related:** ADR-078 (Zod Schema Centralization), ADR-106 (Feature Completeness), Plan 207 (missing impl cleanup)

## 1. Analysis

### Findings from Audit

| ID | Gap | Priority | Location | Fix |
|----|-----|----------|----------|-----|
| S1 | `SearchQuerySchema` defined inline in search.ts | P1 | `apps/worker/src/routes/search.ts:12-16` | Move to `packages/schema/src/schemas.ts` |
| S2 | `ExportQuerySchema` defined inline in export.ts | P1 | `apps/worker/src/routes/export.ts:12-14` | Move to `packages/schema/src/schemas.ts` |
| S3 | `HighlightUpdateSchema` derived inline in highlights.ts | P1 | `apps/worker/src/routes/reader/highlights.ts:140` | Export as standalone from schema package |
| S4 | `GET /notifications` missing Zod query validation | P1 | `apps/worker/src/routes/notifications.ts:29-31` | Add `NotificationsQuerySchema` with Zod validation |

### Out of Scope (Documented)
- Telemetry `catch {}` — intentional silent swallow (documented limitation)
- Variable-height VirtualList — explicit design decision

## 2. Decomposition

| Task | Priority | Deps | Skill |
|------|----------|------|-------|
| T1: Move SearchQuerySchema to schema package | P1 | None | `code-quality` |
| T2: Move ExportQuerySchema to schema package | P1 | None | `code-quality` |
| T3: Export HighlightUpdateSchema from schema package | P1 | None | `code-quality` |
| T4: Add NotificationsQuerySchema + zValidator | P1 | None | `cloudflare-worker-api` |
| T5: Add schema tests for new exports | P2 | T1-T3 | `testing-strategy` |
| G1: Run quality gate | P1 | T1-T5 | — |
| G2: Create PR + address CI feedback | P1 | G1 | `github-workflow` |
| G3: Review and roast PR | P1 | G2 | `code-review-assistant` |

## 3. Execution Strategy

**Parallel Swarm** — Tasks T1-T4 are independent (different files, no dependencies).

### Phase 1: Implementation (Parallel Swarm)
- T1 + T2 + T3 + T4 — all parallel

### Phase 2: Tests (Sequential)
- T5: Add schema tests

### Phase 3: Validation (Sequential)
- G1: Quality gate
- G2: Create PR, monitor CI, address feedback

### Phase 4: Review (Sequential)
- G3: Review and roast the PR

## 4. Acceptance Criteria

- [ ] All inline schemas moved to `@do-epub-studio/schema`
- [ ] `GET /notifications` uses Zod query validation
- [ ] Schema package exports all new schemas
- [ ] Tests pass for new schema exports
- [ ] `./scripts/quality_gate.sh` passes locally
- [ ] PR created and CI green

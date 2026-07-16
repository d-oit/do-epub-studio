# Plan 193: GOAP — Close Remaining Plan Statuses & Fill Documentation Gaps

**Status:** ✅ COMPLETED
**Date:** 2026-07-16
**Decision:** [ADR-187](187-adr-fail-closed-engineering-gates.md)
**Strategy:** Swarm — independent fixes executed in parallel
**Completed:** 2026-07-16

## Goal

Close the remaining "In Progress" plan statuses and fill the documentation gaps
from Plan 063 Wave 2 that are still actionable. All Plan 191 tasks were verified
as implemented in the codebase; Plan 100 coverage work is complete; and many
Plan 063 Wave 2 items were resolved by Plans 100, 189, 190, and 192.

## Already Resolved (Plan 063 Wave 2 Items)

| ID | Status | Resolved By |
|----|--------|-------------|
| F4 | ✅ | Plan 190 — offline comment status mutations |
| U1 | ✅ | main.tsx — ToastProvider integrated |
| U3 | ✅ | App.tsx — OfflineIndicator component |
| U4 | ✅ | App.tsx — NotFoundPage + catch-all route |
| T3 | ✅ | Plan 100 — UI component tests added |
| T5 | ✅ | Plan 100 — schema coverage 44% → 98.3% |
| I2 | ✅ | Plan 192 — formatDate i18n with dynamic locale |
| P1 | ✅ | Plan 189 — Lighthouse route-specific mobile budgets |
| C5 | ✅ | AppShell.tsx — `<main>`, `<header>`, `<nav>` landmarks |

## Remaining Tasks

### T1: Create docs/accessibility.md (D1) — P1
- Document the project's accessibility approach: WCAG 2.1 AA target
- Cover axe-core audits, ARIA patterns, focus management, LiveRegion
- Reference coding-guide §8

### T2: Create docs/api.md (D2) — P1
- Document the Worker API routes and authentication flow
- Cover reader, admin, and auth endpoints

### T3: Create docs/setup-cloudflare.md (D3) — P1
- Document Cloudflare Pages + Workers deployment setup
- Reference wrangler.toml configuration

### T4: Create docs/setup-turso.md (D3) — P1
- Document Turso database setup for local development
- Reference schema migrations workflow

### T5: Create Storybook README (D5) — P1
- Document how to run, develop, and contribute stories
- Reference existing stories in `packages/ui/src/__stories__/`

### T6: Update Plan 191 status to COMPLETED
- Verify all acceptance criteria checked
- Add completion evidence table

### T7: Update Plan 100 status to COMPLETED
- Phase 1 and Phase 2 both merged
- All coverage targets exceeded

### T8: Update Plan 063 Wave 2 status
- Mark resolved items with evidence
- Document remaining Wave 2/3 items for future tracking

## Acceptance Criteria

- [x] docs/accessibility.md exists and covers axe-core, ARIA, focus management
- [x] docs/api.md exists and covers Worker API routes
- [x] docs/setup-cloudflare.md exists
- [x] docs/setup-turso.md exists
- [x] packages/ui/README.md (Storybook) updated
- [x] Plan 191 status = COMPLETED with evidence
- [x] Plan 100 status = COMPLETED
- [x] Plan 063 Wave 2 audit updated
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm build` pass
- [x] `./scripts/validate-workflows.sh` passes (11/11)

## Task Completion Evidence

| Task | Status | Evidence |
|------|--------|----------|
| T1 (D1) | ✅ | `docs/accessibility.md` — axe-core, ARIA landmarks, focus management, touch targets, reduced motion |
| T2 (D2) | ✅ | `docs/api.md` — auth, reader, admin, sync endpoints with error responses |
| T3 (D3a) | ✅ | `docs/setup-cloudflare.md` — Pages + Workers setup, local dev, deployment |
| T4 (D3b) | ✅ | `docs/setup-turso.md` — Turso CLI, local dev, schema, migrations |
| T5 (D5) | ✅ | `packages/ui/README.md` — Storybook section with stories list, conventions, CI |
| T6 | ✅ | `plans/191-goap-plan-186-remaining-items.md` — Status COMPLETED, all criteria checked |
| T7 | ✅ | `plans/100-coverage-improvement-progress.md` — Status COMPLETED |
| T8 | ✅ | `plans/063-goap-comprehensive-audit-2026-05-30.md` — Wave 2: 14/32 items resolved |

## Remaining Wave 2 Items (Not in Scope)

| ID | Category | Reason Deferred |
|----|----------|----------------|
| F2 | Search within book | Large scope — needs dedicated plan |
| F3 | Export notes | Needs ADR for API design |
| F5 | Book delete cascade | Needs ADR for data safety |
| D4 | JSDoc coverage | Incremental — can be added per-file |
| T4 | safe-regex tests | Dedicated testing sprint |
| L1-L3 | Logging improvements | Incremental — traceId additions |
| E2-E4 | Error handling | Incremental — per-component |
| N2-N3 | Navigation features | Needs UX design |
| C1,C3,C4 | Accessibility polish | Needs visual verification |
| P2 | Memory leak triage | Needs profiling session |
| I1 | i18n parity audit | Needs manual review |

## Execution Strategy

**Swarm** — all tasks are independent and can be executed in parallel.

| Task | Agent Type | Dependencies |
|------|-----------|-------------|
| T1-T5 | code-quality (docs) | None |
| T6-T8 | goap-agent | None |

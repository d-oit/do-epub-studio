# GOAP 107 — Quality, Testing & Developer Experience Improvements

**Date:** 2026-06-23
**Status:** ✅ COMPLETED (verified 2026-07-18 — all actionable items implemented)
**Execution tracker:** consolidated & re-verified in `plans/110-goap-missing-impl-modern-ui-2026-06-24.md`; **final verification in `plans/197`**
**Author:** Codebase analysis session
**Methodology:** GOAP (analyze → decompose → strategize → coordinate → execute → synthesize)
**Related ADR:** `plans/107-adr-quality-dx-standards.md`
**Extends:** ADR-021 (Test Infrastructure), ADR-022 (Coverage/Benchmarking), Plan 100 (coverage progress)

## Goal

Close testing gaps, improve developer experience tooling, and establish
quality patterns that reduce regression risk as features from plans
105-106 ship.

## Analysis — Current State

### Test Coverage Status (from coverage thresholds)

| Package | Threshold (L/F) | Observed | Gap |
|---------|-----------------|----------|-----|
| `web` | 55% / 48% | ~76% | Above threshold but admin components below 50% |
| `worker` | 55% / 50% | Passing | Missing tests for insights, highlights routes |
| `shared` | 40% / 50% | Passing | Minimal — only schemas and validators tested |
| `reader-core` | 72% / 70% | Passing | Well-tested (property tests + fixtures) |
| `schema` | 15% / 5% | Passing | Very low bar; migrations untested |
| `ui` | 10% / 5% | Passing | Very low bar; only basic render tests |

### Missing Test Coverage (specific gaps)

| Area | File/Feature | What's Missing |
|------|-------------|----------------|
| Worker routes | `routes/reader/insights.ts` | No dedicated route test beyond integration |
| Worker routes | `routes/reader/highlights.ts` | Partial test (`routes.bookmarks.test.ts` covers similar) |
| Web features | `features/catalog/CatalogPage.tsx` | Only 1 basic test in `__tests__/catalog-page.test.tsx` |
| Web features | `features/reader/components/info/InfoPanel.tsx` | Test exists but no keyboard nav testing |
| Web features | `features/admin/AuditLogPage.tsx` | Has test but no pagination/filter testing |
| Web hooks | `hooks/useThemeSync.ts` | No dedicated test file |
| UI package | Most components | Render-only tests; no interaction/a11y testing |
| Shared | `dtos.ts`, `errors.ts`, `telemetry.ts` | Property tests exist but no edge-case unit tests |

### Missing E2E Test Flows

| User Flow | Existing Coverage | Gap |
|-----------|------------------|-----|
| Book upload + read | `login-and-book-load.spec.ts` | No upload flow tested |
| Annotation lifecycle | `reader-annotations-and-admin.spec.ts` | No export/delete |
| Offline → online sync | `offline-reader.spec.ts` | No conflict resolution e2e |
| Admin book CRUD | None | No e2e for create/edit/delete book |
| Catalog browsing | None | No e2e for search/filter/paginate |
| Reading insights | None | No e2e for viewing insights |

### DX Improvements Needed

| Area | Current State | Improvement |
|------|---------------|-------------|
| **Storybook** | 12 stories in `packages/ui` | Missing stories for app-level components (Drawer, AppShell, ThemeToggle) |
| **Type generation** | Manual DTO types | No auto-generated API client types from worker routes |
| **Dev error overlay** | Vite default | No custom error boundary with stack trace + quick links |
| **Hot module state** | Standard HMR | Zustand stores lose state on HMR in some cases |
| **Visual regression** | `visual-regression.yml` workflow exists | No baseline snapshots committed |
| **Bundle analysis** | `check-bundle-size.mjs` exists | No CI budget enforcement (only script) |
| **Monorepo linking** | Turborepo | No `turbo gen` for scaffolding new packages/features |

## Decomposed Tasks

### Phase 1 — Raise UI Package Quality (1 session)

1. Add interaction tests (click, keyboard, focus) to all UI components
2. Add `axe-core` accessibility assertions to component tests
3. Add missing Storybook stories: AppLogo variants, PageContainer, useFocusTrap demo
4. Raise `ui` coverage threshold to 40% Lines / 30% Functions

### Phase 2 — Worker Route Test Completeness (1 session)

5. Add `routes.highlights.test.ts` with full CRUD coverage
6. Add `routes.insights.test.ts` with auth + tenant isolation assertions
7. Add cascade-delete test for `DELETE /api/books/:id`
8. Add pagination test for catalog route
9. Raise `worker` coverage threshold to 65% / 60%

### Phase 3 — Web Feature Tests (1-2 sessions)

10. Add `useThemeSync.test.ts` hook test
11. Add CatalogPage search/filter tests (when UI exists from plan 106)
12. Add AuditLogPage pagination + filter tests
13. Add InfoPanel keyboard navigation tests
14. Add BooksPage delete confirmation flow test

### Phase 4 — E2E Expansion (2 sessions)

15. Add `admin-book-crud.spec.ts` — create, edit, delete book
16. Add `catalog-search.spec.ts` — search, filter, paginate
17. Add `offline-conflict-resolution.spec.ts` — edit same annotation in two tabs
18. Add `reading-insights.spec.ts` — view reading stats
19. Update `accessibility-audit.spec.ts` with new pages

### Phase 5 — DX Tooling (1 session)

20. Add `turbo gen` scaffold template for new features
21. Add bundle size CI budget enforcement (fail CI if > threshold)
22. Add visual regression baseline snapshots
23. Add API type generation from Hono routes (typed RPC or OpenAPI extract)
24. Document local dev workflow improvements in `docs/setup-local.md`

## Risks

- Raising coverage thresholds may initially block CI — mitigate by shipping
  tests before threshold bump
- E2E tests for offline flows are inherently flaky — use Playwright
  network emulation with retry logic
- Visual regression baselines need periodic updates — add to release process

## Success Criteria

- [ ] `packages/ui` coverage ≥ 40% Lines
- [ ] `apps/worker` coverage ≥ 65% Lines
- [ ] All UI components have axe-core accessibility assertions
- [ ] At least 3 new e2e specs covering admin, catalog, and offline flows
- [ ] Bundle size CI check enforced (PR fails if exceeds budget)
- [ ] Storybook has stories for all exported UI components

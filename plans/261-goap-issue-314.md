# GOAP-314 — Schema Consolidation

Issue: [#314](https://github.com/d-oit/do-epub-studio/issues/314) — CLOSED 2026-05-26 (COMPLETED)
Status: **Implemented on main; verified this sprint.**

## Goal

Make `@do-epub-studio/schema` the single source of truth for Zod schemas/DTOs;
remove the duplicated locator from the schema package; clarify package boundaries.

## ADR

- **Chosen (as implemented)**: consolidation into `packages/schema/src/schemas/`
  (annotation, auth, books, common, grants, insights, mfa, password, queries,
  telemetry, …) with DB migrations colocated in `packages/schema/migrations/`
  (0001–0012). `packages/shared/src/schemas.ts` is now a re-export facade only
  (65 lines, no zod definitions remain in shared — grepped 2026-08-29). Worker
  routes import `@do-epub-studio/schema` directly (`routes/access.ts`,
  `routes/catalog.ts`, `routes/search.ts`, `routes/reader/insights.ts`,
  `routes/reader/highlights.ts`, `routes/notifications.ts`, …). The duplicate
  `schema/src/locator.ts` is gone; CFI/locator *types* remain as data schemas in
  the schema package while the locator *implementation* stays in
  `packages/reader-core/src/locator.ts`.
- **Rejected**: moving the reader-core locator implementation into the schema
  package (runtime code, not a validation concern — keeps reader-core
  self-contained).

## Acceptance → Evidence

| Acceptance | Evidence |
|---|---|
| Single source of truth for schemas | `packages/schema/src/schemas/*` + `packages/schema/src/__tests__/*` (e.g. `enums-locators.test.ts`, `annotations.test.ts`) |
| No duplicate locator code | no `locator.ts` in `packages/schema/src/` (2026-08-29); `reader-core/src/locator.ts` is the sole implementation |
| Clear package boundaries | `shared/src/schemas.ts` = re-export facade; no `zod` imports in shared outside it |
| All tests pass | schema + worker suites in sprint baseline run (2026-08-29) |

## Effort

M–L (historical; verification only this sprint).

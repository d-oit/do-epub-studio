# GOAP-240: Vitest 4 & Vite 8 Deprecation Migration

**Date:** 2026-08-14
**Status:** ✅ COMPLETED (merged as PR #982, commit ef95519)
**Baseline:** `main` @ `051b5fc` (post GOAP-239, PRs #980/#981)
**Related:** ADR-216 (Vitest pool policy); ADR-105b (error/observability completeness); docs/conventions.md

## Goal

Clear the recurring Vitest 4 / Vite 8 deprecation warnings seen on every test/build
run without changing test isolation semantics. Warnings were the ones engineers see
daily, so the fix is user-visible hygiene.

## Analysis (scout-verified)

- `apps/web/vitest.config.ts` is the ONLY config using the deprecated patterns:
  - `path.resolve(__dirname, …)` under `configLoader: 'native'` → use `import.meta.dirname`
  - `test.poolOptions.forks.singleFork: false` → **removed entirely in Vitest 4** (option no longer
    exists in the type surface); forks default to one file per process, so removing it preserves the
    ADR-216 isolation guarantee. `pool: 'forks'` + `isolate: true` retained.
- `apps/web/vite.config.ts` had the same class of `configLoader`/`__dirname` warnings:
  - `__dirname` alias → `import.meta.dirname`
  - JSON imports (`app-identity.json`, `package.json`) lacked attributes → `with { type: 'json' }`
- Other package configs (worker/shared/reader-core/ui/schema/testkit) carry no deprecated options.

## Implementation (2 files)

| File | Change |
| --- | --- |
| `apps/web/vitest.config.ts` | `__dirname` → `import.meta.dirname`; drop `poolOptions.forks.singleFork`; comment documents Vitest-4 removal + ADR-216 compliance |
| `apps/web/vite.config.ts` | `__dirname` → `import.meta.dirname`; add `with { type: 'json' }` to both JSON imports |

Out of scope (deferred): `inlineDynamicImports` deprecation — emitted by a rolldown/plugin
default, not set in any tracked config; Vite/rolldown internal, tracked separately.

## Acceptance Criteria

- [ ] `pnpm test` output shows NO `DEPRECATED test.poolOptions` or `configLoader`/`__dirname`/`JSON import` warnings; all package suites green (worker 419, web 1279, schema 147, shared 130, reader-core 357, ui 141, testkit 41).
- [ ] `pnpm build` (web + worker) succeeds with no `__dirname`/`configLoader`/JSON-import warnings.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm knip`, `scripts/dead-code-check.sh` green.
- [ ] Full CI green on the PR; no regressions.

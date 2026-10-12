# ADR-300: Typecheck scope — root config vs. package configs, and strictness parity

> **Status:** Accepted (2026-10-02)
> **Supersedes:** none
> **Related:** `plans/301-goap-strictness-parity.md`, `plans/ADR-INDEX.md`,
> ADR-083 (numbering), ADR-024 (warning management)
> **Deciders:** maintainers
> **Tags:** tooling, governance, typecheck

## Context

A root-level `tsc --noEmit` (the ad-hoc command an editor or an author reaches
for first) reported **374** errors across the repository while every gated
command was green: `turbo run typecheck` (per package), `turbo run lint`, and
all unit suites passed.

The root `tsconfig.json` extends `tsconfig.base.json` and swept `**/*.ts`,
`**/*.tsx`, `**/*.js`, `**/*.jsx`. That produced three classes of phantom
findings:

1. **Conflicting options.** `tsconfig.base.json` enables
   `noUncheckedIndexedAccess`; `apps/web/tsconfig.json` and
   `apps/worker/tsconfig.json` are standalone (they do not extend the base) and
   deliberately run without it. The same files were therefore checked twice
   under different rules, and the stricter run — which no gate performs —
   reported ~260 findings.
2. **Missing test types.** The root config had no `types` field, so
   `vitest/globals`-based test files resolved differently than under the
   package configs that declare them.
3. **Build output.** `apps/web/dist/**` was type-checked, mixing generated
   bundles into the sweep.

Meanwhile `apps/tests/` (Playwright e2e specs) and `scripts/` have **no
package tsconfig of their own**, so they were only ever checked by that same
broken sweep — and CI's only root vitest invocation is
`pnpm vitest run scripts/__tests__` (ci.yml).

A second, unrelated artefact: `vitest.workspace.ts` imported `defineWorkspace`,
removed in vitest 4 (installed: 4.1.11). The file could not load, nothing
referenced it except turbo cache `inputs` and a knip comment, and no package
test lane used it.

## Decision

1. **The root `tsconfig.json` owns root-owned code only**: `*.ts` at the repo
   root, `scripts/**/*.ts`, `apps/tests/**/*.ts`, with `types: ["node"]` and
   `exclude` covering `node_modules`, `**/dist/**`, `**/coverage/**`,
   `**/playwright-report/**`. Its job is to type-check the code that has no
   package config; `tsc --noEmit` at the root is expected to be clean.
2. **Each workspace package's tsconfig is authoritative for its sources**, and
   is executed by `turbo run typecheck`. The root sweep must not re-check those
   packages under different options — a stricter second opinion that no gate
   runs is noise, and noise is what let real errors in `scripts/` and
   `apps/tests/` sit unnoticed.
3. **`vitest.workspace.ts` is deleted.** Vitest 4 removed `defineWorkspace` and
   the workspace-file mechanism; per-package `vitest.config.ts` files are the
   source of truth, and the root only ever runs the `scripts/__tests__` lane.
   Turbo's `test:unit`/`test:coverage` inputs no longer list it.
4. **Strictness parity is adopted, with package-local overrides (GOAP-301,
   DONE).** `tsconfig.base.json` enables `noUncheckedIndexedAccess`;
   `apps/web` and `apps/worker` do not inherit the base (they need their own
   `lib`, `jsx`, `types` and JSX settings), so they now set the flag directly:
   `"noUncheckedIndexedAccess": true` in `apps/web/tsconfig.json` and
   `apps/worker/tsconfig.json`. Enabling it surfaced 247 findings (20 in
   package source, 227 in tests — `arr[0]` / `record[key]` reads typed
   `T | undefined`), all fixed in that slice; the test fixes use optional
   chaining on assertions and a `defined(value, name?)` helper
   (`src/__tests__/helpers.ts` in both packages) where a missing element should
   fail the test loudly rather than travel as `undefined`.

## Consequences

- Root `tsc --noEmit` is clean and meaningful: it now catches real errors in
  the e2e suite and the helper scripts (this change set fixed 20 of them plus
  34 in `scripts/__tests__`).
- Editors opening a file under `apps/web/**` or `apps/worker/**` use the
  package tsconfig (nearest config wins), so DX is unchanged.
- Both app packages now enforce `noUncheckedIndexedAccess` (GOAP-301), so the
  strictness the base config intended applies to every package that compiles
  application source; the parity gap this ADR recorded at filing time is closed.
- The config itself carries no inline comments: the pre-commit `check-json`
  hook requires strict JSON, so this ADR is the place for the rationale.
- No CI lane is added here: `scripts/__tests__` already runs in ci.yml, and
  GOAP-301 chose to enforce parity through the existing per-package typecheck
  jobs rather than a new root job — a root sweep would re-create the conflicting
  options this ADR removed.

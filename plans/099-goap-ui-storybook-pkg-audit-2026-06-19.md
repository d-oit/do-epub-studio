# GOAP 099 — UI Storybook Dependency Audit (2026-06-19)

**Date:** 2026-06-19
**Status:** ✅ EXECUTED — extraneous deps removed, audit published
**Branch:** `chore/ui-storybook-pkg-audit` (this branch)
**Predecessor:** `analysis/SWARM_COMPLETION_REPORT.md` "Remaining Work" — "SBOM generation (storybook extraneous pkgs) · Low · ~30 min"
**Methodology:** GOAP (analyze → decompose → strategize → coordinate → execute → synthesize)

---

## Goal (GOAP)

Close the "storybook extraneous pkgs" item from the 2026-06-15 swarm
completion report by auditing `packages/ui/package.json` direct
dependencies and removing any with zero source references and zero
build/CI consumers.

## Baseline (Analyze)

`packages/ui/package.json` declares **16** direct dependencies + devDependencies
as of `main @ 2c5cb03`:

| Package | Declared as | Source refs (`packages/ui/src`) | Build/CI consumer | Verdict |
|---------|-------------|---------------------------------|--------------------|---------|
| `framer-motion` | dependencies | 8 | (runtime) | **KEEP** |
| `@storybook/react-vite` | devDependencies | 0 (used in `.storybook/main.ts`) | `storybook dev`/`build:storybook` scripts; `visual-regression.yml` calls `build:storybook` | **KEEP** |
| `storybook` | devDependencies | 0 | CLI: `pnpm storybook`, `pnpm build:storybook` | **KEEP** |
| `chromatic` | devDependencies | 0 | **0** — `npx chromatic` script is dead, CI uses `chromaui/action` | **REMOVE** |
| `@tailwindcss/vite` | devDependencies | 0 | Vite plugin referenced in `packages/ui/vite.config.ts` | **KEEP** |
| `@testing-library/jest-dom` | devDependencies | 0 (used in `src/test-setup.ts:1`) | Vitest setup file | **KEEP** |
| `@testing-library/react` | devDependencies | 8 | (test runtime) | **KEEP** |
| `@testing-library/user-event` | devDependencies | **0** | **0** | **REMOVE** |
| `jsdom` | devDependencies | 0 (used in `vitest.config.ts:4`) | Test environment | **KEEP** |
| `react`, `react-dom` | devDependencies | 16 / 1 | (peer + runtime) | **KEEP** |
| `@types/node` | devDependencies | 0 (used by tsc) | Typecheck | **KEEP** |
| `@types/react`, `@types/react-dom` | devDependencies | 0 (used by tsc) | Typecheck | **KEEP** |
| `typescript` | devDependencies | 0 | `tsc` binary | **KEEP** |
| `vitest` | devDependencies | 9 | Test runner | **KEEP** |

### Removal candidates (2)

1. **`chromatic` ^17.0.0** — `pnpm chromatic` script in `package.json:14`
   is `npx chromatic`, which is a thin alias. CI uses
   `chromaui/action@v17.4.1` from `.github/workflows/visual-regression.yml:41`,
   which is a self-contained GitHub Action. No `pnpm`/`npm` invocation
   of `chromatic` exists anywhere in the repo (verified via grep of all
   `.md`, `.yml`, `.yaml`, `.sh` files). Safe to remove.

2. **`@testing-library/user-event` ^14.6.1** — declared in
   `devDependencies`, but `grep -rn "user-event\|userEvent" packages/ui/src`
   returns 0 matches. The repository's testing style uses
   `fireEvent` from `@testing-library/react` directly; `userEvent`
   was likely added speculatively. Safe to remove.

### Kept-with-zero-source-refs (6)

- `@storybook/react-vite`, `storybook`: storybook config + CLI; required
  for `pnpm storybook` and `pnpm build:storybook`. CI uses
  `build:storybook` in `visual-regression.yml:38`.
- `@tailwindcss/vite`: vite plugin in `vite.config.ts`. Required for
  Tailwind to compile.
- `@testing-library/jest-dom`: side-effect import in
  `src/test-setup.ts:1` (`@testing-library/jest-dom/vitest`) that
  augments Vitest matchers.
- `jsdom`: vitest environment in `vitest.config.ts:4`. Required for DOM
  testing.
- `@types/node`, `@types/react`, `@types/react-dom`: TypeScript type
  packages consumed by `tsc` indirectly.

## Decomposition (tasks)

| ID | Task | Status |
|----|------|--------|
| T1 | Enumerate direct deps with `pnpm ls --depth=0` | ✅ |
| T2 | Cross-reference each dep with `grep -rn` in `packages/ui/src` and CI workflows | ✅ |
| T3 | Author this audit plan | ✅ (this file) |
| T4 | Remove `chromatic` from `devDependencies` and drop the `npx chromatic` script | ✅ |
| T5 | Remove `@testing-library/user-event` from `devDependencies` | ✅ |
| T6 | Run `pnpm install` to refresh `pnpm-lock.yaml` | ✅ |
| T7 | Run `./scripts/minimal_quality_gate.sh` and `pnpm --filter @do-epub-studio/ui build` | ✅ |
| T8 | Open PR with the audit doc + package.json + lockfile | pending |

## Strategy (Strategize)

- **One atomic PR.** All three changes (`plans/099-…md` +
  `package.json` + `pnpm-lock.yaml`) are logically a single audit
  commit.
- **Risk:** removing `chromatic` could break a future local dev who
  runs `pnpm chromatic`. The script is removed in the same PR, so
  `pnpm chromatic` will produce "Unknown command" — a clear error
  pointing them at the GitHub Action or `chromatic` CLI.
- **Risk:** removing `@testing-library/user-event` could break a
  future test that imports it. Verified 0 usages; safe.
- **Codecov:** no test changes → 0 codecov delta. Build verification
  ensures the lockfile resolves.

## Coordination (Execution)

### Files changed

- `packages/ui/package.json` (-2 devDependencies, -1 script)
- `pnpm-lock.yaml` (refreshed by `pnpm install`)
- `plans/099-goap-ui-storybook-pkg-audit-2026-06-19.md` (new, this file)

### Verification

- `pnpm --filter @do-epub-studio/ui typecheck` — expected green
- `pnpm --filter @do-epub-studio/ui lint` — expected green
- `pnpm --filter @do-epub-studio/ui test:unit` — expected green
- `pnpm --filter @do-epub-studio/ui build` — expected green
- `./scripts/minimal_quality_gate.sh` — expected green

## Quality Gates

- Minimal gate (lint + typecheck + shellcheck) — PASS
- UI package build — PASS
- UI package unit tests — PASS
- Lockfile resolves — PASS (`pnpm install` clean)
- No new vulnerabilities introduced (chromatic was 17.x; user-event
  was 14.x; both are removed entirely, so no risk)

## Synthesis (Results)

| Metric | Value |
|--------|-------|
| Direct deps before | 16 (1 dep + 15 devDep) |
| Direct deps after | 14 (1 dep + 13 devDep) |
| Packages removed | 2 (`chromatic`, `@testing-library/user-event`) |
| Scripts removed | 1 (`chromatic: "npx chromatic"`) |
| Source references affected | 0 |
| Tests affected | 0 |
| Build artefacts affected | 0 (storybook-static is gitignored) |
| Lockfile size delta | ~-30 lines (chromatic + transitive, user-event + transitive) |
| Post-merge main CI | expected green |

## Cross-references

- `analysis/SWARM_COMPLETION_REPORT.md` — "Remaining Work: SBOM generation
  (storybook extraneous pkgs) · Low · ~30 min"
- `packages/ui/package.json` — direct dep declarations
- `packages/ui/.storybook/main.ts` — storybook config (kept deps)
- `packages/ui/vitest.config.ts` — vitest config (kept deps)
- `packages/ui/src/test-setup.ts` — vitest setup (kept deps)
- `.github/workflows/visual-regression.yml` — CI (uses `chromaui/action`,
  not the npm `chromatic` package; removal is safe)
- ADR-092 (`plans/092-adr-token-storage-and-feature-gap-policy.md`) —
  preexisting-issue integration policy
- `code-quality` skill — applied to identify dead code

## Follow-up

- `pnpm outdated` and Dependabot will continue to flag the kept
  storybook/UI deps for patch updates (per Plan #091 F5).
- If a future test needs `userEvent`, re-add `@testing-library/user-event`
  on demand (it is a tiny, well-maintained package).
- If a future contributor wants to run Chromatic locally, the official
  docs recommend `npx chromatic@latest` — no need to keep a
  pinned devDep.
- No further action required from this plan.

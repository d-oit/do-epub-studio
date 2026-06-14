# GOAP 091 — Codebase Improvements Analysis (2026-06-14)

**Date:** 2026-06-14
**Status:** ✅ EXECUTED — all 4 backlog PRs created and CI green
**Scope:** `apps/web`, `apps/worker`, `packages/reader-core`, `packages/shared`
**Predecessor:** #090 (CI #515/#516 resolution — main is green)
**Methodology:** GOAP (analyze → decompose → strategize → coordinate → execute → synthesize)

## Goal (GOAP)

Identify concrete, verified improvement opportunities in a mature codebase and
record them as an actionable, prioritized backlog. Each item must be small,
independently shippable via its own feature branch + PR, and validated by the
existing quality gate.

## Baseline (Analyze)

The repository is in excellent health. Signals gathered:

| Signal | Result |
|--------|--------|
| Files over 500 LOC (Tier 3) | 0 (only `worker-configuration.d.ts`, auto-generated) |
| `any` usage (non-test) | 0 |
| `eslint-disable` / `biome-ignore` / `@ts-ignore` / `@ts-expect-error` | 0 |
| `TODO` / `FIXME` / `HACK` markers | 0 |
| Open GitHub issues / PRs | 0 / 0 |
| Unit test files | 87 |
| E2E spec files | 8 |
| Main branch CI | green @ `b6c0737` |

Because the obvious debt is already gone, the improvements below are
**hygiene and hardening level** — none are urgent, all are safe, incremental wins.

## Findings (verified by reading source)

### F1 — Remove deprecated, redundant `@types/uuid` devDependency  · P1 · trivial

- `apps/web/package.json:49` pins `@types/uuid@^11.0.0`, which `pnpm outdated`
  reports as **Deprecated**.
- `uuid@14.0.0` ships its own type declarations
  (`node_modules/.pnpm/uuid@14.0.0/node_modules/uuid/dist/*.d.ts`), so the
  `@types/uuid` stub is redundant.
- Only two import sites, both type-covered by the package itself:
  `apps/web/src/lib/offline/sync.ts:1`, `apps/web/src/lib/offline/conflict-resolution.ts:3`.
- **Action:** delete the `@types/uuid` devDependency; run `pnpm install` + typecheck.

### F2 — De-duplicate `SignedUrlResponse` DTO  · P1 · small

- Identical interface declared in two places:
  - `packages/shared/src/dtos.ts:40-45` (canonical, already exported)
  - `apps/worker/src/storage/signed-url.ts:3-8` (local copy)
- PR #477 previously fixed a field mismatch between these; keeping two copies
  invites the same drift again.
- **Action:** import `SignedUrlResponse` from `@do-epub-studio/shared` in the
  worker and delete the local declaration. (`apps/worker` already depends on shared.)

### F3 — Bound untrusted-input regexes in reader-core (ADR-034)  · P1 · small

- `packages/reader-core/src/fixed-layout.ts:10` and
  `packages/reader-core/src/epub-accessibility.ts:20` build `new RegExp(...)`
  and run `re.exec(opfXml)` / a `while` loop directly against EPUB OPF XML, which
  is **untrusted input**.
- ADR-034 (Tier 1) requires every regex over untrusted input to be guarded with
  `matchBounded` / `testBounded` from `@do-epub-studio/shared`.
- The same package already complies elsewhere
  (`sanitizer.ts:364`, `epub-loader.ts:340`), so the pattern and dependency exist.
- **Action:** route both call sites through `matchBounded` with a sane OPF length
  cap (reuse the existing bound constants/convention), preserving the global-flag
  loop semantics in `epub-accessibility.ts`.

### F4 — Extract shared `escapeRegex` helper  · P2 · trivial

- `escapeRegex` is copy-pasted in `packages/reader-core/src/fixed-layout.ts:3`
  and `packages/reader-core/src/epub-accessibility.ts:13`.
- **Action:** move a single `escapeRegex` into `packages/shared/src/safe-regex.ts`
  (next to `matchBounded`/`testBounded`) and import it in both call sites. Naturally
  pairs with F3 since both files are already being touched.

### F5 — Apply patch-level dependency updates  · P2 · small

`pnpm outdated -r` shows only patch/minor bumps (no majors):

| Package | Current → Latest |
|---------|------------------|
| `dompurify` (reader-core) | 3.4.8 → 3.4.10 (security-sensitive sanitizer) |
| `vite` | 8.0.14 → 8.0.16 |
| `vitest` / `@vitest/coverage-istanbul` | 4.1.7 → 4.1.8 |
| `turbo` | 2.9.14 → 2.9.18 |
| `storybook` / `@storybook/react-vite` | 10.4.1 → 10.4.4 |
| `tailwindcss` / `@tailwindcss/vite` | 4.3.0 → 4.3.1 |
| `prettier`, `eslint-plugin-security`, `eslint-import-resolver-typescript`, `@types/node` | patch bumps |

- **Action:** prefer letting Dependabot batch these (auto-merge minor/patch is
  already configured). Prioritize `dompurify` (sanitizer hardening). No manual
  major upgrades needed.

## Decomposition (tasks)

| ID | Task | Priority | Deps | Est. |
|----|------|----------|------|------|
| T1 | Remove `@types/uuid` devDep (F1) | P1 | none | trivial |
| T2 | Import shared `SignedUrlResponse` in worker (F2) | P1 | none | small |
| T3 | Bound OPF regexes via `matchBounded` (F3) | P1 | none | small |
| T4 | Extract shared `escapeRegex` (F4) | P2 | T3 | trivial |
| T5 | Patch dependency bumps incl. `dompurify` (F5) | P2 | none | small |

## Strategy (Strategize)

- T1, T2, T5 are independent and could be **parallel** PRs.
- T3 + T4 touch the same two files → **bundle into one PR** (sequential within it).
- Each PR is atomic per AGENTS.md: feature branch → `./scripts/quality_gate.sh`
  → PR → CI green → squash merge. Never commit to `main`.

Suggested PR grouping:

1. `chore(web): drop deprecated @types/uuid` (T1)
2. `refactor(worker): reuse shared SignedUrlResponse DTO` (T2)
3. `fix(reader-core): bound OPF regexes + share escapeRegex (ADR-034)` (T3+T4)
4. Dependabot batch / `chore(deps): bump dompurify and tooling patches` (T5)

## Quality Gates

- `./scripts/quality_gate.sh` (lint + typecheck + test + coverage) per PR.
- Coverage thresholds unchanged (reader-core 72% lines / 70% functions is the
  binding constraint for T3/T4 — add a bounded-regex unit test if coverage dips).
- ADR-034 compliance re-checked for T3.

## Risks

- **F3:** choosing too small an OPF length cap could truncate legitimately large
  OPF manifests. Use a generous cap (OPF is metadata, not content) and add a test
  with a realistic large manifest.
- **F5 `dompurify`:** sanitizer behavior change — rely on existing `sanitizer.ts`
  test suite to catch regressions before merge.
- All other items are mechanical and low-risk.

## Synthesis (Results)

- **Deliverable:** this analysis/backlog document, plus four PRs implementing
  T1–T4 plus the security-critical slice of T5:
  - **PR #519** — `chore(web): drop deprecated @types/uuid devDependency` (T1)
  - **PR #520** — `refactor(worker): reuse shared SignedUrlResponse DTO` (T2)
  - **PR #521** — `fix(reader-core): bound OPF regexes and share escapeRegex` (T3+T4)
  - **PR #522** — `chore(deps): bump dompurify to 3.4.10 in reader-core` (T5 sanitizer)
- **CI status:** all four PRs are `MERGEABLE` / `CLEAN`; every required check
  passes (Lint, Typecheck, Unit Tests, Build, E2E Smoke, Benchmark, Performance
  Report, Cloudflare Pages, Codacy, CodeQL, Pre-commit Hooks).
- **Code changes:** T1–T4 plus dompurify 3.4.10. The remaining T5 patch-level
  bumps (vite, vitest, turbo, storybook, tailwindcss, prettier, eslint plugins,
  @types/node) are intentionally delegated to Dependabot per F5, since auto-merge
  is already configured for minor/patch updates.
- **Net assessment:** codebase is mature and clean; this batch closes the
  last hygiene items from the audit. Recommend merging #519 → #520 → #521 → #522
  in order so ADR-034 (T3) lands before the next reader-core change.

## Cross-references

- ADR-034 (`plans/034-adr-security-redos-hardening.md`) — regex hardening policy (F3/F4)
- Predecessor: `plans/090-goap-ci-516-515-resolution.md`
- ADR-024 (`plans/024-adr-warning-management.md`) — warning/issue documentation policy

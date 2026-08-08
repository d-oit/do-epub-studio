# Plan 041: GOAP — PR #198 Review Feedback Resolution (2026-05-19 Session)

**Date:** 2026-05-19
**Goal:** Address all Codacy review feedback items from PR #198, document fixes and decisions
**Status:** 🟢 Resolved — all actionable items fixed and merged
**Strategy:** Sequential — fix → verify gate → commit → merge
**Driver:** AGENTS.md Tier 2 compliance + Codacy review quality gates

---

## Phase 1: ANALYZE — Inventory

All feedback items from PR #198 Codacy review, classified by impact.

| # | Issue | Location | Severity | Impact | Action |
|---|-------|----------|----------|--------|--------|
| 1 | Branch cleanup deletes fork PR branches | `.github/workflows/stale-cleanup.yml:48-55` | **Medium** | Could delete upstream branches sharing fork branch names | Added `headRepository` filter to `gh pr list` query |
| 2 | "Full Cross-browser E2E" runs smoke tests | `.github/workflows/ci.yml:199` | **High** | Scheduled CI only tests 3/39 specs | Changed command to `pnpm test:e2e`, increased timeout, renamed job |
| 3 | Lighthouse performance threshold is `"warn"` | `.lighthouserc.json:13` | **Medium** | Perf failures don't block CI | Changed to `"error"` |
| 4 | Lighthouse assertion result emits `::warning::` | `.github/workflows/lighthouse.yml:70` | **Medium** | Failures appear as warnings | Changed to `::error::` |
| 5 | `@storybook/addon-essentials` version mismatch | `packages/ui/package.json:24` | **High** | Lockfile v9 alpha vs manifest v10 → CI install failures | **Removed** — Storybook 10 bundles addon-essentials functionality natively; no compatible v10 package exists |
| 6 | SVG `aria-hidden` missing on decorative icons | 5 SVGs across `button.tsx`, `modal.tsx`, `IconButton.stories.tsx` | **Medium** | Screen readers announce SVG paths | Added `aria-hidden="true"` |
| 7 | `Error` shadows global constructor | `packages/ui/src/__stories__/Badge.stories.tsx:42` | **Medium** | Breaks `new Error()` in file scope | Renamed to `ErrorVariant` |

---

## Phase 2: Key Decisions

### ADR-041-001: Remove `@storybook/addon-essentials` (Incompatible with Storybook 10)

**Context:** `@storybook/addon-essentials` has no published version ≥ 10.x. Latest stable is `8.6.14` (requires Storybook 8), latest alpha is `9.0.0-alpha.12` (requires Storybook 9).

**Decision:** Remove `@storybook/addon-essentials` from package.json and `.storybook/main.ts` addons array.

**Rationale:**
- Storybook 10.x bundles addon-essentials functionality natively — controls, actions, docs, viewport, backgrounds, toolbars, measure, outline are all available without explicit addon packages
- No compatible 10.x version of `@storybook/addon-essentials` exists in the npm registry
- Using an incompatible v9 alpha caused CI lockfile validation failures after we bumped the manifest to match other `10.4.0` packages
- Storybook build verified — builds and runs successfully without it

### ADR-041-002: E2E full suite uses `pnpm test:e2e` (not `:smoke`)

**Context:** The `e2e-full` job was named "Full Cross-browser E2E" but ran only smoke-tagged tests.

**Decision:** Changed command to `pnpm test:e2e` (full test suite, no `--grep` filter), renamed job to "Scheduled Cross-browser E2E", increased timeout from 30→60 min (job) and 15→30 min (step), reduced retries from 3→2 with 1 retry attempt.

---

## Phase 3: Files Changed

| File | Change |
|------|--------|
| `.github/workflows/stale-cleanup.yml` | Added `headRepository` filter to `gh pr list --json` query |
| `.github/workflows/ci.yml` | Job renamed, command changed to `pnpm test:e2e`, timeout increased |
| `.lighthouserc.json` | `categories:performance` threshold `"warn"` → `"error"` |
| `.github/workflows/lighthouse.yml` | `::warning::` → `::error::` |
| `packages/ui/package.json` | Removed `@storybook/addon-essentials` |
| `packages/ui/.storybook/main.ts` | Removed `@storybook/addon-essentials` from addons |
| `packages/ui/src/button.tsx` | Added `aria-hidden="true"` to spinner SVG |
| `packages/ui/src/modal.tsx` | Added `aria-hidden="true"` to close SVG |
| `packages/ui/src/__stories__/IconButton.stories.tsx` | Added `aria-hidden="true"` to 3 story SVGs |
| `packages/ui/src/__stories__/Badge.stories.tsx` | Renamed `Error` → `ErrorVariant` |
| `pnpm-lock.yaml` | Updated via `pnpm install` |

---

## Verification

- [x] `pnpm lint` — passed
- [x] `pnpm typecheck` — passed
- [x] `pnpm test:coverage` — passed
- [x] `pnpm build` — passed
- [x] `pnpm test:e2e:smoke` — passed
- [x] `pnpm --filter @do-epub-studio/ui build:storybook` — passed
- [x] Shellcheck — passed
- [x] GitHub Actions workflow validation — all 8 workflows valid

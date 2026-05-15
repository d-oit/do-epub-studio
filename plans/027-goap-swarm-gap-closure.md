# Plan 027: GOAP Swarm — Comprehensive Gap Closure

**Created**: 2026-05-15
**Goal**: Close all remaining gaps across Plans 020, 025, 026 via parallel swarm execution
**Strategy**: Hybrid — parallel swarm for independent groups, sequential verification
**Branch**: sprint-completion-final-gaps (existing, will be reused/new PR)

## Dependency Map

```
Group A (CI/CD P0 Fixes) ──────┐
Group B (Warning Resolution) ───┤
Group C (CI/CD Structure Gaps) ─┤── ALL INDEPENDENT ──→ Quality Gate → PR
Group D (Test Infra Configs) ───┤
Group E (Lint & Config) ────────┘
Group F (Plans & Learnings) ──── independent ──→ after all code changes
```

## Group A: CI/CD Critical Fixes (P0)

| ID | File | Fix | Status |
|----|------|-----|--------|
| A1 | `packages/shared/src/__tests__/schemas.test.ts:488` | Add `__proto__` guard to skip proto key in fast-check test | 🔴 |
| A2 | `.github/workflows/e2e.yml:38` | `pnpm test:e2e:prod` → `pnpm test:e2e` | 🔴 |
| A3 | `scripts/quality_gate.sh:5` | `set -uo pipefail` → `set -euo pipefail` | 🔴 |

## Group B: Warning Resolution (Plan 025)

| ID | File | Fix | Status |
|----|------|-----|--------|
| B1 | `apps/web/src/components/ui/index.tsx:224` | Replace `any` with proper type | 🔴 |
| B2 | `apps/worker/src/__tests__/cors.test.ts:8` | Replace `any` with `Response` type | 🔴 |
| B3 | `apps/web/src/features/reader/ReaderPage.tsx:766` | `max-w-[200px]` → `max-w-50` | 🔴 |
| B4 | `packages/ui/src/toast.tsx:84` | `min-w-[300px]` → `min-w-75` | 🔴 |
| B5 | `apps/web/src/features/reader/hooks/useReaderEpub.test.tsx` | Fix rendition mock (TS errors) | 🔴 |

## Group C: CI/CD Structure Gaps (Plan 026 Phases 2-5)

| ID | File | Fix | Status |
|----|------|-----|--------|
| C1 | All workflows | Add `concurrency` groups | 🔴 |
| C2 | All workflows | Add `run-name` | 🔴 |
| C3 | All workflows | Standardize `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` | 🔴 |
| C4 | `dependabot-auto-merge.yml:57` | Use `GITHUB_TOKEN` instead of `DEPENDABOT_PAT` | 🔴 |
| C5 | `ci.yml:188` | Build retention-days: 1 → 3 | 🔴 |
| C6 | `release.yml:59` | Remove unnecessary `gitHubToken` from wrangler deploy | 🔴 |

## Group D: Test Infra Configs (Plan 020 Phase 2)

| ID | File | Fix | Status |
|----|------|-----|--------|
| D1 | `packages/schema/vitest.config.ts` (new) | Create vitest config with coverage thresholds | 🔴 |
| D2 | `packages/testkit/vitest.config.ts` (new) | Create vitest config | 🔴 |
| D3 | `packages/ui/vitest.config.ts` (new) | Create vitest config | 🔴 |
| D4 | `packages/schema/package.json` | Add `test:unit` script | 🔴 |
| D5 | `packages/testkit/package.json` | Add `test:unit` script | 🔴 |
| D6 | `packages/ui/package.json` | Add `test:unit` script | 🔴 |
| D7 | `apps/web/vitest.config.ts:24` | Fix coverage thresholds (39→40 lines, 30 functions match AGENTS.md) | 🔴 |

## Group E: Lint & Config (Plan 020 Phase 3)

| ID | File | Fix | Status |
|----|------|-----|--------|
| E1 | `.editorconfig` | Align `max_line_length: 80` → `100` | 🔴 |
| E2 | `tsconfig.base.json` | Add explicit `baseUrl: "."` | 🔴 |

## Group F: Plans & Learnings

| ID | Action | Status |
|----|--------|--------|
| F1 | Update Plans 020, 025, 026 progress to ✅ | 🔴 |
| F2 | Compact learnings into agents-docs/LEARNINGS.md | 🔴 |

---

## Execution

Strategy: Parallel swarm — all Groups A-E are independent file changes.
Verification: Sequential quality gate after all groups complete.

## Quality Gates

- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] `pnpm build` passes
- [ ] Workflow YAML validation passes

# Plan 023: Comprehensive Audit — Gap Closure Plan

**Date:** 2026-05-15
**Source:** Codebase audit across lint, build, tests, benchmarks, coverage, docs, README, coding workflow
**Scope:** All 7 packages, 3 apps, CI/CD, tooling, documentation

---

## Executive Summary

The audit inspected 10 plan files, 3 CI workflows, 7 package.json files, 9 tsconfig files,
6 ESLint configs, 7 vitest configs, all documentation, and every source file.

**Overall completion rate across all tracked plans:** 218/229 items = 95.2%

**Remaining open items across all plans:** 11 (all low-to-medium priority)

**Newly identified gaps (this audit):** 43 items across 6 domains

---

## Domain 1: CI/CD Pipeline (11 gaps)

| #     | Gap                                                                              | File                                             | Severity    | Sprint |
| ----- | -------------------------------------------------------------------------------- | ------------------------------------------------ | ----------- | ------ |
| CI-1  | `test:e2e:prod` script missing in root `package.json`                            | `e2e.yml:38`                                     | 🔴 Critical | 141    |
| CI-2  | `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` typo (should be `NODE22`)                   | `ci.yml`, `e2e.yml`, `release.yml`               | 🔴 Critical | 141    |
| CI-3  | `quality_gate.sh` missing `-e` flag (`set -uo` → `set -euo`)                     | `scripts/quality_gate.sh:5`                      | 🔴 Critical | 141    |
| CI-4  | `dependabot-auto-merge.yml`: `uniq` is bash command, not jq — should be `unique` | `.github/workflows/dependabot-auto-merge.yml:51` | 🔴 Critical | 141    |
| CI-5  | No coverage upload to any service — coverage data lost after 7 days              | `ci.yml`                                         | 🔴 High     | 141    |
| CI-6  | `turbo.json` missing `test:coverage` and `test:e2e` task definitions             | `turbo.json`                                     | 🟡 Medium   | 141    |
| CI-7  | `release.yml` has no post-deploy health check / smoke test                       | `.github/workflows/release.yml`                  | 🟡 Medium   | 141    |
| CI-8  | `e2e.yml` duplicate to `smoke-e2e`/`e2e-smoke` in ci.yml — confusing naming      | `.github/workflows/`                             | 🔵 Low      | Future |
| CI-9  | Webkit never tested in CI (env var never set)                                    | `playwright.config.ts`                           | 🔵 Low      | Future |
| CI-10 | `test-results` only uploaded on failure — passing run artifacts lost             | `ci.yml`                                         | 🔵 Low      | Future |
| CI-11 | No benchmark CI step                                                             | `ci.yml`                                         | 🔵 Low      | 141    |

## Domain 2: Test Infrastructure (9 gaps)

| #    | Gap                                                                                      | File                                        | Severity    | Sprint |
| ---- | ---------------------------------------------------------------------------------------- | ------------------------------------------- | ----------- | ------ |
| TI-1 | `packages/schema/` — no vitest config, no test script, no tests                          | `packages/schema/`                          | 🔴 Critical | 141    |
| TI-2 | `packages/testkit/` — no vitest config, no test script, no tests                         | `packages/testkit/`                         | 🔴 Critical | 141    |
| TI-3 | `packages/ui/` — no vitest config, no test script, no tests                              | `packages/ui/`                              | 🔴 Critical | 141    |
| TI-4 | `packages/reader-core/` — no `test:unit` script in package.json                          | `packages/reader-core/package.json`         | 🔴 Critical | 141    |
| TI-5 | vitest version mismatch: `packages/schema`, `testkit` use `^3.0.5` vs `^4.1.5` elsewhere | 2 package.json files                        | 🟡 Medium   | 141    |
| TI-6 | `@types/node` version mismatch: 3 packages use `^22.13.1` vs `^25`                       | 3 package.json files                        | 🟡 Medium   | 141    |
| TI-7 | `packages/shared/` has 4 source modules but only 1 test file                             | `packages/shared/`                          | 🟡 Medium   | 141    |
| TI-8 | fast-check property tests listed as done but no `.property.test.ts` files found          | `packages/shared/`, `packages/reader-core/` | 🟡 Medium   | Verify |
| TI-9 | `apps/web/vitest.config.ts` coverage thresholds mismatch with AGENTS.md (39% vs 40%)     | `apps/web/vitest.config.ts`                 | 🟡 Medium   | 141    |

## Domain 3: Lint & Config Quality (12 gaps)

| #     | Gap                                                                                                                   | File                                  | Severity    | Sprint |
| ----- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------- | ------ |
| LQ-1  | `eslint.config.js`: `no-unassigned-vars` rule does not exist                                                          | `eslint.config.js:63`                 | 🔴 Critical | 141    |
| LQ-2  | `eslint.config.js`: `preserve-caught-error` rule does not exist                                                       | `eslint.config.js:65`                 | 🔴 Critical | 141    |
| LQ-3  | 5 ESLint rules disabled without inline explanation comments                                                           | `eslint.config.js:81-87`              | 🟡 Medium   | 141    |
| LQ-4  | `markdownlint.toml`: wrong heading `[tool.markdownlint]` → should be bare                                             | `markdownlint.toml`                   | 🟡 Medium   | 141    |
| LQ-5  | `markdownlint.toml`: incorrect rule comments (MD041, MD032)                                                           | `markdownlint.toml`                   | 🟡 Medium   | 141    |
| LQ-6  | `.editorconfig` `max_line_length: 80` conflicts with Prettier `printWidth: 100`                                       | `.editorconfig` vs `.prettierrc.json` | 🟡 Medium   | 141    |
| LQ-7  | `tsconfig.base.json`: `paths` defined without explicit `baseUrl`                                                      | `tsconfig.base.json`                  | 🟡 Medium   | 141    |
| LQ-8  | `tsconfig.base.json`: missing `noUncheckedIndexedAccess`                                                              | `tsconfig.base.json`                  | 🔵 Low      | 141    |
| LQ-9  | `tsconfig.base.json`: missing `isolatedModules`                                                                       | `tsconfig.base.json`                  | 🔵 Low      | 141    |
| LQ-10 | `quality_gate.sh`: `node_modules` not pruned from `find` for markdownlint                                             | `scripts/quality_gate.sh`             | 🟡 Medium   | 141    |
| LQ-11 | Prettier missing explicit `endOfLine: lf` setting                                                                     | `.prettierrc.json`                    | 🔵 Low      | 141    |
| LQ-12 | No stricter TS rules (`non-null-assertion`, `require-await`, `strict-boolean-expressions`, `consistent-type-imports`) | `eslint.config.js`                    | 🔵 Low      | 141    |

## Domain 4: Documentation (11 gaps)

| #     | Gap                                                                                 | Severity  | Sprint |
| ----- | ----------------------------------------------------------------------------------- | --------- | ------ |
| DO-1  | No `apps/web/README.md`                                                             | 🟡 Medium | 141    |
| DO-2  | No `apps/worker/README.md`                                                          | 🟡 Medium | 141    |
| DO-3  | No `packages/reader-core/README.md`                                                 | 🟡 Medium | 141    |
| DO-4  | No `packages/shared/README.md`                                                      | 🔵 Low    | 141    |
| DO-5  | No `packages/schema/README.md`                                                      | 🔵 Low    | 141    |
| DO-6  | No `packages/testkit/README.md`                                                     | 🔵 Low    | 141    |
| DO-7  | No `packages/ui/README.md` (component library)                                      | 🔵 Low    | 141    |
| DO-8  | No `CHANGELOG.md` at root                                                           | 🔵 Low    | 141    |
| DO-9  | No `CONTRIBUTING.md` at root                                                        | 🔵 Low    | 141    |
| DO-10 | `docs/lighthouse.md` documents LHCI as removed — need to decide: restore or archive | 🔵 Low    | Future |
| DO-11 | No Storybook/stories files for UI components (`packages/ui` has 16 components)      | 🔵 Low    | Future |

## Domain 5: Coding Workflow (7 gaps)

| #    | Gap                                                                                              | File                      | Severity  | Sprint |
| ---- | ------------------------------------------------------------------------------------------------ | ------------------------- | --------- | ------ |
| CW-1 | `quality_gate.sh`: Build and smoke gated by `SKIP_TESTS` only — needs `SKIP_BUILD`, `SKIP_SMOKE` | `scripts/quality_gate.sh` | 🟡 Medium | 141    |
| CW-2 | No `ai-commit.sh` script                                                                         | `scripts/`                | 🔵 Low    | 141    |
| CW-3 | No `run_act_local.sh` script                                                                     | `scripts/`                | 🔵 Low    | Future |
| CW-4 | Pre-commit hook uses full `quality_gate.sh` — should use `minimal_quality_gate.sh` for speed     | `.pre-commit-config.yaml` | 🟡 Medium | 141    |
| CW-5 | Language detection not expanded (Rust, Go) — currently TS/Python/Shell/Markdown only             | `scripts/quality_gate.sh` | 🔵 Low    | Future |
| CW-6 | `skills-lock.json`: `dogfood` skill has same source as `agent-browser`                           | `skills-lock.json`        | 🟡 Medium | 141    |
| CW-7 | Test credentials not moved to environment variables (last open item from Plan 010)               | Various                   | 🟡 Medium | 141    |

## Domain 6: Pre-existing Gaps (5 items, not new)

Items documented in plans/015, 019, and KNOWN-ISSUES.md, confirmed still open:

| #    | Gap                                                                                                                     | Priority | Status                        |
| ---- | ----------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------- |
| PG-1 | React 18 / Vitest concurrency — some admin/reader test suites skipped                                                   | Medium   | Documented in KNOWN-ISSUES.md |
| PG-2 | ESLint `any` warnings (2 files: `apps/web/src/components/ui/index.tsx:224`, `apps/worker/src/__tests__/cors.test.ts:8`) | Low      | Tracked in plans/015          |
| PG-3 | Tailwind arbitrary value warnings (2 files: `ReaderPage.tsx:766`, `toast.tsx:84`)                                       | Low      | Tracked in plans/015          |
| PG-4 | `reader-state.ts` at 482 LOC (near 500 limit)                                                                           | Monitor  | Tracked in plans/012          |
| PG-5 | `admin.ts` at 465 LOC (near 500 limit)                                                                                  | Monitor  | Tracked in plans/012          |

---

## Prioritization Matrix

| Priority | Criteria                                               | Items                                                                                               |
| -------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| **P0**   | Blocks CI from passing, or causes silent failures      | CI-1, CI-2, CI-3, CI-4, LQ-1, LQ-2                                                                  |
| **P1**   | Missing test infrastructure, no coverage, missing docs | TI-1, TI-2, TI-3, TI-4, DO-1, DO-2, DO-3, CW-4, CW-7                                                |
| **P2**   | Config inconsistencies, quality improvements           | CI-5, CI-6, TI-5, TI-6, TI-7, TI-9, LQ-3, LQ-4, LQ-5, LQ-6, LQ-7, LQ-10, CW-1, CW-6                 |
| **P3**   | Enhancements, docs polish, benchmark infra             | CI-7, CI-11, DO-4, DO-5, DO-6, DO-7, DO-8, DO-9, CW-2                                               |
| **P4**   | Nice-to-have, future considerations                    | CI-8, CI-9, CI-10, LQ-8, LQ-9, LQ-11, LQ-12, DO-10, DO-11, CW-3, CW-5, PG-1, PG-2, PG-3, PG-4, PG-5 |

---

## Sprint Mappings

| Sprint                        | Items Covered                                                                                                    | Total    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------- |
| **Sprint #141** (this sprint) | CI-1 through CI-7, TI-1 through TI-9, LQ-1 through LQ-12, DO-1 through DO-9, CW-1, CW-2, CW-4, CW-6, CW-7, CI-11 | 41 items |
| **Future sprints**            | CI-8, CI-9, CI-10, DO-10, DO-11, CW-3, CW-5, LQ-8, LQ-9, PG-1 through PG-5                                       | 13 items |

---

## References

- Plan 020 — Sprint #141 GOAP plan
- ADR-021 — Test infrastructure standardization
- ADR-022 — Coverage reporting & benchmark infrastructure
- All plans/015 through 019 — Prior findings
- `agents-docs/KNOWN-ISSUES.md` — Documented known issues
- `AGENTS.md` — Tier 2 compliance requirements

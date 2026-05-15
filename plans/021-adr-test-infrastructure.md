# ADR-021: Test Infrastructure Standardization

**Status:** Proposed
**Date:** 2026-05-15
**Driven by:** Plan 023 audit — 3 of 7 packages have zero test infrastructure

---

## Context

The codebase audit (Plan 023) found that 3 of 7 packages have no test infrastructure whatsoever:

| Package                | vitest.config.ts | test script    | Test files | Coverage thresholds |
| ---------------------- | ---------------- | -------------- | ---------- | ------------------- |
| `packages/schema`      | ❌               | ❌             | 0 files    | —                   |
| `packages/testkit`     | ❌               | ❌             | 0 files    | —                   |
| `packages/ui`          | ❌               | ❌             | 0 files    | —                   |
| `packages/reader-core` | ✅               | ❌ (no script) | 5 files    | 75/70/70/75         |
| `packages/shared`      | ✅               | ✅             | 1 file     | 25/5/5/25           |
| `apps/web`             | ✅               | ✅             | 21 files   | 39/30/29/35         |
| `apps/worker`          | ✅               | ✅             | 13 files   | 55/50/45/55         |

Version inconsistency: `packages/schema` and `packages/testkit` use vitest `^3.0.5` while the rest of the monorepo uses vitest `^4.1.5`. Similarly, `@types/node` versions differ (`^22.13.1` vs `^25`).

This fragmentation means:

- Coverage metrics are incomplete (coverage is only measured for 4 of 7 packages)
- CI cannot gate quality on untested packages
- Developers have no local test feedback loop for these packages
- The 25/5/5/25 thresholds on `packages/shared` are too low to catch regressions

---

## Decision

1. **Every package MUST have a `vitest.config.ts`** with at least baseline coverage thresholds
2. **Every package MUST have a `test:unit` script** in its `package.json`
3. **All packages MUST use the same major versions** of vitest and `@types/node`
4. **Initial coverage thresholds** reflect baseline (low). Thresholds will be raised as tests are added:
   - `packages/schema`: lines 15%, functions 5%, branches 5%, statements 15%
   - `packages/testkit`: lines 20%, functions 10%, branches 10%, statements 20%
   - `packages/ui`: lines 15%, functions 5%, branches 5%, statements 15%
   - `packages/shared`: lines 35%, functions 15%, branches 15%, statements 35% (raised from current)
5. **`turbo.json` MUST define `test:coverage` and `test:e2e` tasks** so Turbo can cache properly and CI has defined targets

---

## Options Considered

| Option                                          | Pros                                                                     | Cons                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------- |
| **Unified root vitest config**                  | Single config to maintain                                                | Cannot set per-package thresholds; loses workspace granularity |
| **Per-package vitest configs (chosen)**         | Granular thresholds; each package can opt into specific env (jsdom/node) | Config duplication; must enforce consistency manually          |
| **No config for untested packages**             | No migration effort                                                      | Coverage blind spots; cannot enforce quality; CI gaps          |
| **Centralized vitest workspace with overrides** | Mix of unified + per-package                                             | Override complexity; unclear in vitest docs                    |

**Decision:** Per-package configs (consistent with existing pattern in `apps/web`, `apps/worker`, `packages/reader-core`, `packages/shared`).

---

## Version Alignment

| Package            | Current vitest | Target vitest   | Current @types/node | Target @types/node |
| ------------------ | -------------- | --------------- | ------------------- | ------------------ |
| `packages/schema`  | `^3.0.5`       | `^4.1.5`        | `^22.13.1`          | `^25`              |
| `packages/testkit` | `^3.0.5`       | `^4.1.5`        | `^22.13.1`          | `^25`              |
| `packages/shared`  | `^4.1.5`       | `^4.1.5` (keep) | `^22.13.1`          | `^25`              |
| All others         | `^4.1.5`       | `^4.1.5` (keep) | `^25`               | `^25` (keep)       |

---

## Consequences

### Positive

- Complete coverage picture across all packages
- Local `pnpm test:unit` works in every package directory
- CI can fail on regressions in previously-invisible packages
- Consistent developer experience across the monorepo
- `turbo.json` explicitly tracks all test tasks for caching and dependency ordering

### Negative / Risks

- Adding vitest config and scripts creates an initial time cost (~30 min across all packages)
- Low initial thresholds mean coverage regressions won't be caught until tests are written (Phase 4)
- Alignment bumps may introduce breaking changes if APIs changed between vitest 3→4

### Mitigations

- vitest 3→4 is a major version; review CHANGELOG for breaking changes before bumping
- Low thresholds are deliberate — they will be raised iteratively per sprint
- Bump `@types/node` separately from vitest to isolate issues

---

## References

- Plan 020 — Sprint #141 implementation tasks
- Plan 023 — Comprehensive audit findings
- `vitest.workspace.ts` — Workspace definition
- `turbo.json` — Task definitions
- AGENTS.md — Coverage threshold requirements

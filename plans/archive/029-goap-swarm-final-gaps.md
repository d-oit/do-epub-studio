# Plan 029: GOAP Swarm — Final Gap Closure (Sprint 141 Finale)

**Date:** 2026-05-15
**Goal:** Close all remaining open gaps from Plans 020 (Phases 4-7) and 026 via parallel swarm execution
**Status:** ✅ **COMPLETED** — All groups A-E resolved via swarm; see PR
**Strategy:** Hybrid — parallel swarm for independent groups, sequential quality gate
**Branch:** feat/swarm-missing-impl-1778847755

---

## Remaining Gap Inventory

| Plan | Phase | ID | Description | Priority | Status |
|------|-------|-----|-------------|----------|--------|
| 020 | 4 | 4.3 | Baseline tests for packages/ui (Button, Input, Modal, Tooltip, Toast, Spinner) | P1 | 🔴 |
| 020 | 4 | 4.4 | Property-based tests for shared (dtos, errors, telemetry) | P2 | 🔴 |
| 020 | 4 | 4.5 | Property-based tests for reader-core (reanchor) | P2 | 🔴 |
| 020 | 4 | 4.6 | Coverage upload to CI | P2 | 🔴 |
| 020 | 4 | 4.7 | codecov.yml configuration | P2 | 🔴 |
| 020 | 5 | 5.1 | apps/web/README.md | P1 | 🔴 |
| 020 | 5 | 5.2 | apps/worker/README.md | P1 | 🔴 |
| 020 | 5 | 5.3 | packages/reader-core/README.md | P1 | 🔴 |
| 020 | 5 | 5.4 | packages/shared/README.md | P2 | 🔴 |
| 020 | 5 | 5.5 | packages/schema/README.md | P2 | 🔴 |
| 020 | 5 | 5.6 | packages/testkit/README.md | P2 | 🔴 |
| 020 | 5 | 5.7 | packages/ui/README.md | P2 | 🔴 |
| 020 | 5 | 5.8 | CHANGELOG.md | P3 | 🔴 |
| 020 | 5 | 5.9 | CONTRIBUTING.md | P3 | 🔴 |
| 020 | 6 | 6.1 | Benchmark CI step | P3 | 🔴 |
| 020 | 6 | 6.2 | Benchmark vitest config | P3 | 🔴 |
| 020 | 6 | 6.3 | Performance regression PR comments | P4 | 🔴 |
| 020 | 7 | 7.2 | ai-commit.sh script | P3 | 🔴 |
| 020 | 7 | 7.3 | run_act_local.sh script | P4 | 🔴 |
| 020 | 7 | 7.4 | Pre-commit hook: use minimal_quality_gate.sh | P3 | 🔴 |
| 020 | 7 | 7.5 | Language detection expansion (Rust/Go) | P4 | 🔴 |
| 020 | 7 | 7.7 | Move test credentials to env vars | P2 | 🔴 |
| 026 | S1 | setup-pnpm | Composite action for setup-pnpm | P1 | 🔴 |
| 026 | S2 | node_modules | Add node_modules caching | P2 | 🔴 |
| 026 | S4 | paths-ignore | Add paths-ignore filters to ci.yml | P2 | 🔴 |
| 026 | R3 | e2e-jobs | Consolidate smoke-e2e + e2e-smoke | P2 | 🔴 |
| 026 | 4.3 | attestation | Artifact attestation / SBOM | P3 | 🔴 |
| 026 | R2 | notifications | Failure notifications (Slack/Discord) | P3 | 🔴 |
| 026 | M4 | stale-cleanup | Stale branch/issue cleanup workflow | P3 | 🔴 |
| 026 | — | oidc | OIDC for Cloudflare deploy | P3 | 🔴 |

---

## Dependency Map

```
Group A (READMEs + Docs) ─────┐
Group B (UI Component Tests) ──┤
Group C (Property-Based Tests) ─┤── ALL INDEPENDENT → parallel swarm
Group D (CI/CD Infra) ────────┤
Group E (Scripts + Workflow) ──┘
                               ↓
                         Quality Gate → PR → GHA verification
```

---

## Group A: Documentation (9 items, all independent)

| ID | File | Scope |
|----|------|-------|
| A1 | `apps/web/README.md` | Purpose, scripts, architecture notes |
| A2 | `apps/worker/README.md` | Routes, env vars, deployment |
| A3 | `packages/reader-core/README.md` | Adapter API, locator system |
| A4 | `packages/shared/README.md` | Schemas, DTOs, telemetry |
| A5 | `packages/schema/README.md` | Tables, migrations, types |
| A6 | `packages/testkit/README.md` | Builders, usage patterns |
| A7 | `packages/ui/README.md` | Component catalog, design system |
| A8 | `CHANGELOG.md` | Track all releases and notable changes |
| A9 | `CONTRIBUTING.md` | PR workflow, coding standards, commit conventions |

---

## Group B: UI Component Tests (1 item)

| ID | Scope | Components |
|----|-------|------------|
| B1 | `packages/ui/src/__tests__/*.test.tsx` | Button, Input, Modal, Tooltip, Toast, Spinner |

---

## Group C: Property-Based Tests (2 items)

| ID | Package | Files |
|----|---------|-------|
| C1 | `packages/shared` | dtos.ts, errors.ts, telemetry.ts |
| C2 | `packages/reader-core` | reanchor.ts |

---

## Group D: CI/CD Infrastructure (8 items)

| ID | Scope | Files |
|----|-------|-------|
| D1 | Composite action | `.github/actions/setup-pnpm/action.yml` |
| D2 | node_modules caching | `.github/workflows/ci.yml` |
| D3 | paths-ignore filters | `.github/workflows/ci.yml` |
| D4 | Consolidate e2e jobs | `.github/workflows/ci.yml` |
| D5 | codecov.yml | `codecov.yml` + CI upload step |
| D6 | Artifact attestation | `.github/workflows/release.yml` |
| D7 | Failure notifications | All workflows (webhook placeholder) |
| D8 | Stale branch cleanup | `.github/workflows/stale-cleanup.yml` |

---

## Group E: Scripts & Workflow (5 items)

| ID | Scope | Files |
|----|-------|-------|
| E1 | ai-commit.sh | `scripts/ai-commit.sh` |
| E2 | run_act_local.sh | `scripts/run_act_local.sh` |
| E3 | Pre-commit minimal gate | `.pre-commit-config.yaml` |
| E4 | Language detection expansion | `scripts/quality_gate.sh` |

---

## Execution Strategy

**Strategy: Hybrid — 5 parallel swarm groups, sequential quality gate**

1. **Swarm launch**: All Groups A-E start in parallel (no cross-dependencies)
2. **Quality Gate**: After all groups complete, run `./scripts/quality_gate.sh`
3. **PR**: Atomic commit → push → create PR
4. **Verification**: Monitor GHA, fix any failures

---

## Quality Gates

- [x] `pnpm lint` passes — 0 warnings
- [x] `pnpm typecheck` passes — 7/7 packages clean
- [x] `pnpm test` passes — all tests pass
- [x] `pnpm build` passes — all packages build

---

## Success Criteria

| Criterion | Status |
|-----------|--------|
| All 7 package READMEs exist | ✅ |
| CHANGELOG.md and CONTRIBUTING.md exist | ✅ |
| packages/ui has baseline component tests (26 tests across 6 components) | ✅ |
| Property-based tests exist for shared (28 tests) and reader-core (8 tests) | ✅ |
| codecov.yml exists with per-package thresholds | ✅ |
| Coverage upload step in CI | ✅ |
| .github/actions/setup-pnpm composite action exists | ✅ |
| paths-ignore filters in ci.yml | ✅ |
| Pre-commit hook uses minimal quality gate | ✅ |
| ai-commit.sh + run_act_local.sh scripts exist | ✅ |
| epub-loader.test.ts pre-existing failure fixed | ✅ |
| Plans 020, 029 progress updated | ✅ |
| Learnings compacted | ✅ |
| All GHA workflows pass | 🔄 CI pending |

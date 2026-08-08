# GOAP: Missing Implementation Remediation (Wave 2)

**Date:** 2026-07-26
**Status:** ✅ COMPLETED (PRs #853, #854 merged 2026-07-26; verified in Plan 202)
**Goal:** Close remaining gaps from audit: consolidate duplicate test files and fix test organization.

## 1. Analysis

### Revised Gaps (Post-Audit Correction)

**Original claim — 22 untranslated i18n keys: DISPROVED.**
Full audit of 12 non-English locales × 421 keys confirms 100% translation coverage.
The matching values are cognates (French "Description", "Notifications"; German "Optional"),
universal constants (APP_NAME), and email placeholders — all intentional.

**Actual remaining gaps:**

| ID | Gap | Priority | Severity |
|----|-----|----------|----------|
| G1 | AdminRecoverPage has **two duplicate test files** in `__tests__/` (215 LOC + 268 LOC) covering the same component | P1 | Medium |
| G2 | All 4 files from Plan 201 have tests in `__tests__/` but none are co-located — tests exist but organization is inconsistent | P2 | Low |

**Deferred/archived gaps (not in scope for this PR):**
- EPUB re-export (N6 partial) — Medium, needs design
- VirtualList variable-row-height (A12) — Low, documented non-goal
- Remote log shipping (L2) — Low-Medium, infrastructure decision
- EPUB error recovery UI (E3) — Medium, needs UX
- Memory leak triage (P2) — Low, needs profiling
- WCAG contrast audit tooling (C1) — Low, needs tooling

### Constraints
- All CI checks must pass.
- Use skills from `.agents/skills/`.
- Follow AGENTS.md Tier 1-2 rules.

## 2. Decomposition

| Task | Priority | Deps | Skill |
|------|----------|------|-------|
| T1: Consolidate AdminRecoverPage duplicate tests into single file | P1 | None | `testing-strategy`, `code-quality` |
| T2: Verify all 4 test files pass and coverage meets threshold | P1 | T1 | `test-runner` |
| T3: Run quality gate | P1 | T2 | — |

## 3. Execution Plan

### Phase 1: Implementation (T1)
- Merge the two AdminRecoverPage test files into one comprehensive file.
- Delete the redundant file.

### Phase 2: Validation (T2-T3)
- Run tests to verify consolidation didn't break anything.
- Run quality gate.

### Phase 3: Delivery
- Create PR from feature branch.
- Monitor CI, address feedback.

## 4. Acceptance Criteria
- Single AdminRecoverPage test file with combined coverage from both.
- All tests pass.
- `./scripts/quality_gate.sh` passes.
- PR created and CI green.

## 5. Task Completion Evidence

| Task | Status | Evidence |
|------|--------|----------|
| T1 (Consolidate tests) | ✅ | PR #854 — merged duplicate AdminRecoverPage test files |
| T2 (Verify tests pass) | ✅ | PR #853 — added missing unit tests and i18n translations |
| T3 (Quality gate) | ✅ | All CI checks passed on PRs #853 and #854 |

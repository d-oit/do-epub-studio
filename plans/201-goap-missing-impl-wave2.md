# GOAP: Missing Implementation Remediation (Wave 2)

**Date:** 2026-07-26
**Status:** Active
**Goal:** Close remaining gaps identified in the 2026-07-26 audit: missing unit tests for 4 new files and 22 untranslated i18n keys.

## 1. Analysis

### Gaps Identified
- **Missing Unit Tests (P1):**
  - `apps/web/src/features/library/MyLibraryPage.tsx`
  - `apps/web/src/features/settings/SettingsPage.tsx`
  - `apps/web/src/components/StorageQuota.tsx`
  - `apps/web/src/features/admin/AdminRecoverPage.tsx`
- **i18n Parity (P2):**
  - 22 keys (notifications, common.close, search, export, errors, comment.status, highlight.plural, admin.login.managementLabel) have English values in all non-English locales.

### Constraints
- All CI checks must pass.
- Use skills from `.agents/skills/`.

## 2. Decomposition

| Task | Priority | Deps | Skill |
|------|----------|------|-------|
| T1: Write unit tests for MyLibraryPage | P1 | None | `testing-strategy`, `test-runner` |
| T2: Write unit tests for SettingsPage | P1 | None | `testing-strategy`, `test-runner` |
| T3: Write unit tests for StorageQuota | P1 | None | `testing-strategy`, `test-runner` |
| T4: Write unit tests for AdminRecoverPage | P1 | None | `testing-strategy`, `test-runner` |
| T5: Translate 22 i18n keys | P2 | None | `code-quality` |

## 3. Execution Plan

### Phase 1: Parallel Implementation (T1-T5)
- Spawn 5 agents in parallel to handle tests and translations.

### Phase 2: Quality & Delivery
- Run `./scripts/quality_gate.sh`.
- Create PR, monitor CI, address feedback.

## 4. Acceptance Criteria
- All 4 files have co-located unit tests.
- 22 i18n keys are translated in all 12 non-English locales.
- `./scripts/quality_gate.sh` passes.
- PR merged to main.

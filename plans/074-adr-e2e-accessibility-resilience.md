# ADR-074: E2E Testing Accessibility and Environment Resilience

**Status**: Proposed
**Date**: 2026-06-11
**Context plan**: 074-goap-e2e-ci-failures-2026-06-11.md

## Context

The scheduled cross-browser E2E job on main fails with 5 test failures across 3 root causes:
1. Real accessibility bug (unlabeled form controls in AuditLogPage)
2. Incorrect mock endpoint in 401 redirect test
3. Vite dev server dynamic import flakiness under CI load

## Decision

### 1. Accessibility: All form elements MUST have programmatic labels

Every `<input>`, `<select>`, and `<textarea>` in the app MUST have either:
- A wrapping `<label>` element
- An associated `<label htmlFor="id">` with matching `id`
- An `aria-label` attribute
- An `aria-labelledby` reference

The axe-core accessibility audit in E2E enforces this at the `critical`+`serious` level.
Visual-only labels (sibling text without programmatic association) are insufficient.

### 2. E2E mocks MUST match actual API endpoints

Route mocks in E2E tests must intercept the exact endpoints the component calls.
Glob patterns (`**/api/**`) are preferred over specific paths when testing global
behaviors (like 401 handling) to avoid drift between mock and implementation.

### 3. Scheduled E2E SHOULD run against production builds

The scheduled cross-browser E2E job should use `pnpm build && pnpm preview` rather
than Vite dev server to avoid HMR/dynamic-import instability. Dev server is acceptable
for local development iteration and smoke tests, but full cross-browser suites need
the stability of a production bundle.

## Consequences

- AuditLogPage and any future forms must pass axe-core audit before merge.
- E2E tests become more reliable in CI, reducing false-positive failure issues.
- Slightly longer CI time for scheduled E2E (build step), but already runs on schedule
  so this is acceptable.

# 009 – E2E Test Plan & Executable Matrix (2026 Refresh)

**Status:** Active
**Last Updated:** 2026-04-15
**Owner:** Web Platform Team

## Objective

Define the end-to-end testing strategy for EPUB Studio, mapping business scenarios to executable Playwright scripts and ensuring critical paths are protected via a high-velocity smoke suite.

## Executable Matrix

Every scenario here corresponds to a verified, executable spec file in `apps/tests/`.

| Scenario Bucket | Spec File | Tags | Description |
| --- | --- | --- | --- |
| **Authentication** | `login-and-book-load.spec.ts` | `@smoke` | Login page rendering, form validation, and successful session creation. |
| **Reader Boot** | `login-and-book-load.spec.ts` | `@smoke` | EPUB loading, TOC rendering, and basic navigation after login. |
| **Annotations** | `reader-annotations-and-admin.spec.ts` | `regression` | Creating, editing, and deleting highlights, comments, and bookmarks. |
| **Admin Access** | `reader-annotations-and-admin.spec.ts` | `@smoke` | Admin login page accessibility and role-based route protection. |
| **Accessibility** | `accessibility-audit.spec.ts` | `nightly` | Automated Axe-core scans across login, reader, and admin pages. |
| **i18n** | `reader-annotations-and-admin.spec.ts` | `regression` | Locale switching and persistence across sessions. |

## CI Execution Strategy

### 1. PR Validation (Smoke)
- **Command:** `pnpm test:e2e:smoke`
- **Filter:** `@smoke`
- **Target:** Chromium, Firefox
- **Goal:** Verify core auth and boot paths in < 5 minutes.

### 2. Nightly / Main Branch (Full)
- **Command:** `pnpm test:e2e`
- **Target:** All browsers (Chromium, Firefox, and optional WebKit via `PLAYWRIGHT_INCLUDE_WEBKIT=1`)
- **Goal:** Full regression coverage including edge cases and a11y audits.

## Manual Verification Backlog (P2)
These scenarios are not yet automated and require manual check before major releases:
- Large file upload (100MB+ EPUBs).
- Full offline sync conflict resolution.
- Complex CFI re-anchoring across major book revisions.


# Plan 015: Warnings and Known Issues

**Last Updated:** see git log

This document tracks all warnings and known issues in the codebase as of the current date.

---

## Current Diagnostics

### ESLint Warnings

| File | Line | Warning | Severity |
|------|------|---------|----------|
| `apps/web/src/components/ui/index.tsx` | 224 | `Unexpected any. Specify a different type` | Low |
| `apps/worker/src/__tests__/cors.test.ts` | 8 | `Unexpected any. Specify a different type` | Low |

### Tailwind CSS Warnings

| File | Line | Issue | Suggestion |
|------|------|-------|------------|
| `apps/web/src/features/reader/ReaderPage.tsx` | 766 | `max-w-[200px]` | Use `max-w-50` |
| `packages/ui/src/toast.tsx` | 84 | `min-w-[300px]` | Use `min-w-75` |

---

## Pre-existing Issues (From Known Issues)

### Skill Category Validation

- **Status:** Documented in `agents-docs/KNOWN-ISSUES.md`
- **Issue:** 3 skills fail validation due to category case mismatch (`cicd-pipeline`, `privacy-first`, `test-runner`)
- **Impact:** Quality gate reports failure but core checks (lint/typecheck/test) pass

### React 18 / Vitest Concurrency

- **Status:** Documented in `agents-docs/KNOWN-ISSUES.md`
- **Issue:** Some admin and reader test suites are skipped due to React 18 scheduler conflicts
- **Impact:** Reduced test coverage in specific components

---

### Code Quality Issues

### Files Exceeding LOC Limits

Per `AGENTS.md` (`MAX_LINES_PER_SOURCE_FILE=500`):

| File | Current LOC | Status |
|------|-------------|--------|
| `apps/web/src/features/reader/ReaderPage.tsx` | 492 | ✅ Resolved |
| `apps/web/src/features/admin/GrantsPage.tsx` | 311 | ✅ Resolved |
| `apps/web/src/components/ui/index.tsx` | 525 | ⚠️ Near limit |

---

## Testing Gaps

| Gap | Severity | Status |
|-----|----------|--------|
| CFI navigation tests | High | Open |
| EPUB parsing tests | High | Open |
| Password hashing tests | High | Open |
| Bookmark CRUD tests | Medium | Open |

---

## Action Items

### Completed (This Session)

- [x] **All quality gates pass** — lint, typecheck, test:coverage, build, e2e:smoke
- [x] **PR #111**: Fixed dep versions, ESLint rules, restored setup-local.md, added main.tsx tests
- [x] **PR #119**: Created rate-limiter.ts with in-memory Map, added 9 audit tests + 2 CORS tests, fixed admin-auth.ts audit redaction, relaxed slug regex
- [x] **PR #120**: Fixed CSS overflow on body (removed `overflow-x: clip`)
- [x] **Issue #114**: Sign-out always visible, slug fallback uses i18n key
- [x] **Issue #115**: Modal ARIA attributes + focus trap + Escape handler
- [x] **Issue #116**: Unified theme via `data-theme` + CSS custom properties
- [x] **Issue #117**: `<MotionConfig reducedMotion="user">` in main.tsx
- [x] **Issue #118**: Removed `whileFocus` from Input component
- [x] **E2E test fixes**: Fixed heading selector, form labels, button selector, login flow navigation

### Resolved (Sprint Completion Swarm)

- [x] Skill categories validation — was already correct, removed stale KNOWN-ISSUES.md entry
- [x] CFI navigation tests (T-1) — expanded to 68 tests with property-based tests
- [x] `CommentsPanel.tsx` at 544 LOC — split into CommentsPanel (230), CommentItem (190), HighlightItem (116), formatDate (15)
- [x] `components/ui/index.tsx` at 615 LOC — migrated to packages/ui as 11 individual files; apps/web/index.tsx is 31 LOC re-export

---

## References

- `agents-docs/KNOWN-ISSUES.md` - Pre-existing unfixable issues
- `plans/010-optimization-quality-backlog.md` - Quality improvements backlog
- `plans/012-comprehensive-analysis-findings.md` - Full analysis

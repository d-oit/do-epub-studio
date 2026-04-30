# Plan 015: Warnings and Known Issues

**Last Updated:** 2026-04-30

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

## Code Quality Issues

### Files Exceeding LOC Limits

Per `AGENTS.md` (`MAX_LINES_PER_SOURCE_FILE=500`):

| File | Current LOC | Status |
|------|-------------|--------|
| `apps/web/src/features/reader/ReaderPage.tsx` | 1123 | 🔴 Over limit |
| `apps/web/src/features/admin/GrantsPage.tsx` | 740 | 🔴 Over limit |
| `apps/web/src/features/reader/components/annotations/CommentsPanel.tsx` | 544 | ⚠️ Near limit |
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

### Immediate (This Sprint)

- [ ] Fix Tailwind warnings in `ReaderPage.tsx` and `toast.tsx`
- [ ] Update skill categories to fix validation (or document as known issue)

### Short Term

- [ ] Refactor `ReaderPage.tsx` to split into components (< 500 LOC)
- [ ] Refactor `GrantsPage.tsx` to split into components (< 500 LOC)
- [ ] Add missing tests (CFI, password hashing, bookmarks)

---

## References

- `agents-docs/KNOWN-ISSUES.md` - Pre-existing unfixable issues
- `plans/010-optimization-quality-backlog.md` - Quality improvements backlog
- `plans/012-comprehensive-analysis-findings.md` - Full analysis

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

- [x] Fix Tailwind warnings in `ReaderPage.tsx` (`max-w-50` used in ReaderToolbar)
- [x] Fix toast memory leak timeout tracking
- [ ] Update skill categories to fix validation (pre-existing known issue)

### Short Term

- [x] Refactor `ReaderPage.tsx` to split into components (492 LOC) — DONE
- [x] Refactor `GrantsPage.tsx` to split into components (311 LOC) — DONE
- [x] Add missing tests (password hashing, bookmarks) — DONE
- [x] Fix memory leaks in sync.ts and db.ts — DONE
- [x] Add traceId telemetry to sync.ts and sw.ts — DONE
- [ ] Add CFI navigation tests (T-1) — partial
- [ ] `CommentsPanel.tsx` still at 544 LOC — monitor

---

## References

- `agents-docs/KNOWN-ISSUES.md` - Pre-existing unfixable issues
- `plans/010-optimization-quality-backlog.md` - Quality improvements backlog
- `plans/012-comprehensive-analysis-findings.md` - Full analysis

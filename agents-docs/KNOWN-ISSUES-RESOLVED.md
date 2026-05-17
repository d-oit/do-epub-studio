# Resolved Known Issues

> Archive of previously documented known issues that have been successfully resolved.

---

### [Testing Infrastructure] (RESOLVED)

**Issue:** `Error: Should not already be working.` (React 18 concurrent rendering failure during RTL cleanup)

**Location:** `apps/web/src/features/admin/BooksPage.test.tsx`, `apps/web/src/features/admin/GrantsPage.test.tsx`, `apps/web/src/features/admin/AuditLogPage.test.tsx`, `apps/web/src/features/reader/components/annotations/CommentInput.test.tsx`

**Reason:** Running these suites unskipped in the current Vitest/jsdom configuration triggers a React 18 scheduler conflict and root cleanup race (`performConcurrentWorkOnRoot`) that cascades into unrelated test files.

**Resolution:** Migrated to React 19. The concurrent rendering state issues are no longer present, and tests pass without being skipped.

**Date Resolved:** 2026-05-20

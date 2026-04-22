# Known Issues

> Document unfixable warnings, errors, and limitations that cannot be resolved due to tool/library constraints.

## Purpose

Some issues cannot be resolved due to:

- Missing type definitions from third-party libraries
- Tool limitations (linter cannot detect false positives)
- Architectural constraints (fix would break other functionality)
- External dependencies (waiting on upstream fix)

This file documents them so they are not repeatedly flagged during verification.

## Format

Each entry must include:

```markdown
### [Category]

**Issue:** `[exact warning/error message]`

**Location:** `path/to/file:line` (or multiple files)

**Reason:** Why this cannot be fixed

**Mitigation:** How we handle it (if applicable)

**Date:** YYYY-MM-DD (when documented)
```

---

## Active Known Issues

<!-- Add entries below as issues are encountered that cannot be fixed -->

(No active issues yet. Add entries as unfixable warnings are encountered.)

---

## Validation Rules

Before adding an entry:

1. **Confirm unfixable** – Tried all reasonable approaches and failed
2. **No duplicates** – Check existing entries first
3. **Exact message** – Use the exact error/warning text for grep matching
4. **Mitigation documented** – Explain how we handle it

## Review Schedule

- Review quarterly to remove resolved entries
- Update mitigations that have changed
- Archive resolved to `agents-docs/KNOWN-ISSUES-RESOLVED.md` (create when needed)

### [Testing Infrastructure]

**Issue:** `Error: Should not already be working.` (React 18 concurrent rendering failure during RTL cleanup)

**Location:** `apps/web/src/features/admin/BooksPage.test.tsx`, `apps/web/src/features/admin/GrantsPage.test.tsx`, `apps/web/src/features/admin/AuditLogPage.test.tsx`, `apps/web/src/features/reader/components/annotations/CommentInput.test.tsx`

**Reason:** Running these suites unskipped in the current Vitest/jsdom configuration triggers a React 18 scheduler conflict and root cleanup race (`performConcurrentWorkOnRoot`) that cascades into unrelated test files.

**Mitigation:** Keep affected suites skipped until isolated test configuration is introduced (separate Vitest project or per-file isolation mode). Track completion in `plans/010-optimization-quality-backlog.md`.

**Date:** 2026-04-15

## Technical Debt: File Size
- **File**: `apps/web/src/features/reader/ReaderPage.tsx`
- **Issue**: File size (1100+ LOC) exceeds the 500 LOC limit defined in `AGENTS.md`.
- **Mitigation**: Critical rendering logic has been moved to `annotationRendering.ts`. Further extraction of handlers and effects into custom hooks (e.g., `useReaderAnnotations`, `useReaderSettings`) is recommended for the next phase.

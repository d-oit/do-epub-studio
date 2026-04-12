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

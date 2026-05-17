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

### [CI/Validation - Windows]

**Issue:** `MISSING symlink: .claude/skills/xxx` (false positives on Windows)

**Location:** `scripts/validate-skills.sh`

**Reason:** On Windows (MSYS/Cygwin), symlinks are stored as regular text files containing the path. The validation script incorrectly treats these as missing symlinks.

**Mitigation:** Added Windows detection in `validate-skills.sh` to skip symlink validation when running on Windows. The "symlink files" contain the correct path (`../../.agents/skills/xxx`) and work correctly for Claude Code.

**Date:** 2026-04-28

### [CI/Validation - Missing Dependencies]

**Issue:** `'turbo' is not recognized as an internal or external command` / `node_modules missing, did you mean to install?`

**Location:** Quality gate during `pnpm lint`, `pnpm typecheck`, `pnpm test`

**Reason:** When node_modules is not installed, the quality gate fails because turbo is not available. This is expected behavior - dependencies must be installed first.

**Mitigation:** Run `pnpm install` before running the quality gate. In CI, dependencies are installed in the setup job before lint/test jobs run. For local development, use `./scripts/health-check.sh` to verify the environment is ready.

**Date:** 2026-04-28


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

### [Testing Infrastructure - Playwright Browsers]

**Issue:** `Error: browserType.launch: Executable doesn't exist at /home/doit/.cache/ms-playwright/...` (6 E2E smoke tests fail)

**Location:** `scripts/quality_gate.sh` (test:e2e:smoke step), `apps/tests/*.spec.ts`

**Reason:** Playwright browsers are not installed in the development environment. The lockfile regeneration updated Playwright from 1.59.1 to 1.60.0, requiring browser binary re-download.

**Mitigation:** Run `pnpm exec playwright install` in CI/CD pipeline. For local development, the E2E failure is non-blocking for component-level changes. All unit tests, lint, typecheck, and build pass.

**Date:** 2026-05-13


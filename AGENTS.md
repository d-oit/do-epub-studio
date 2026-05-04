# AGENTS.md

**Single source of truth for all AI coding agents.** Read ALL sections before starting work.

---

## Named Constants

```bash
# File size limits (lines)
readonly MAX_LINES_PER_SOURCE_FILE=500
readonly MAX_LINES_PER_SKILL_MD=250
readonly MAX_LINES_AGENTS_MD=150

# Git/PR configuration
readonly MAX_COMMIT_SUBJECT_LENGTH=72
readonly MAX_PR_TITLE_LENGTH=72
```

---

## TIER 1 — CRITICAL (Must Follow)

**NEVER ignore these rules. Violations cause security incidents or data loss.**

- **MUST fetch and integrate latest `main` branch before starting any changes.** Run `git fetch origin main && git merge origin/main` (or rebase) to stay up-to-date.
- **NEVER commit to `main` directly.** Always use feature branches + PRs.
- **NEVER leak secrets, tokens, or credentials in code.** Use `.dev.vars` for local only.
- **NEVER expose R2 file URLs to clients.** Use signed URLs via Workers.
- **NEVER skip tests for core permission, sync, or auth flows.**
- **MUST use Argon2id for password hashing.** Never use bcrypt/scrypt.
- **MUST revoke sessions immediately on grant change.**
- **MUST use multi-signal locators (CFI + text + chapter) for annotations per ADR-006.**
- **MUST emit traceId on every Worker request and critical UI action.**

---

## TIER 2 — QUALITY GATES (Blocking)

**Run these before every commit. Failures block merge.**

1. **Run `./scripts/quality_gate.sh` before commit.** No exceptions.
2. **Use `./scripts/atomic-commit/run.sh --message "type(scope): description"`.**
3. **Coverage Thresholds:** Enforce minimum coverage via `test:coverage`.
   - `web`: 40% Lines, 30% Functions
   - `worker`: 55% Lines, 50% Functions
   - `shared`: 25% Lines, 5% Functions
   - `reader-core`: 75% Lines, 70% Functions
4. **Validate commit message:** Run `./scripts/validate-commit-message.sh` or ensure format matches `type(scope): description` (max 72 chars).
4. **NEVER ignore lint warnings, typecheck errors, or test failures.**
5. **If a lint rule is disabled, add inline comment explaining why.**
6. **Run diagnostics and document all warnings.** After any change, run `diagnostics` tool and document any new warnings in `plans/015-warnings-and-issues.md` or `agents-docs/KNOWN-ISSUES.md` if unfixable.
7. **Fix pre-existing issues in files you touch.** Don't leave them for later.
8. **Document unfixable issues in `agents-docs/KNOWN-ISSUES.md`.** If a warning/error cannot be fixed in the current run (e.g., pre-existing, tool limitations), document it with the exact message, location, reason, and mitigation.

---

## TIER 3 — STYLE (Guidelines)

**Follow these for consistency. Non-blocking but reviewed.**

- **Max 500 LOC per source file.**
- **No hardcoded environment-specific URLs.**
- **No hardcoded dates.** Use current date from environment: `date +"%Y-%m-%d"` or `new Date().toISOString()`. Never write literal dates like "September 2025" in plans/documentation.
- **No `any` unless justified and isolated.**
- **Use Zod for boundary validation, Zustand for state, Tailwind for styling.**
- **Use Vitest + Playwright with `pool: 'forks'` for test isolation.**
- **Document coding workflow changes via `learn` skill.**

---

## TIER 4 — REFERENCE (See Agents-Docs)

- **Architecture decisions:** See `docs/coding-guide.md` and `plans/002-006`
- **TRIZ analysis:** See `plans/001-triz-analysis.md` + `plans/002-triz-resolution.md`
- **Skills catalog:** Run `ls .agents/skills/` or see `agents-docs/AVAILABLE_SKILLS.md`
- **Learnings:** See `agents-docs/LEARNINGS.md`
- **Current phase:** See `plans/007-implementation-phases.md`

---

## Compliance Self-Check

Run this before finalizing ANY response:

- [ ] Did I read ALL of AGENTS.md (not just first half)?
- [ ] Did I fetch and merge latest main branch before starting work?
- [ ] Did I check Named Constants for any values I used?
- [ ] Did I verify no secrets/tokens in my output?
- [ ] Did I run quality gate before commit?
- [ ] Is my commit message under 72 chars with correct format?
- [ ] Did I use feature branch (not main) for changes?

---

## Skills Reference

| Category | Skills |
|----------|--------|
| **Coordination** | `goap-agent`, `triz-analysis`, `triz-solver`, `task-decomposition`, `agent-coordination`, `learn`, `do-web-doc-resolver` |
| **Backend** | `cloudflare-worker-api`, `secure-invite-and-access`, `turso-schema-migrations`, `pwa-offline-sync`, `cicd-pipeline` |
| **Reader/UI** | `epub-rendering-and-cfi`, `reader-ui-ux`, `accessibility-auditor` |
| **Testing** | `testing-strategy`, `testdata-builders`, `test-runner`, `dogfood` |
| **DevOps** | `github-workflow`, `cicd-pipeline`, `migration-refactoring` |
| **Workflow** | `github-actions-version-fix` |
| **Security** | `security-code-auditor`, `privacy-first` |
| **Quality** | `code-quality`, `code-review-assistant`, `shell-script-quality`, `anti-ai-slop`, `agents-md` |

---

## Key Commands

```bash
# Quality gates
./scripts/quality_gate.sh          # Full gate (lint + typecheck + test)
./scripts/minimal_quality_gate.sh  # Fast gate (lint + typecheck only)
./scripts/health-check.sh          # Dev environment check

# Commit workflow
./scripts/atomic-commit/run.sh --message "type(scope): description"
./scripts/atomic-commit/run.sh --dry-run
./scripts/validate-commit-message.sh <file>  # Validate commit message

# Skills
skill learn                         # Capture discoveries
skill <skill-name>                  # Load specific skill
```

---

*See `agents-docs/` for detailed documentation on workflow, hooks, context management, and troubleshooting.*
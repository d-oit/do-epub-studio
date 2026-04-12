# Workflow Reference

> Detailed workflow procedures referenced by AGENTS.md. Read this for step-by-step execution details.

## Full Verification Sequence

**Execute before every commit, in order:**

### 1. Load Memory Context

```bash
# Recommended: use learn skill
skill learn

# Alternative: manual check
cat agents-docs/LEARNINGS.md
```

Why: Prior learnings may contain relevant context about fragile config, tool quirks, or hidden dependencies that affect your current task.

### 2. Run Quality Gate

```bash
./scripts/quality_gate.sh
```

The quality gate is **non-blocking on warnings** but **blocking on errors**.

Checks executed (in order):

1. `validate-git-hooks.sh` - Detects global hooks overriding local (non-blocking)
2. `validate-github-actions-shas.sh` - No placeholder SHAs in workflows
3. `validate-skills.sh` - Skill symlinks intact
4. `validate-skill-format.sh` - SKILL.md frontmatter valid
5. `validate-links.sh` - Reference links in skills exist
6. Language detection + lint/typecheck/test

### 3. Fix Loop

When quality gate fails:

```bash
# Read error output, fix issues, then:
./scripts/quality_gate.sh

# Repeat until exit 0
```

**Rules:**

- Fix ALL errors and warnings
- Include pre-existing issues in files you touched
- Never use `--no-verify`, `SKIP_TESTS`, or bypass flags
- These flags **do not exist** in this project

### 4. Skill-Based Remediation

Match the issue type to the correct skill:

| Issue | Skill | Action |
|-------|-------|--------|
| Lint/style errors | Manual fix | Direct code edit |
| Code smells | `code-quality` | Refactor at file level |
| Cross-file issues | `code-review-assistant` | PR-level analysis |
| Shell errors | `shell-script-quality` | ShellCheck + BATS |
| Security flaws | `security-code-auditor` | Read-only audit |
| Architecture trade-offs | `triz-analysis` → `triz-solver` | Design resolution |
| Generic UI text | `anti-ai-slop` | Humanize copy |

### 5. Document Unfixable Issues

If an issue cannot be fixed:

1. Check `agents-docs/KNOWN-ISSUES.md` for existing entries
2. Add new entry with: exact message, location, reason, mitigation
3. Re-run quality gate

### 6. Atomic Commit

```bash
# Full workflow (includes all verification)
./scripts/atomic-commit/run.sh --message "type(scope): description"

# Dry-run only
./scripts/atomic-commit/run.sh --dry-run
```

---

## Pre-Existing Issue Resolution

**Fix ALL pre-existing issues before completing any task:**

- [ ] Lint warnings (eslint, shellcheck, markdownlint)
- [ ] TypeScript errors
- [ ] Test failures
- [ ] Security vulnerabilities
- [ ] Documentation gaps (broken links, missing files)
- [ ] Code style violations

**Process:**

1. Run quality gate: `./scripts/quality_gate.sh`
2. Note all failures (even unrelated to your changes)
3. Fix ALL issues using appropriate skills
4. Re-run quality gate to confirm zero failures
5. Document unfixable issues in `agents-docs/KNOWN-ISSUES.md`

---

## Atomic Commit Workflow

```bash
# Create feature branch
git checkout -b feat/your-feature-name

# Make changes, then commit
git add .
./scripts/atomic-commit/run.sh --message "feat(scope): description"

# Or use conventional commit directly (hooks enforce format)
git commit -m "feat(scope): description"
git push -u origin HEAD
```

**Atomic commit phases:**

| Phase | Script | Purpose |
|-------|--------|---------|
| PRE_COMMIT | `validate.sh` | Quality gate + secret scan + branch check |
| COMMIT | `commit.sh` | Conventional commit creation |
| PRE_PUSH | `push.sh --check-only` | Conflict detection |
| PUSH | `push.sh` | Push to origin |
| PR_CREATE | `create-pr.sh` | GitHub PR creation |
| VERIFY | `verify.sh` | CI check wait with timeout |

**Rollback on failure:**

- Commit failure → reset soft HEAD~1
- Push failure → force push rollback
- PR failure → close PR, rollback push, rollback commit

---

## Post-Task Learning

After non-trivial work, capture non-obvious discoveries:

1. **Run the `learn` skill** - extracts insights automatically
2. **Capture only**: hidden file relationships, surprising execution behavior, undocumented commands, fragile config, files that must change together
3. **Never write**: obvious facts, duplicates, verbose explanations, session-specific notes
4. **Scoping**: project-wide → `agents-docs/LEARNINGS.md`; script-specific → `scripts/AGENTS.md`; skill-specific → `.agents/skills/<name>/AGENTS.md`

---

## No Escape Hatches

This project enforces **zero bypass** of quality gates:

| Variable/Flag | Status | Note |
|---------------|--------|------|
| `SKIP_TESTS` | Does not exist | Tests always run |
| `--skip-ci` | Does not exist | CI always verified |
| `ATOMIC_COMMIT_SKIP_QUALITY_GATE` | Does not exist | Quality gate mandatory |
| `--no-rollback` | Does not exist | Rollback always executes |
| `SKIP_GLOBAL_HOOKS_CHECK` | Does not exist | Git hooks always checked |
| `--no-verify` | Forbidden | Never use this |

If a check fails, fix the root cause. Do not silence it.

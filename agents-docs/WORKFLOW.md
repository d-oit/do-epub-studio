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

### Scoped Fast Commands

For faster iteration, use these scoped commands during the "Fix Loop" before running the full quality gate:

- **Fast Verification:** `pnpm verify:fast` (lint + typecheck + subset of critical tests)
- **Scoped Tests:** `pnpm test --filter <package-name>`
- **Smoke Tests:** `pnpm test:e2e:smoke`
- **Coverage:** `pnpm test:coverage`
- **Workflow Lint:** `pnpm lint:workflows`
- **Benchmarks:** `pnpm bench`

> **Note:** While fast commands speed up development, `./scripts/quality_gate.sh` is still **REQUIRED** to exit 0 before any commit or PR submission.

Checks executed (in order):

1. `check-harness-version.mjs` — installed `do-harness` matches `.do-harness-version`
2. `validate-git-hooks.sh` — detects global hooks overriding local
3. `validate-workflows.sh` — actionlint + zizmor (medium+) on `.github/workflows`
4. `validate-skills.sh` — skill symlinks intact
5. `check-agent-sync.mjs` — per-model adapter drift
6. `check-app-identity.mjs` — app identity and version governance (ADR-104)
7. Documentation and index phases (`scripts/lib/quality_gate_docs.sh`): ADR index, plan references, 500-line source cap, Prettier `format:check`, coverage-threshold parity, gate-parity manifest, SKILL.md format, skill links, skills-catalog freshness
8. `lint` → `typecheck` → `test:coverage` → `test:e2e:smoke` → `build` (TypeScript path)
9. markdownlint (when installed)
10. `run-impeccable.sh` — design detector (warnings unless `IMPECCABLE_REQUIRED=1`)
11. `dead-code-check.sh` — dead code and circular dependencies

Exit 0 = all required phases ran and passed. Exit 2 = failures. Exit 3 = passed
with `SKIP_*` phases omitted — **not** a passing gate for commits.

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
- Never use `--no-verify` to skip the pre-commit hook
- `SKIP_LINT` / `SKIP_TYPECHECK` / `SKIP_TESTS` / `SKIP_SMOKE` / `SKIP_BUILD` /
  `SKIP_DESIGN` exist for local iteration only; each one makes the gate exit 3,
  which `atomic-commit` rejects. CI never sets them.
- `QUALITY_GATE_NO_SMOKE=1` is the exception: CI uses it where the gate's
  dev-server smoke lane cannot reach a Worker backend, and it does not warn.

### 4. Skill-Based Remediation

Match the issue type to the correct skill:

| Issue                   | Skill                           | Action                 |
| ----------------------- | ------------------------------- | ---------------------- |
| Lint/style errors       | Manual fix                      | Direct code edit       |
| Code smells             | `code-quality`                  | Refactor at file level |
| Cross-file issues       | `code-review-assistant`         | PR-level analysis      |
| Shell errors            | `shell-script-quality`          | ShellCheck + BATS      |
| Security flaws          | `security-code-auditor`         | Read-only audit        |
| Architecture trade-offs | `triz-analysis` → `triz-solver` | Design resolution      |
| Generic UI text         | `anti-ai-slop`                  | Humanize copy          |

### 5. Document Unfixable Issues

If an issue cannot be fixed:

1. Check `agents-docs/KNOWN-ISSUES.md` for existing entries
2. Add new entry with: exact message, location, reason, mitigation
3. Re-run quality gate

### 6. Atomic Commit

```bash
# Full workflow (includes all verification)
./scripts/atomic-commit/run.sh --message "type(scope): description" --body "WHY"

# Dry-run only
./scripts/atomic-commit/run.sh --dry-run
```

### 7. Capture Learnings (Mandatory)

After every non-trivial change — before opening the PR:

1. Load the `learn` skill and extract non-obvious discoveries from the work
   just completed (see [Post-Task Learning](#post-task-learning) for what
   qualifies).
2. File each learning in its scoped location (project-wide →
   `agents-docs/LEARNINGS.md`; script → `scripts/AGENTS.md`; skill →
   `.agents/skills/<name>/AGENTS.md`).
3. Include the learnings in the same PR that produced them. If there is
   genuinely nothing non-obvious, state "no new learnings" in the PR
   description — silence is not a valid skip.

A PR is not complete until this step is done (AGENTS.md Tier 2 #12).

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
./scripts/atomic-commit/run.sh --message "feat(scope): description" --body "WHY"

# Or use conventional commit directly (hooks enforce format)
git commit -m "feat(scope): description"
git push -u origin HEAD
```

**Atomic commit phases:**

| Phase      | Script                 | Purpose                                   |
| ---------- | ---------------------- | ----------------------------------------- |
| PRE_COMMIT | `validate.sh`          | Quality gate + secret scan + branch check |
| COMMIT     | `commit.sh`            | Conventional commit creation              |
| PRE_PUSH   | `push.sh --check-only` | Conflict detection                        |
| PUSH       | `push.sh`              | Push to origin                            |
| PR_CREATE  | `create-pr.sh`         | GitHub PR creation                        |
| VERIFY     | `verify.sh`            | CI check wait with timeout                |

**Rollback on failure:**

- Commit failure → reset soft HEAD~1
- Push failure → force push rollback
- PR failure → close PR, rollback push, rollback commit

---

## Post-Task Learning

> Mandatory per AGENTS.md Tier 2 #12 — see Step 7 of the Full Verification
> Sequence for where this runs in the commit flow.

After non-trivial work, capture non-obvious discoveries:

1. **Run the `learn` skill** - extracts insights automatically
2. **Capture only**: hidden file relationships, surprising execution behavior, undocumented commands, fragile config, files that must change together
3. **Never write**: obvious facts, duplicates, verbose explanations, session-specific notes
4. **Scoping**: project-wide → `agents-docs/LEARNINGS.md`; script-specific → `scripts/AGENTS.md`; skill-specific → `.agents/skills/<name>/AGENTS.md`

---

## No Escape Hatches

This project enforces **zero bypass** of quality gates:

| Variable/Flag                     | Status         | Note                     |
| --------------------------------- | -------------- | ------------------------ |
| `SKIP_TESTS`                      | Does not exist | Tests always run         |
| `--skip-ci`                       | Does not exist | CI always verified       |
| `ATOMIC_COMMIT_SKIP_QUALITY_GATE` | Does not exist | Quality gate mandatory   |
| `--no-rollback`                   | Does not exist | Rollback always executes |
| `SKIP_GLOBAL_HOOKS_CHECK`         | Does not exist | Git hooks always checked |
| `--no-verify`                     | Forbidden      | Never use this           |

If a check fails, fix the root cause. Do not silence it.

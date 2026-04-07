# Workflow Reference

> Detailed workflow procedures referenced by AGENTS.md.

## Pre-Existing Issue Resolution

**Fix ALL pre-existing issues before completing any task:**

- [ ] Lint warnings (shellcheck, markdownlint)
- [ ] Test failures
- [ ] Security vulnerabilities
- [ ] Documentation gaps (broken links, missing files)
- [ ] Code style violations

**Process:**

1. Run quality gate: `./scripts/quality_gate.sh`
2. Note all failures (even unrelated to your changes)
3. Fix ALL issues
4. Re-run quality gate to confirm zero failures

## Atomic Commit Workflow

```bash
# Create feature branch
git checkout -b feat/your-feature-name

# Make changes, then commit
git add .
git commit -m "feat(scope): description"
git push -u origin HEAD
```

## Post-Task Learning

After non-trivial work, capture non-obvious discoveries:

1. **Run the `learn` skill** if available, or manually append to the nearest relevant `AGENTS.md`
2. **Capture only**: hidden file relationships, surprising execution behavior, undocumented commands, fragile config, files that must change together
3. **Never write**: obvious facts, duplicates, verbose explanations, session-specific notes
4. **Scoping**: project-wide → root `AGENTS.md`; script-specific → `scripts/AGENTS.md`; skill-specific → `.agents/skills/<name>/AGENTS.md`

## Quality Gate Usage

```bash
# Full quality gate (required before commit)
./scripts/quality_gate.sh

# Skip specific checks
SKIP_TESTS=true ./scripts/quality_gate.sh
```

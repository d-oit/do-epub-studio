---
version: "1.0.0"
name: agents-md
description: >
  Create AGENTS.md files with production-ready best practices. Activate when
  creating new AGENTS.md or implementing quality gates.
category: quality
allowed-tools: Read Write Edit Glob
license: MIT
---

# AGENTS.md Skill

Create comprehensive AGENTS.md files that serve as the single source of truth for AI coding agents.

## When to Use

- Creating a new project's AGENTS.md
- Updating existing AGENTS.md with new best practices
- Onboarding new team members
- Setting up quality gates for AI agents

## Structure

### Required Sections

1. **Named Constants** - Project-specific limits and configurations
2. **TIER 1 — CRITICAL** - Non-negotiable security/safety rules
3. **TIER 2 — QUALITY GATES** - Blocking checks before merge
4. **TIER 3 — STYLE** - Guidelines (non-blocking but reviewed)
5. **TIER 4 — REFERENCE** - Links to detailed documentation
6. **Compliance Self-Check** - Checklist for agents to run before responding

## Named Constants Template

```bash
readonly MAX_LINES_PER_SOURCE_FILE=500
readonly MAX_LINES_PER_SKILL_MD=250
readonly MAX_COMMIT_SUBJECT_LENGTH=72
```

## TIER 1 — CRITICAL Examples

```markdown
## TIER 1 — CRITICAL (Must Follow)

- **NEVER commit to `main` directly.** Always use feature branches + PRs.
- **NEVER leak secrets.** Use environment variables, never hardcode.
- **MUST use Argon2id for password hashing.**
```

### Project-Specific TIER 1 Rules

| Rule Type | Example |
|-----------|---------|
| Security | Never expose R2 file URLs - use signed URLs |
| Auth | Revoke sessions immediately on permission change |
| Data | Use multi-signal locators for annotations |

## TIER 2 — QUALITY GATES Examples

```markdown
## TIER 2 — QUALITY GATES (Blocking)

1. Run `./scripts/quality_gate.sh` before commit.
2. Use atomic commit workflow: `./scripts/atomic-commit/run.sh`
3. Commit messages MUST follow: `type(scope): description`
```

## TIER 3 — STYLE Examples

```markdown
## TIER 3 — STYLE (Guidelines)

- Max 500 LOC per source file
- No hardcoded environment URLs
- Use Zod for validation, Zustand for state
- Use Vitest + Playwright for testing
```

## Compliance Self-Check Template

```markdown
## Compliance Self-Check

- [ ] Did I read ALL of AGENTS.md?
- [ ] Did I check Named Constants?
- [ ] Did I verify no secrets in output?
- [ ] Did I run quality gate?
- [ ] Is commit message under 72 chars?
- [ ] Did I use feature branch?
```

## Skills Reference Table

```markdown
## Skills Reference

| Category | Skills |
|----------|--------|
| Backend | cloudflare-worker-api, secure-invite-and-access |
| Frontend | reader-ui-ux, epub-rendering |
| Testing | testing-strategy, testdata-builders, dogfood |
| Quality | code-quality, security-code-auditor, anti-ai-slop |
```

## Key Commands Section

```bash
# Quality gates
./scripts/quality_gate.sh

# Commit workflow
./scripts/atomic-commit/run.sh --message "type(scope): description"
```

## EPUB Studio Specific Customization

### TIER 1 Additions for EPUB Studio

```markdown
- **MUST use CFI locators for EPUB annotations** per ADR-006
- **MUST handle offline-first** with proper sync conflicts
- **MUST validate EPUB structure** before rendering
```

## Quality Checklist

- [ ] All required sections present
- [ ] Named Constants match project实际情况
- [ ] TIER 1 rules are truly non-negotiable
- [ ] TIER 2 gates are enforceable
- [ ] Compliance checklist is actionable

## Integration

- **skill-creator**: Use to create new skills with proper structure
- **code-quality**: Enforce AGENTS.md rules in reviews

## Summary

Good AGENTS.md enables consistent, safe, high-quality AI-assisted development.

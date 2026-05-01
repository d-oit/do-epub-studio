---
version: "1.0.0"
name: code-review-assistant
description: >
  Review pull requests holistically. Activate for PR analysis, risk assessment,
  cross-file consistency, and change-impact review.
category: quality
allowed-tools: Read Grep Glob
license: MIT
---

# Code Review Assistant

Review pull requests holistically — analyzing diffs, risk, and cross-file impact.
**Not** for inline code smells (use `code-quality` for that).

## When to Use

- Reviewing completed pull requests
- Summarizing change impact across files
- Assessing risk level (auth, security, data)
- Checking cross-file consistency
- Verifying Delivery Definition from AGENTS.md

## Workflow

### Phase 1: Change Analysis

1. Identify modified files
2. Calculate metrics (lines changed, complexity)
3. Assess risk level
4. Detect patterns (features, bugs, refactoring)

### Phase 2: Quality Assessment

1. Style compliance with project conventions
2. Test coverage verification
3. Documentation updates
4. Security scan

### Phase 3: Feedback

1. Summarize changes
2. Identify issues
3. Suggest improvements
4. Generate review comments

## Risk Levels

| Risk | Patterns |
|------|----------|
| Critical | Auth, security, payments |
| High | API, models, database |
| Medium | Services, utils |
| Low | Tests, docs |

## Quality Checklist

- [ ] New code has tests
- [ ] No hardcoded secrets
- [ ] Security code reviewed
- [ ] Documentation updated
- [ ] Error handling added
- [ ] No debug code left
- [ ] Style guide compliant

## EPUB Studio Focus

- TypeScript conventions (Zod schemas, Zustand stores)
- EPUB parsing patterns
- Cloudflare Worker patterns
- Turso DB patterns

## References

- `references/patterns.md` - Common code patterns

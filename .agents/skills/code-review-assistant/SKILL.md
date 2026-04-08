---
version: "1.0.0"
name: code-review-assistant
description: Automated code review with PR analysis, change summaries, and quality checks. Use for reviewing pull requests, generating review comments, checking against best practices, and identifying potential issues in EPUB Studio code.
license: MIT
---

# Code Review Assistant

Automated code review with intelligent analysis of changes, quality checks, and actionable feedback.

## When to Use

- Reviewing pull requests
- Change summarization
- Style guide compliance
- Security issue detection
- Auto-approving simple changes

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

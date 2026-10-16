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

## When NOT to Use

- Inline code smells in a single file during active editing → use `code-quality`
- Finding comes from Codacy static analysis report → use `codacy`
- Orchestrating and applying the actual fixes once issues are identified → use `pr-review-fix`

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

## d.o.EPUB Studio Focus

- TypeScript conventions (Zod schemas, Zustand stores)
- EPUB parsing patterns
- Cloudflare Worker patterns
- Turso DB patterns

## Rationalizations

| Rationalization | Reality |
|-----------------|---------|
| "It's a test-only change, so I can skip the security scan." | Phase 2 runs the security scan on every PR, and the Quality Checklist requires no hardcoded secrets regardless of which files changed. |
| "The change is trivial, it doesn't need tests." | Quality Checklist: "New code has tests"; test coverage verification is a Phase 2 step, not a judgement call. |
| "I read the diff of the main file, the others are similar." | Phase 1 requires identifying *all* modified files and the cross-file impact; risk tiers (Critical: auth/security/payments, High: API/models/database) are assigned per change. |
| "Style and inline nits belong in this review too." | Inline code smells in a single active file are `code-quality`'s scope — this skill reviews the PR as a whole, not the diff line by line. |
| "I'll post comments as I find them." | Phase 3 orders feedback summary → issues → suggestions → comments, so every comment is grounded in the change-impact assessment. |

## Red Flags

- [ ] PR touching auth, security, or payments not classified Critical risk.
- [ ] Debug code (`console.log`, commented-out blocks) left in the diff.
- [ ] Secrets, tokens, or API keys written inline in code or config.
- [ ] New or changed behavior with no test and no documentation update.
- [ ] Review comments posted before a cross-file impact summary exists.

## References

- `references/patterns.md` - Common code patterns

# Summary

<!-- Provide a clear, concise summary of changes (2-3 sentences max) -->

**Change Summary:**

**Related Issue(s):**

- Fixes #<!-- issue number -->
- Closes #<!-- issue number -->

---

## Type of Change

**Select one (mandatory):**

- [ ] `feat:` New feature (non-breaking change adding functionality)
- [ ] `fix:` Bug fix (non-breaking change fixing an issue)
- [ ] `docs:` Documentation update only
- [ ] `style:` Code style changes (formatting, no logic changes)
- [ ] `refactor:` Code refactoring (no functional changes)
- [ ] `perf:` Performance improvements
- [ ] `test:` Adding or updating tests
- [ ] `ci:` CI/CD configuration changes
- [ ] `chore:` Build process or auxiliary tool changes
- [ ] `security:` Security-related changes

## Breaking Change?

- [ ] No - backward compatible
- [ ] Yes - requires migration guide

---

## Testing Performed

### Automated Tests

- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] E2E tests pass (if applicable)
- [ ] All existing tests continue to pass

**Test Commands Run:**

```bash
pnpm lint
pnpm typecheck
pnpm test
```

### Manual Testing

- [ ] Tested locally with realistic data
- [ ] Verified edge cases handled correctly
- [ ] Error paths tested

---

## Pre-Merge Checklist

### Code Quality

- [ ] **Lint/Format**: No warnings or errors (`pnpm lint`)
- [ ] **Type Safety**: All type checks pass (`pnpm typecheck`)
- [ ] **Dead Code**: No unused imports, variables, or functions

### Testing Requirements

- [ ] **Coverage**: No coverage regressions
- [ ] **New Code**: All new code has corresponding tests
- [ ] **Edge Cases**: Error conditions and edge cases are tested

### Documentation

- [ ] **Code Comments**: Complex logic is explained
- [ ] **Public APIs**: All public functions have docstrings
- [ ] **README**: User-facing changes reflected in docs
- [ ] **ADR**: Architectural decisions documented (if applicable)

### Review Requirements

- [ ] **Self-Review**: I have reviewed my own code first
- [ ] **Commit Quality**: Commits follow conventional commit format
- [ ] **Atomic Commits**: Each commit represents a single logical change
- [ ] **Secrets Check**: No API keys, passwords, or secrets committed

### CI/CD Verification

- [ ] **All Workflows Pass**: GitHub Actions green on this PR
- [ ] **Required Checks**: All mandatory status checks pass
- [ ] **No Conflicts**: Branch is rebased on latest `main`

---

## Impact Assessment

### Risk Level

- [ ] **Low**: Documentation, comments, formatting
- [ ] **Medium**: Refactoring, bug fixes in isolated components
- [ ] **High**: Core functionality, security, breaking changes

### Database Changes (if applicable)

- [ ] No database changes
- [ ] Schema changes (migration required)
- [ ] Data migration required

---

## Rollback Plan

<!-- For high-risk changes, describe how to revert if issues arise -->

**Rollback Strategy:**

- [ ] Simple revert via `git revert`
- [ ] Database migration rollback script provided
- [ ] Feature flag can disable quickly

---

## Reviewer Focus Areas

<!-- Help reviewers know where to focus their attention -->

- [ ] Logic correctness
- [ ] Security implications
- [ ] Performance impact
- [ ] API design and backward compatibility

---

## Final Confirmation

**By submitting this PR, I confirm:**

- [ ] I have read and followed the contributing guidelines
- [ ] All checked items above are true and verifiable
- [ ] I am available to address review feedback promptly

---
version: "1.0.0"
name: agents
description: Agent workflows, guardrails, security patterns, and handoff coordination for EPUB Studio
---

# Agent Workflows & Guardrails

## Security Guardrails (CRITICAL)

### Version Requirements
Always use **latest stable versions** with security patches:

| Package | Current | Latest Security | Notes |
|---------|---------|-----------------|-------|
| React | 18.x | 18.3.1+ | Avoid 18.0.x (early bugs) |
| TypeScript | 5.4+ | 5.8+ | Latest for type safety |
| Vitest | 1.x | 2.x | Upgrade recommended |
| Vite | 6.x | 6.2+ | Security fixes |
| Workbox | 7.4.x | 7.3.0+ | PWA caching |
| DOMPurify | (add) | 3.2+ | Required for EPUB sanitization |

### Before Any Implementation

1. **Check package versions**: Run `pnpm outdated` before adding dependencies
2. **Security audit**: Never use packages with known CVEs
3. **Minimal dependencies**: Only add what's necessary

### OWASP Top 10 Adaptations for EPUB

See `.agents/skills/security-code-auditor/references/owasp-top10.md`

Key guardrails:
- **Injection (A03)**: ALWAYS sanitize EPUB HTML with DOMPurify before rendering
- **Broken Access Control (A01)**: Check `hasAccess()` before ANY book content fetch
- **SSRF (A10)**: Block external URLs in EPUB content - use allowlists only

## Test Guardrails

### Vitest Configuration

```typescript
// vitest.config.ts - DO NOT use singleFork
test: {
  pool: 'forks',  // File-level isolation
  // NO singleFork: true - causes DOM pollution
}
```

### Test Isolation Rules

1. **Each test file runs in separate fork** - prevents cross-test interference
2. **Mock setup BEFORE render** - `mockResolvedValueOnce()` must be called before component mounts
3. **Clean up mocks in `beforeEach`** - `vi.clearAllMocks()`
4. **Use `waitFor` for async renders** - never assume immediate render

### Common Test Failures & Fixes

| Failure | Cause | Fix |
|---------|-------|-----|
| "Found multiple elements" | Tests sharing DOM | Remove `singleFork: true` |
| "Unable to find text" | Mock timing | Set mock BEFORE render |
| "Element not in document" | Race condition | Use `waitFor(() => ...)` |

## Handoff Coordination

### Agent Team Patterns

```
┌─────────────────┐
│   Team Lead     │  ← Creates tasks, assigns work
└────────┬────────┘
         │
    ┌────┴────┬────────────┐
    │         │            │
┌───┴───┐ ┌───┴───┐ ┌──────┴─────┐
│Agent A│ │Agent B│ │  Agent C   │
│(tests)│ │(docs) │ │ (security) │
└───┬───┘ └───┬───┘ └──────┬─────┘
    │         │            │
    └────┬────┴────────────┘
         │
┌────────┴────────┐
│  Task List      │  ← Shared coordination
└─────────────────┘
```

### Handoff Protocol

1. **Assign**: `TaskUpdate({ owner: "agent-name" })`
2. **Execute**: Agent marks `in_progress` then `completed`
3. **Signal completion**: Send `SendMessage` to team lead
4. **Team lead checks**: `TaskList()` to find next available work

### When to Spawn Parallel Agents

- **Independent tasks**: No dependencies between work items
- **Large file changes**: Multiple files needing similar work
- **Time-sensitive**: Multiple agents complete faster

## Pre-existing Issues Documentation

### Known Warnings (Do Not Fix)

1. **React Router Future Flags** (non-blocking)
   - `v7_startTransition` warning
   - `v7_relativeSplatPath` warning
   - **Why not fix**: Requires React Router v7 upgrade (breaking)
   - **Workaround**: Ignore until v7 migration planned

2. **ESLint `no-autofocus` in tests**
   - Test files use `autoFocus` to test the prop
   - **Why not fix**: Testing prop behavior is intentional
   - **Workaround**: `// eslint-disable-next-line jsx-a11y/no-autofocus`

### Security Issues (Must Fix)

| Issue | Severity | Status |
|-------|----------|--------|
| EPUB sanitization | HIGH | Not implemented - add DOMPurify |
| External URL blocking | MEDIUM | Partial - need allowlist |
| Session token rotation | MEDIUM | Not implemented |

## Reference Files

### Skill Documentation
- `.agents/skills/testing-strategy/SKILL.md` - Test planning
- `.agents/skills/security-code-auditor/SKILL.md` - Security patterns
- `.agents/skills/testdata-builders/SKILL.md` - Test data patterns

### Security References
- `.agents/skills/security-code-auditor/references/owasp-top10.md`
- `.agents/skills/security-code-auditor/references/security-checklist.md`

### Test References
- `.agents/skills/testing-strategy/references/test-patterns.md`
- `.agents/skills/testing-strategy/references/e2e-guide.md`

## Agent Skill Activation

| Task Type | Skill | Trigger |
|-----------|-------|---------|
| New feature tests | `testing-strategy` | Test planning |
| Auth/security code | `secure-invite-and-access` | Access endpoints |
| EPUB rendering | `epub-rendering-and-cfi` | Reader changes |
| Schema changes | `turso-schema-migrations` | DB migrations |
| Security audit | `security-code-auditor` | Code review |
| PR review | `code-review-assistant` | Pull requests |
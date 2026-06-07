# PR Verification Guide

**For:** Reviewers of `do-epub-studio` pull requests.
**Companion:** [PR_VERIFICATION_CHECKLIST.md](./PR_VERIFICATION_CHECKLIST.md).
**Last updated:** 2026-06-06 (issue #449).

## Why this guide?

`do-epub-studio` receives a high volume of PRs from AI agents (Jules,
Claude, Qwen, Windsurf). Mechanical code review ("does it lint?") misses
the kinds of failure modes AI-generated code tends to introduce:

- Hallucinated imports / APIs that compile but don't exist at runtime
- Tests that pass by asserting on the implementation, not the behavior
- "Fixes" that look correct but quietly weaken a security control
- TODOs / placeholders left in production code paths
- Real bugs masked by the new feature being a greenfield

This guide teaches reviewers how to spot those patterns.

## The 4-step review

### 1. Skim the diff (30 seconds)

Read the file list. Reject early if:

- Files outside the PR's stated scope were changed
- A `package.json` was modified without an explanation (new dep?)
- A `.github/workflows/` file was changed (security review)
- A `plans/` file was added (new ADR — read it)
- A `*.lock` or `pnpm-lock.yaml` was changed (Dependabot/automated only)

### 2. Triage the PR body (1 minute)

- Does the title match the conventional-commits format?
- Does the description explain **WHY** not just **WHAT**?
- Are the issues it closes actually addressed?
- For AI-authored PRs, is the `## AI-Agent Verification` section present?

### 3. Read the diff (5–15 minutes)

Read the diff line-by-line, not file-by-file. Watch for:

- `// @ts-ignore`, `// @ts-expect-error`, `as any`
- `eslint-disable` without an inline reason
- `console.log` / `console.error` / `console.warn` on critical paths
- Direct DOM mutation: `document.querySelector(...).innerHTML = ...`
- `dangerouslySetInnerHTML` without a sanitizer
- Hardcoded URLs / dates / ports
- Regex without `matchBounded` / `testBounded`
- `Math.random` used for security purposes
- New `any` type that wasn't justified
- Mutations of imported state (const arrays, etc.)

### 4. Run the checklist (2 minutes)

Walk through [PR_VERIFICATION_CHECKLIST.md](./PR_VERIFICATION_CHECKLIST.md)
top-to-bottom. Mark items as ✅, ❌, or N/A with a comment.

## Common AI-agent failure modes

### Hallucinated dependencies

```
import { safeRegex } from 'safe-regex-fork-2024';   // does this package exist?
```

Check the lockfile. If the import is not in `pnpm-lock.yaml`, the build
will fail in CI.

### Mocked-too-eagerly tests

```ts
// This test passes but doesn't test the thing:
it('works', () => {
  vi.mock('./sanitizer', () => ({ sanitize: () => 'ok' }));
  expect(myFn()).toBe('ok');
});
```

The test mocks the system under test. It can never fail. Reject.

### "Security improvements" that weaken security

```diff
- sandbox: ['allow-same-origin']                 # safe
+ sandbox: ['allow-same-origin', 'allow-scripts'] # unsafe
```

Sometimes agents add `allow-scripts` because it makes rendering "work
better." This is a regression. Reject.

### Inline TODOs in production code

```ts
// TODO: add proper error handling
void doSomething();
```

Open issues must be linked, not TODOs.

### "Fixed" a test instead of fixing the bug

```diff
- expect(result).toBe('correct');
+ expect(result).toBe('whatever the code does');
```

This is a test downgrade. Reject.

## When to request changes vs. approve

| Situation | Action |
|-----------|--------|
| Tests don't actually test the behavior | Request changes |
| Security regression (sandbox, CSP, hashing, sanitization) | Request changes, tag `security` |
| New `any`, `// @ts-ignore`, or `eslint-disable` | Request changes |
| Hardcoded URL/date/env | Request changes |
| Lockfile change without a Dependabot or renovate trail | Request changes |
| New dependency without license/security review | Request changes |
| Comment-only change that has no functional impact | Ask: is this necessary? |
| Minor style nit | Comment, do not block |
| Question for the author | Comment, mark as "question" not "request changes" |

## Approving a PR

When you approve:

1. Use the GitHub "Approve" review action
2. Leave a one-line summary of why you're approving
3. If you have non-blocking feedback, mark it as a "comment", not "request changes"
4. The author squashes and merges (linear history)

## After merging

- Verify the issue is auto-closed by the PR's `Closes #N` keyword
- Verify CI on `main` is still green
- If the change introduced a new monitoring signal, check it

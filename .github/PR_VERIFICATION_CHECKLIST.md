# PR Verification Checklist

**For:** Reviewers validating pull requests against `do-epub-studio`.
**Use with:** [PR_VERIFICATION_GUIDE.md](./PR_VERIFICATION_GUIDE.md).
**Last updated:** 2026-06-06 (issue #449).

## Quick Triage (60 seconds)

- [ ] Title follows `type(scope): description` (max 72 chars)
- [ ] PR body references the issue(s) it closes (`Closes #123`)
- [ ] No secrets / tokens / `.dev.vars` / `.env` files in the diff
- [ ] `git diff --stat` shows changes only in the areas the PR claims
- [ ] All required CI checks are green
- [ ] Branch is up to date with `main`

## Code Correctness

- [ ] Logic matches the PR description (not just the test names)
- [ ] Error paths are handled (`err instanceof Error ? err : new Error(String(err))`)
- [ ] No `any` introduced without a justification comment
- [ ] No new hardcoded URLs, dates, or environment values
- [ ] DOM manipulation goes through React refs (no `getElementById(...).innerHTML`)
- [ ] User-authored content is sanitized (DOMPurify or equivalent)
- [ ] No `console.*` on critical paths (must use `logClientEvent` with `traceId`)

## Security (TIER 1)

- [ ] No password hashing weaker than Argon2id
- [ ] No R2 URLs exposed to clients (signed URLs via Workers)
- [ ] No `allow-scripts` added to the reader iframe `sandbox`
- [ ] No CSP weakened (e.g., removing `script-src 'none'`)
- [ ] Regexes against untrusted input use `matchBounded` / `testBounded`
- [ ] No new dependencies without license/security review

## Accessibility (TIER 1 / WCAG 2.1 AA)

- [ ] New UI uses semantic design tokens (`text-foreground`, `bg-background`, etc.)
- [ ] Color contrast meets AA (≥ 4.5:1 for text, ≥ 3:1 for UI)
- [ ] Interactive elements have visible focus rings
- [ ] Form inputs have associated `<label>`s
- [ ] No semantic regressions (e.g., removed `aria-label`, `role`, skip link)
- [ ] `prefers-reduced-motion` respected for animations

## Tests

- [ ] Tests added for new logic, not just renamed
- [ ] Tests assert behavior, not implementation details
- [ ] Coverage thresholds hold (run `./scripts/quality_gate.sh`)
- [ ] No skipped tests without a tracking issue

## CI / Workflows

- [ ] New actions are SHA-pinned (run `./scripts/validate-workflows.sh`)
- [ ] No new secrets leaked to logs
- [ ] No new required permissions on `GITHUB_TOKEN`
- [ ] `actions/labeler` will pick up the new path patterns

## Documentation

- [ ] `AGENTS.md` updated if rules changed
- [ ] New skill or ADR added to `docs/plans/` if a new decision was made
- [ ] README / public docs updated for user-visible changes
- [ ] `CHANGELOG.md` updated (only via `release-management` skill)

## AI-Generated PRs

If the PR was opened by an AI agent (Jules, Claude, Qwen, etc.):

- [ ] `## AI-Agent Verification` section in the PR body
- [ ] `llms.txt` was consulted before writing the code
- [ ] No hallucinated imports or APIs
- [ ] Output was reviewed for semantic correctness (not just CI green)
- [ ] No new `any`, `// @ts-ignore`, or `eslint-disable` introduced

## Final

- [ ] Reviewer has read the diff line-by-line (not just the file list)
- [ ] All comments addressed or explicitly resolved
- [ ] Squash-merge ready: linear history, descriptive message

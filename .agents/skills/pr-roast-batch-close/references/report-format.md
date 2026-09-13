# PR Roast Report Format

One report per sweep. Fill every placeholder. Issue tags use exactly this
vocabulary: `[blocking]`, `[important]`, `[nit]`, `[close-recommendation]`.

## Report skeleton

```markdown
# PR Roast Report — {repo}

Scan date: {YYYY-MM-DD}
Total open PRs: {n}
Recommended actions: {c} close, {r} request changes, {a} approve

## PR #{number}: {title}

Author: {login} | Age: {d} days | Lines: +{additions}/-{deletions} | Files: {changedFiles}

### Impact Score: {n}/10

**The Roast:** {one-sentence verdict}

**Issues:**
- [blocking] {issue that must be fixed before merge}
- [important] {issue that should be fixed}
- [nit] {minor issue}
- [close-recommendation] {why this PR should be closed instead}

**Recommendations:**
1. {actionable change}
2. {actionable change}

**Decision:** {CLOSE | REQUEST CHANGES | APPROVE} — {one-line rationale}

## Summary Actions

### Close Immediately
- PR #{n}: {reason}

### Needing Changes
- PR #{n}: {required change}

### Ready to Merge
- PR #{n}: {note}
```

## Close comment template

```markdown
## PR Roast: closing for zero codebase impact

Impact score: {n}/10.

{reason — name what the PR changes and why it does not help this codebase:
no functional change / duplicate of #{n} / purely cosmetic / stale with no
activity / failing CI without explanation}

This was closed by an automated repository-hygiene sweep. If you disagree,
reopen with a short note on the concrete problem the PR fixes and it will be
re-reviewed.
```

## request-changes review body

```markdown
## PR Roast review — changes required before merge

Impact score: {n}/10.

Required changes:
1. {blocking issue}
2. {blocking issue}

Full roast report is available from the sweep; address the list above and
re-request review.
```

## approve review body

```markdown
## PR Roast review — approved

Impact score: {n}/10. Solid contribution.

Non-blocking recommendations:
1. {recommendation}
2. {recommendation}
```

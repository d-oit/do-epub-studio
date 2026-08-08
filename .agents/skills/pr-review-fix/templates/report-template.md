# PR Review Report

## PR Metadata

| Field | Value |
|-------|-------|
| **PR Number** | #{number} |
| **Title** | {title} |
| **Author** | @{author} |
| **Branch** | {head} → {base} |
| **URL** | {url} |
| **State** | {state} |
| **Files Changed** | {changedFiles} (+{additions} / -{deletions}) |

## Executive Summary

**Verdict**: {approve | request-changes | needs-work}

{One-paragraph summary of the overall PR quality and key findings.}

| Severity | Count |
|----------|-------|
| 🔴 must-fix | {n} |
| 🟡 should-fix | {n} |
| 🔵 informational | {n} |
| ⚪ nit | {n} |

## Findings

### must-fix

| # | Category | File | Line | Description | Auto-fixed |
|---|----------|------|------|-------------|------------|
| 1 | {security/bug/ci} | `{file}` | {line} | {description} | {yes/no} |

### should-fix

| # | Category | File | Line | Description |
|---|----------|------|------|-------------|
| 1 | {quality/style/test} | `{file}` | {line} | {description} |

### informational

| # | Category | File | Description |
|---|----------|------|-------------|
| 1 | {obs} | `{file}` | {description} |

### nit

| # | File | Description |
|---|------|-------------|
| 1 | `{file}` | {description} |

## Detailed Findings

### Security

{Detailed description of each security finding with code references.}

### Code Quality

{Detailed description of quality issues with before/after examples.}

### Testing

{Test coverage gaps and recommendations.}

### CI / Build

{CI status and any build-related issues.}

## CI Status

| Check | Status |
|-------|--------|
| {check-name} | {pass/fail/pending} |

## Auto-Fix Results

| # | Finding | Fix Applied | Commit |
|---|---------|-------------|--------|
| 1 | {description} | {what was changed} | {sha} |

## Recommended Actions

1. {Action item 1}
2. {Action item 2}
3. {Action item 3}

## Next Steps

- [ ] {Required action before merge}
- [ ] {Optional improvement}

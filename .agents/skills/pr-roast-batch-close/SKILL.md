---
version: "1.0.0"
name: pr-roast-batch-close
description: >
  Reviews ALL open PRs in a repository at once, roasts each one for codebase
  impact, provides recommendations, and closes PRs with zero meaningful impact.
  Use for repository hygiene sweeps and PR backlog cleanup.
category: workflow
allowed-tools: Read Grep Glob Bash
license: MIT
compatibility: "Requires gh CLI >= 2.70.0 (authenticated) and jq."
---

# PR Roast Batch Close

One command reviews every open PR in a repository, roasts each for codebase
impact, scores it 0-10, produces a single markdown report, and closes
zero-impact PRs with an explanation comment.

Scope: single-PR review belongs to `code-review-assistant`; fixing one PR's
review comments belongs to `pr-review-fix`. This skill is the repo-wide batch
sweep.

## When to Use

Activate for:

- repository hygiene sweep
- PR backlog cleanup
- pre-release triage
- batch quality gates
- contributor impact audit

NOT for single-PR review or merge automation - use the sibling skills named
above.

## Safety Model

Destructive by design. Default is DRY-RUN: the `close` and `review`
subcommands print the exact `gh` command and exit 0 without network mutation
unless `--execute` is passed.

- Never auto-close without a human-reviewed report.
- Never close: draft or WIP-titled PRs, PRs labeled `bug`/`security`/`critical`,
  or PRs by authors / carrying labels passed via `--exclude-author` / `--exclude-label`.
- Owner-author exclusion is OPT-IN (in this repo all open PRs are authored by
  the owner `d-oit`; a default-on owner exclusion would make the skill a
  no-op here).
- Keep a report log: run `collect` first, review the dossier, then execute.
- Repositories with more than 200 open PRs: sweep in label-scoped batches
  (`collect` caps at `--limit 200`).
- GitHub blocks `approve`/`request-changes` on PRs you authored; for self-authored PRs use `review --decision comment` (posts a `COMMENTED` review instead).

## Workflow

### Phase 1 - Discovery

```bash
scripts/roast-batch-close.sh collect -R <owner/repo> \
  [--exclude-author LOGIN]... [--exclude-label NAME]... [--include-drafts]
```

Emits a JSON dossier (`candidates` + `excluded`, each excluded entry carrying
a reason). Then fetch each candidate's diff:

```bash
gh pr diff <NUMBER> -R <repo>
```

### Phase 2 - Impact Scoring

Score each candidate with the rubric below.

### Phase 3 - Report

Compose ONE markdown report per `references/report-format.md` and print it to
stdout. For large repos the agent MAY save it to
`local://pr-roast-report-<YYYYMMDD>.md` - never a repo file.

### Phase 4 - Execute

- Score <= 2: `scripts/roast-batch-close.sh close -R <repo> --pr N --comment-file <file>`
- Score 3-5: `scripts/roast-batch-close.sh review -R <repo> --pr N --decision request-changes --comment-file <file>`
- Score >= 6: `scripts/roast-batch-close.sh review -R <repo> --pr N --decision approve --comment-file <file>`

Add `--execute` only after the user approves the report. Comment bodies come
from the templates in `references/report-format.md`, filled per PR.

### Phase 5 - Merge (approved PRs only)

For every PR scored >= 6 whose report recommendations are all addressed:

```bash
scripts/roast-batch-close.sh merge -R <repo> --pr N --pr M ... \
  [--merge-method squash] [--wait-ci] [--execute]
```

The script computes the deterministic merge order and, for each PR in turn:
checks it out, merges `origin/main` into it (latest branch), pushes, gates on
CI, and merges. Default is dry-run (prints the sequence). Pass `--execute`
only after the user approves. Merging is REFUSED for drafts, PRs labeled
`bug`/`security`/`critical`, non-mergeable PRs, or a dirty working tree.
Recommendations NOT addressed = do NOT merge that PR.

## Impact Scoring (0-10)

| Score | Criteria | Action |
|---|---|---|
| 0-2 | No functional change, trivial, no tests, no clear benefit | CLOSE |
| 3-5 | Minor improvement, unclear justification, needs work | REQUEST CHANGES |
| 6-7 | Solid improvement, some issues | APPROVE with recommendations |
| 8-10 | Significant improvement, well-tested, high value | APPROVE |

Add points: fixes bug/security +3; meaningful feature +2; measurable perf +2;
tests for untested paths +2; significant tech-debt reduction +2; linked issue
+1; good description +1.

Subtract points: purely cosmetic -3; no tests for functional changes -2;
breaks tests -3; duplicate functionality -2; premature optimization without
benchmarks -2; empty or "minor fix" description -1; stale >30d without
updates -1.
> Maintenance: lockfile/SHA-only Dependabot-type bumps with +3 security/CI and no other subtractors floor at 6 (APPROVE) — the "no tests" subtractor does not apply to CI SHA pins.
## Close Conditions

Any one condition closes the PR regardless of arithmetic score:

- only non-code files changed
- <10 changed lines AND no tests
- empty or "cleanup"-only description
- purely cosmetic (use linters instead)
- no linked issue and no clear benefit
- duplicate of an existing PR
- stale >60d with no functional change
- failing CI without explanation

## Reference Files

- `scripts/roast-batch-close.sh`
- `references/report-format.md`
- `references/merge-order.md`
- `evals/evals.json`

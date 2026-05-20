---
version: "1.0.0"
name: github-pr-autopilot
description: >
  Automates the entire lifecycle of a GitHub Pull Request. Use this skill when
  a user asks to merge a PR, resolve merge conflicts, address review comments,
  or fully automate PR handling end‑to‑end. Works with any repository where the
  GitHub CLI is authenticated.
category: workflow
allowed-tools: Read Bash
license: MIT
---

# GitHub PR Autopilot

Automatically takes a Pull Request from its current state to a merged state.

## Prerequisites

- GitHub CLI (`gh` ≥ 2.70.0) installed and authenticated
- `git` (≥ 2.40.0)
- `jq` (≥ 1.7)
- Write permissions on the target repository

## When to Use

- "merge this PR"
- "resolve the merge conflicts on PR #123"
- "address the review comments on my PR"
- "auto-merge PR #456"
- "take this PR through to merge"

## Workflow

### Step 1 – Authentication & Account Verification

Run the verification script. It ensures the active GitHub account matches the
repository owner, switching accounts via `gh auth switch` if necessary.

```bash
bash scripts/verify-auth.sh
```

### Step 2 – Identify the Target PR

- Use the provided PR number or URL if given.
- Otherwise, detect the PR attached to the current branch:
  `gh pr view --json number,url,title`

If no PR is found, stop and ask the user.

### Step 3 – Run the Autopilot Loop

Launch the main orchestration script. It repeatedly checks the PR's state,
resolves conflicts, addresses comments, and merges when all conditions are
satisfied.

```bash
bash scripts/autopilot.sh "$PR_NUMBER"
```

The loop stops automatically when the PR is merged or when it hits a situation
that requires human intervention (e.g., complex conflicts, ambiguous comments).

## Design Principles

- **Context parsimony** – The SKILL.md only contains the high‑level workflow;
  the heavy logic lives in scripts. This keeps the agent's context window free
  for other tasks.
- **Real expertise** – The scripts embed hard‑won patterns (e.g., using
  `git merge --no-commit --no-ff` to pre‑analyse conflicts via a dry‑run
  merge) rather than relying on generic LLM knowledge.
- **Deterministic rules** – Hard‑coded keyword rules (`must‑fix` vs
  `should‑fix`) are faster and more deterministic than asking the LLM to
  categorise every comment. Script what you can, prompt only what you must.
- **State‑driven loop** – The main script re‑evaluates the PR after each
  action, handling real‑world delays (CI re‑runs, new comments) without
  getting stuck.
- **Eval‑driven design** – The `evals/` directory lets you systematically test
  improvements (see `evals/evals.json`), ensuring the skill stays reliable
  across PRs.

## EPUB Studio Specific

### Integration with Existing Workflows

- **github-workflow** – For branch creation, PR creation, and Actions monitoring
- **code-review-assistant** – For holistic PR review before merge
- **release-management** – For cutting releases (PRs with `release:cut` label
  should NOT be auto‑merged by this skill)

### Quality Gates Before Merge

- [ ] All tests pass (see quality gate: `./scripts/quality_gate.sh`)
- [ ] TypeScript types valid
- [ ] Commit messages follow `type(scope): description` format
- [ ] No secrets or tokens in changes
- [ ] Branch protection rules respected (PR + CI passing for `main`)

### When NOT to Use Autopilot

- PRs with `release:cut` or `release` labels (defer to `release-management`)
- PRs touching auth, security, or permission code (require human review)
- PRs with `WIP` or `DO NOT MERGE` labels
- PRs where the base branch is protected beyond standard rules

## Troubleshooting

| Problem | Solution |
|----------|----------|
| Permission denied | Run `bash scripts/verify-auth.sh` to switch accounts |
| Complex merge conflict | Resolve manually, then re‑run the autopilot |
| Stuck in comment loop | Check if a comment is being repeatedly applied |
| CI never passes | Investigate the failing check — do not bypass |
| Max iterations reached | Manual investigation required — check PR state |

## Quality Checklist

- [ ] `gh` CLI authenticated and working
- [ ] Account matches repository owner
- [ ] Target PR identified correctly
- [ ] No protected labels on the PR
- [ ] All scripts pass ShellCheck validation
- [ ] Evals run successfully against fixtures

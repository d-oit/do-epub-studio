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

### Step 3 – Triage & CI Management

Use these commands for deep inspection and targeted reruns:

- **Inline Comments:** `gh api /repos/:owner/:repo/pulls/<number>/comments`
  *(Note: `gh pr view --json comments` only returns general comments; inline review comments REQUIRE the API endpoint).*
- **CI Status:** `gh pr checks "$PR_NUMBER"`
- **Targeted Rerun:** `gh run rerun <run-id> --failed`
  *(Preferred after local fixes to save CI resources).*

#### Triage Labels (TIER 2 Aligned)

When analyzing PR feedback, classify findings into these buckets:
- **must-fix**: Blocking issues that MUST be resolved before merge (e.g., bugs, security, broken tests).
- **should-fix**: Important improvements that SHOULD be addressed (e.g., style, minor refactors).
- **informational**: Observations, questions, or non-blocking feedback.
- **obsolete**: Comments that are no longer relevant due to code changes.

### Step 4 – Run the Autopilot Loop

Launch the main orchestration script. It repeatedly checks the PR's state,
resolves conflicts, addresses comments, and merges when all conditions are
satisfied.

```bash
bash scripts/autopilot.sh "$PR_NUMBER"
```

The loop stops automatically when the PR is merged. If it hits a situation
requiring complex resolution (e.g., must-fix comments, complex merge conflicts),
it will halt automation and **post a "Autopilot Handoff" comment on the PR.**

**You MUST then:**
1. **Report the status** to the user (e.g., "Autopilot halted due to [reason]. Delegating to goap-agent skill.")
2. **Activate the `goap-agent` skill** as an orchestrator to analyze and implement the fixes in parallel. Do not wait for human intervention.
3. Once the `goap-agent` has resolved the issues, re-run the autopilot loop.

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
- **Autonomous Escalation & Visibility** – When deterministic scripts fail to
  auto-resolve a conflict or address a comment, the skill posts a visible
  status update to the PR and delegates to the `goap-agent skill` for parallel
  analysis and implementation, entirely removing the human from the critical
  path.
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
- **goap-agent** – For orchestrating parallel analysis and implementation of complex conflict resolutions and must-fix comments
- **release-management** – For cutting releases (PRs with `release:cut` label
  should NOT be auto‑merged by this skill)

### Quality Gates Before Merge

- [ ] **ALL CI checks pass** — never merge with a failing check. Use `gh pr checks <N>` to verify. `--admin` override is forbidden unless the failure is a documented pre-existing external check (e.g., Codacy ACTION_REQUIRED on non-diff code).
- [ ] Quality gate passes: `./scripts/quality_gate.sh` (MUST exit 0)
- [ ] TypeScript types valid
- [ ] Commit messages follow `type(scope): description` format
- [ ] No secrets or tokens in changes
- [ ] Branch protection rules respected (PR + CI passing for `main`)

### When NOT to Use Autopilot

- PRs with `release:cut` or `release` labels (defer to `release-management`)
- PRs touching auth, security, or permission code (require human review)
- PRs with `WIP` or `DO NOT MERGE` labels
- PRs where the base branch is protected beyond standard rules
- **PRs with ANY failing CI check** — investigate and fix first; never bypass

## Troubleshooting

| Problem | Solution |
|----------|----------|
| Permission denied | Run `bash scripts/verify-auth.sh` to switch accounts |
| Complex merge conflict | Activate `goap-agent` to resolve, then re-run autopilot |
| Stuck in comment loop | Check if a comment is being repeatedly applied |
| CI never passes | **STOP.** Investigate the failing check — never bypass with `--admin` |
| Must-fix comments found | Activate `goap-agent` to address comments, then re-run autopilot |
| Max iterations reached | Check PR state to see what is blocking the loop |

## Quality Checklist

- [ ] `gh` CLI authenticated and working
- [ ] Account matches repository owner
- [ ] Target PR identified correctly
- [ ] No protected labels on the PR
- [ ] All scripts pass ShellCheck validation
- [ ] Evals run successfully against fixtures

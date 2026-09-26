# ADR-285: The local pre-commit hook runs the framework hooks, fail-closed

**Date:** 2026-09-26
**Status:** Accepted
**Deciders:** Project maintainer
**Related:** Issue #1213, Issue #1212, GOAP-277 (`plans/277-goap-ci-gates-that-never-run.md`), ADR-277 (fail-closed skip visibility), `agents-docs/LEARNINGS.md` ("The local git hook and CI's Pre-commit job do not run the same hooks")

## Context

Two layers both present as "pre-commit" ran different hook sets:

- **Local** `scripts/hooks/pre-commit` → `validate-git-hooks.sh` + the full
  `scripts/quality_gate.sh`.
- **CI** `Pre-commit Hooks` job → `pre-commit run --all-files` from
  `.pre-commit-config.yaml`: `trailing-whitespace`, `end-of-file-fixer`,
  `mixed-line-ending`, `markdownlint`, `yamllint`, `shellcheck`, `gitleaks`,
  `check-yaml`, `check-json`, `check-merge-conflict`, plus `validate-workflows`
  and `minimal_quality_gate.sh`.

`quality_gate.sh` contains no whitespace, format, or markdown/yaml lint check —
verified by grep, not assumed. So the file-level hooks ran **only in CI**, and
the first place they could fire was a push to `main`.

Issue #1213 recorded the defect and proposed a shape, but explicitly deferred the
policy call to a maintainer: `pre-commit` needs pip, and at the time this
container had no pip, so a hard requirement would have broken commits entirely.
It asked for a decision between **warn-and-continue**, **hard-fail**, and
**keeping CI as the only authority**.

## Decision

**Run the framework hooks locally against staged files, and fail closed**, with
one named escape hatch: `SKIP_PRE_COMMIT_FRAMEWORK=true`.

Three parts, each load-bearing:

1. **Run, on staged files only.** `--files "${staged[@]}"`, not `--all-files`.
   CI is the only layer that may scan the whole tree; the local hook's job is to
   make _this commit_ CI-ready, and scoping to the index keeps a commit hook
   proportional to the change rather than to the repository.
2. **Re-stage whatever the hooks rewrote.** `trailing-whitespace` and
   `end-of-file-fixer` are fixers, not linters: they return non-zero _and_
   modify the worktree. Without `git add -u` on the touched paths the commit
   records pre-fix bytes while the hook reported success — the hook would pass
   on a tree that CI then rejects, which is the exact failure this ADR exists
   to remove.
3. **Fail closed.** A non-zero framework result blocks the commit.

The escape hatch warns explicitly that CI will still reject the commit, so it
is a way to reach the remote for a fix, not a way to merge broken work.

## Why fail-closed, not #1213's proposed warn-and-continue

Warn-and-continue is indistinguishable from _no hook at all_ with respect to the
one thing the hook exists to prevent: a commit that is green locally and red in
CI. The signal still arrives, but at the worst possible moment — after the push,
on `main`, where the fix is a follow-up PR. That is the failure #1212 recorded
(`plans/ADR-INDEX.md` fixed by run 35984985785, green locally, red on `main`).

Choosing warn-and-continue would have bought nothing operationally while
removing the hook's entire value. Fail-closed is the same direction ADR-277
already took for silently-skipped CI gates.

## Why not an unconditional hard requirement

`pre-commit` requires pip, and a fresh devcontainer ships neither pip nor the
cached hook environments (shellcheck, markdownlint, yamllint, gitleaks are all
downloaded on first run). A hard requirement would leave the hook unable to run
at all, which is worse than a missing hook: it fails every commit with a
`command not found` instead of skipping the checks and saying so.

So availability gates execution, not policy. When `pre-commit` is absent the
hook warns once, names the install command, and proceeds — the same graceful
shape #1213 proposed, now confined to the _missing-tool_ case where the
alternative is total breakage. When the tool is present, a failure is a failure.

## Alternative considered: keep CI as the only authority

Rejected. It is the status quo that produced #1212, and it is the only option
that guarantees the local/CI divergence persists.

## Consequences

- A commit touching a markdown, yaml, or shell file now runs markdownlint,
  yamllint, and shellcheck locally. That is a real cost on first run (hook
  environments must be installed) and near-zero afterwards.
- The hook may rewrite staged files. Contributors will see "Framework hooks
  modified staged files — re-staged". This is intended: the alternative is a
  commit that disagrees with its own worktree.
- Any contributor without `pre-commit` keeps today's behaviour, plus a warning
  that is now accurate rather than silent.

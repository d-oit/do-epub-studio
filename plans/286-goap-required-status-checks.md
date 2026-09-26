# GOAP-286: Register `pr-title` and `commit-range` as required status checks

**Status:** COMPLETE (applied 2026-09-26)
**Date:** 2026-09-26
**ADR:** `plans/286-adr-required-status-check-set.md`
**Closes:** #1206
**Related:** ADR-279 (`plans/279-adr-commit-title-ci-enforcement.md`), GOAP-277 (`plans/277-goap-ci-gates-that-never-run.md`), ADR-277 (fail-closed skip visibility), #1213

## Goal

ADR-279 added `.github/workflows/validate-commit-title.yml` with the `pr-title`
and `commit-range` jobs. They pass, but they were advisory only, so any PR could
merge red on them. Because the repo squash-merges with
`squash_merge_commit_title = COMMIT_OR_PR_TITLE`, the PR title *is* the commit
subject that lands on `main` — and the local `commit-msg` hook never sees a PR
title at all. ADR-279's history hole was therefore still open in practice.

## What the issue recorded, and what was actually true

Issue 1206 was filed as a **branch-protection admin task blocked on a 403**:
`GET /branches/main/protection` returned `403 Resource not accessible by
integration`, so the required-context list could not be read or audited.

Two things had changed by the time this ran:

1. The integration token now has **admin** on the repository
   (`gh api repos/d-oit/do-epub-studio --jq .permissions` → `"admin": true`).
2. `main` was **not protected at all** — `GET /branches/main/protection`
   returned `404 Branch not protected`, not 403.

So the fix was not "add two contexts to an existing ruleset". It was "there is no
protection", which also means every Tier-1 rule in `AGENTS.md` about not merging
red PRs was resting on developer discipline rather than on an enforced control.

## Decomposition

- **A — enable protection on `main`.** Without it there is nothing to add
  contexts to, and every other Tier-1 guarantee is unenforced.
- **B — register `pr-title` + `commit-range`** (the #1206 ask).
- **C — pick the rest of the required set from jobs that actually run on a PR.**
  This is where #1206's framing was incomplete, and the reason is recorded in
  ADR-286: three jobs that look like the obvious candidates are push-only.
- **D — audit for a self-approval deadlock.** This repo is single-maintainer
  (`@d-oit` is the author of both open PRs *and* the authenticated identity),
  and every `CODEOWNERS` entry resolves to `@d-oit`.

## What was applied

`required_status_checks.contexts` (strict: true):

| Context | Runs on PR? | Why required |
| --- | --- | --- |
| `pr-title` | yes | ADR-279; title becomes the squash-merge subject |
| `commit-range` | yes | ADR-279; every commit held to `commit-msg` |
| `Pre-commit Hooks` | yes | the framework hooks (ADR-285) |
| `Full Quality Gate` | yes (non-draft) | lint + typecheck + tests + design, the repo's aggregate gate |
| `Fast Check (Changed Packages)` | yes | the only per-package test run on PRs |
| `Gate Visibility Sensor` | yes (`always()`) | GOAP-277; catches silently-skipped gates |
| `Setup & Diagnostics` | yes | every downstream job `needs:` it, so its failure is already blocking |
| `CodeQL Alert Check` | yes | blocks on open CodeQL alerts |

Also set: `enforce_admins: true`, `allow_force_pushes: false`,
`allow_deletions: false`, `required_conversation_resolution: true`,
`dismiss_stale_reviews: true`, `required_approving_review_count: 1`,
`require_code_owner_reviews: true`.

## Deliberately NOT required, and why

`Lint (Node ${{ matrix.node-version }})`, `Typecheck (…)` and
`Unit Tests (…)` are **not** required contexts. All three carry
`if: github.event_name != 'pull_request'`, so on a pull request they are reported
`skipped` and never execute. Requiring a context that is always skipped is not
a stricter gate — it is a permanent deadlock: no PR can ever satisfy it, and
`strict: true` means the branch is never up to date with `main`, so nothing
merges at all.

The literal, uninterpolated `${{ matrix.node-version }}` in those context
strings is the same fact seen from another angle: the expression is never
evaluated because the job body never runs.

Coverage is not lost by excluding them — on a PR, `Full Quality Gate` and
`Fast Check (Changed Packages)` run `pnpm lint` and `pnpm typecheck` over the
affected packages, and `strict: true` additionally forces a re-run whenever
`main` advances.

`Scheduled Cross-browser E2E`, `Dependency Vulnerability Scan` and the
`Auto-merge` job are also push/schedule-only and are excluded for the same
reason.

## Why `require_last_push_approval` was turned off

GitHub forbids approving your own pull request. In a single-maintainer repo
where the maintainer is also the PR author, requiring last-push approval would
mean the final push always invalidates the only possible approval — a
guaranteed second round-trip with no possible exit. `dismiss_stale_reviews` is
kept, which is the control that actually matters: any new push drops prior
approvals, so an approval can never be carried across unreviewed changes.

## Verification

- `GET /branches/main/protection` → `200`, with the context list above.
- Both open PRs report `mergeStateStatus: BLOCKED` with
  `reviewDecision: REVIEW_REQUIRED` — the rules are live, not inert.
- `pr-title` and `commit-range` were both red on #1218 and #1220 before this
  work, and both PRs are now fixing those failures — the rule is catching the
  exact defect it was created for.

## Follow-up

`Full Quality Gate` skips on **draft** PRs
(`github.event.pull_request.draft == false`). With `strict: true` a draft PR
therefore cannot satisfy its own required context. That is intentional and
consistent with normal review flow — draft PRs are not meant to be mergeable —
but it is recorded here so a future "PR is stuck" report is not re-diagnosed
from scratch.

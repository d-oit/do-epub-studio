# ADR-286: A required status check must run for every PR shape the repo accepts

**Date:** 2026-09-26
**Status:** Accepted
**Deciders:** Project maintainer
**Related:** GOAP-286 (`plans/286-goap-required-status-checks.md`), #1206, ADR-279, ADR-277, GOAP-277, ADR-285

## Context

Issue 1206 asked for two specific contexts — `pr-title` and `commit-range` — to be
registered as required on `main`. Applying it surfaced a fact that changes the
shape of the task, and that a context list alone does not express.

One more fact shapes the mechanics, and it is not visible from the endpoint the
issue used. `GET /branches/main/protection` reports **classic** branch
protection only, and returned `404 Branch not protected` here. A **repository
ruleset** (`15669639`, name `main`, `enforcement: active`) was already in place
and untouched by that 404, requiring `Codacy Static Code Analysis` (strict),
CodeQL alert thresholds, and PR-thread resolution. GitHub applies **both**
mechanisms, so the effective requirement is their union. The contexts added
here are therefore additive to an enforcement layer that already existed, not a
substitute for it.

Branch protection's required-context list is matched by **name against the check
runs attached to the PR's head commit**. A job that is `skipped` still produces a
check run. A job that is **never scheduled for that event** produces nothing.
With `strict: true`, those two states are not equivalent:

- a `skipped` required context is satisfied (GitHub treats it as neutral), and
- a **missing** required context blocks the merge permanently.

`ci.yml` makes three of the most obvious candidates the second kind. `lint`,
`typecheck` and `test` all carry:

```yaml
if: github.event_name != 'pull_request'
```

so on a pull request they are reported `skipped` with a name that still shows
the **uninterpolated** `${{ matrix.node-version }}` — the expression is never
evaluated because the job never runs. Verified against the live API on the head
commits of #1218 and #1220: `Lint (Node ${{ matrix.node-version }}) |
completed/skipped`.

So the obvious-looking set — lint, typecheck, tests, build — is a permanent
deadlock. `strict: true` additionally means the branch must be up to date with
`main`, so a permanently-unsatisfiable context blocks _every_ PR, including
ones that fix the repo.

A second, independent deadlock sits in the review settings. GitHub forbids
approving your own pull request. This is a single-maintainer repo: `gh api user`
is `d-oit`, both open PRs are authored by `d-oit`, and all 20 `CODEOWNERS`
entries resolve to `@d-oit`. Requiring last-push approval means the final push
always invalidates the only possible approval, with no exit.

## Decision

1. **A context may be required only if it is proven to produce a check run on a
   pull request.** Proven means observed on a real PR head via
   `GET /commits/<sha>/check-runs` — not inferred from the workflow's `name:`,
   and not from the job appearing in the same file.
2. **`pr-title` and `commit-range` are required** (the #1206 ask; both run on
   every PR).
3. **Lint, typecheck and unit tests are not required as separate contexts.** On a
   PR they are covered by `Full Quality Gate` and `Fast Check (Changed
Packages)`, which run `pnpm lint` / `pnpm typecheck` over the affected
   packages. The push-only originals remain the enforcement path for `main`
   itself, and `strict: true` forces a re-run after every `main` advance.
4. **`require_last_push_approval` is off; `dismiss_stale_reviews` is on.**
   Stale-dismissal is the control that matters: it guarantees an approval can
   never be carried across unreviewed new commits. Last-push-approval adds
   nothing in a single-maintainer repo except an unresolvable extra round-trip.
5. **Draft PRs are intentionally unmergeable** — `Full Quality Gate` skips on
   drafts, so a draft cannot satisfy its own required context. Recorded in
   GOAP-286 so it is a known state, not a future mystery.

## Operational consequence: a human approval is now required

`required_approving_review_count: 1` + `require_code_owner_reviews: true` cannot
be satisfied by the repository's only account. GitHub rejects self-approval
outright:

```
gh pr review 1220 --approve
failed to create review: GraphQL: Review Can not approve your own pull request
```

This is a property of the organisation, not a misconfiguration: `gh api user` is
`d-oit`, both open PRs are authored by `d-oit`, and all `CODEOWNERS` entries
resolve to `@d-oit`. **Enabling this ruleset therefore requires a second GitHub
account to merge any PR.** That trade was made knowingly — the alternative is no
enforced protection at all — but it must be written down at the moment it is
decided, because the first "why can't I merge" report will be exactly this.

Verified as of 2026-09-26: PR #1220 satisfies all eight required contexts
(`pr-title`, `commit-range`, `Pre-commit Hooks`, `Full Quality Gate`,
`Fast Check (Changed Packages)`, `Gate Visibility Sensor`, `Setup & Diagnostics`,
`CodeQL Alert Check` — all `completed/success`) and is blocked solely on
`REVIEW_REQUIRED`.

If a second maintainer account is not available, the rollback is to lower
`required_approving_review_count` to 0 while keeping the status-check and
conversation-resolution enforcement, which is where most of the value is.

## Why not just require everything that looks important

Because the failure mode is silent and total. A context that never runs looks
exactly like a context that passed, right up until it blocks a PR nobody can
unblock. The rule is asymmetric on purpose: an absent required context costs
availability, and a wrongly-added one costs correctness _silently_. Requiring
only what has been observed is the conservative direction.

The same "prove it ran" discipline GOAP-277 applied to job-level skips
(ADR-277) applies here at the ruleset level, and the same reasoning from
`LEARNINGS.md` about `ACTION_REQUIRED` applies: read the artifact (the actual
check run), not the intent expressed in the workflow file.

## Three deadlocks, one rule

Every deadlock in this ADR came from the same mistake, made three times in
sequence: **requiring a context that does not run for that PR's shape.**

| #   | Required but never runs             | Trigger                                             | Symptom                                                |
| --- | ----------------------------------- | --------------------------------------------------- | ------------------------------------------------------ |
| 1   | `lint`, `typecheck`, `test`         | `if: github.event_name != 'pull_request'`           | literal `${{ matrix.node-version }}` in the check name |
| 2   | 6 of 8 contexts (release gate)      | release evaluates a **push**, the jobs are PR-gated | `Required check 'pr-title' is missing` on green `main` |
| 3   | 6 of 8 contexts (branch protection) | `ci.yml` has `paths-ignore: ['**.md']`              | a markdown-only PR has no `ci.yml` run at all          |

Case 3 surfaced last and is the quietest: #1231 touched only
`agents-docs/LEARNINGS.md`, `ci.yml` was skipped **by design** (`paths-ignore`),
and the six required contexts that only `ci.yml` produces simply never appeared.
`gh pr checks` showed no failures — the contexts were absent, not red, which
looks identical to "passing" until the merge is refused.

The rule, now stated once: **a required context must be proven to run for every
PR shape the repository accepts** — a draft, a `pull_request`, a `push` to
`main`, a merge queue, and a path-filtered PR. "It ran on the PR I tested" is
not sufficient.

## Current required set

```json
["pr-title", "commit-range", "PR Gate (all paths)"]
```

`pr-title` and `commit-range` come from `validate-commit-title.yml`, which has
**no path filter**. The third is `pr-gate.yml` — added in the follow-up below,
also with no path filter, reporting one stable context.

### The path-independent gate (implemented)

`.github/workflows/pr-gate.yml` triggers on `pull_request` (and `merge_group`)
with **no `paths-ignore`**, and runs `scripts/minimal_quality_gate.sh` plus the
validators a path-filtered PR would otherwise skip: agent-adapter sync, gate
parity, `validate-workflows.sh` (actionlint + zizmor) and markdownlint when
available. It is complementary to `ci.yml`'s `Full Quality Gate` rather than
duplicate: a markdown-only PR is a docs change, and the checks that can break it
are exactly the workflow/docs validators and the shell linters.

`cancel-in-progress: false` is deliberate — cancelling mid-gate would leave the
required context missing, which is the failure mode this whole ADR is about.

**Verified on the exact shape that was unsatisfiable** (canary #1234, one
changed file, closed unmerged):

|                            |                                              |
| -------------------------- | -------------------------------------------- |
| `ci.yml` runs on that head | **0** — skipped by `paths-ignore: ['**.md']` |
| `pr-title`                 | success                                      |
| `commit-range`             | success                                      |
| `PR Gate (all paths)`      | success                                      |

### Registering it nearly repeated the same mistake

The context was first registered as `PR Gate` — the **workflow** name, read off
the `name:` key at the top of the file. The check GitHub records is the **job**
name, `PR Gate (all paths)`. The wrong string would have been a fourth deadlock:
an absent required context, indistinguishable from a passing one. Caught by
reading the run's job list (`GET /actions/runs/<id>/jobs`) instead of trusting
the workflow file, which is the same "read the artifact, not the intent"
discipline the rest of this ADR applies.

## Consequences

- `main` rejects merges that are red on `pr-title`, `commit-range` or
  `PR Gate (all paths)`, and requires the branch to be up to date with `main`
  (`strict: true`).
- Every PR now runs lint, typecheck, shellcheck, the gitignore guard, the
  workflow validators, the gate-parity manifest and the agent-adapter check —
  **for every PR shape**, including documentation-only changes. That is the
  Tier-1 "never merge a PR with failing CI" rule restored as an actual control
  rather than left as process.
- Full-gate coverage (tests, build, bundle budget, dead code, design) is still
  provided by `ci.yml` for non-filtered PRs and for every `main` push. A
  markdown-only PR does not run tests — correctly, since it changes no
  executable code.
- Adding a required context is evidence-gated: confirm the **job** name via
  `GET /actions/runs/<id>/jobs`, confirm it runs for **all** PR shapes, then
  register it. The workflow `name:` is not the context.
- If someone later removes `if: github.event_name != 'pull_request'` from the
  matrix jobs so they do run on PRs, the correct follow-up is to register the
  **interpolated** names (`Lint (Node 22)`, `Lint (Node 24)`, …) — not the
  literal ones currently reported.

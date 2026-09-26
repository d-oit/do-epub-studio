# ADR-279: Commit message and PR title validation in CI (one canonical rule set)

**Date:** 2026-09-24
**Status:** Accepted
**Deciders:** Project maintainer
**Related:** GOAP-276 Phase 0 item 6, ADR-083 (ADR numbering), ADR-247 (SHA allowlist), ADR-277 (fail-closed gates), AGENTS.md TIER 1/TIER 2

## Context

Three validators claim to describe "a valid commit" in this repo, and only one
of them ever ran in CI — because none of them ran in CI at all:

- `scripts/hooks/commit-msg` — the local git hook (canonical in practice):
  first line must match
  `^(feat|fix|docs|style|refactor|perf|test|ci|chore|build|revert)(\([a-z0-9_-]+\))?!?: .+`
  built from `scripts/lib/commit-types.sh`, first line ≤72 chars, **body
  required (message file ≥3 lines)**, skips `Merge|Revert|WIP|fixup!|squash!`.
- `scripts/validate-commit-message.sh` + `scripts/atomic-commit/commit.sh` —
  both source the same shell list.
- `commitlint.config.cjs` (`pnpm commitlint`, advisory) — had drifted:
  `type-enum` was missing `style` (present in the shell list) and carried
  `security,a11y,plans` (absent from the shell list); `scope-enum` had 15
  scopes vs the shell's 26, and enforced `subject-case`, `subject-full-stop`
  and body/footer line-length rules the hook never had.

`scripts/lib/commit-types.sh` declares itself "Single source of truth for all
commit validators. parity tests enforce this" — but the parity suite
`scripts/__tests__/commit-validator-parity.sh` was invoked by nothing (no CI
job, no gate step, no package script), and no test compared the shell lists to
commitlint. The promise was documentation, not enforcement.

Meanwhile the actual history hole was never covered at all: this repo
squash-merges with the repository setting
`squash_merge_commit_title = COMMIT_OR_PR_TITLE`, i.e. the subject that lands
on `main` is **the PR title for single-commit PRs and a commit subject
otherwise**. A local commit-msg hook never sees a PR title, and
`pull_request` events validated nothing — so the string that actually becomes
history was the least validated string in the system.

Live evidence that CI must not simply adopt the old commitlint config:

- `main` contains `ci(goap-277):` (scope `goap-277`) and `docs(agents):`
  (scope `agents`) — both rejected by the old `scope-enum`.
- The last 200 commits use **43 distinct scopes** (last 500: **74**) against
  26 declared in `COMMIT_SCOPES` and 15 in commitlint. Observed scopes include
  `goap-254`, `goap-270`, `goap-273`, `goap-277`, `plan-114`, `plan-204`,
  `sha-allowlist`, `wave1`, `wave4`, `m5`, `u4`, `i18n`, `codacy`, `skills`,
  `sensors`, `editorial`, `wrangler`, … Scopes are dynamic (plan IDs, PR
  numbers, wave/batch labels) by design.
- History type usage beyond the shell list: `security(...)` ×5 and `plans:`
  ×1 (plus `style:` ×1 and `build(ci):` ×1, both already in the shell list;
  `a11y` ×0 as a type — kept because it is already declared on the commitlint
  side and mirrors the existing `a11y` scope).
- Dependabot PR titles in this repo (sample, `gh pr list --author
app/dependabot`): `chore: bump eslint-plugin-unicorn from 75.0.0 to
76.0.0`, `chore: bump the react group with 4 updates`,
  `chore: bump @sentry/react from 10.74.0 to 10.75.0`,
  `chore: bump the eslint group …` — conventional thanks to
  `.github/dependabot.yml` `commit-message.prefix` (`chore` for npm, `ci` for
  github-actions), **but** grouped titles can exceed 72 chars: `chore: bump
the production-dependencies group across 1 directory with 4 updates` is 79
  chars and did land on `main` (PR #1167).

## Decisions

### 1. One canonical list: `scripts/lib/commit-types.sh`

`scripts/lib/commit-types.sh` is the **single source of truth for commit
types**. Nothing may define a type list anywhere else:

- The hook, `validate-commit-message.sh` and `atomic-commit/commit.sh` already
  source it.
- `commitlint.config.cjs` is a **mirror**, kept in parity by
  `scripts/__tests__/commit-validator-parity.test.mjs`, which asserts
  `type-enum === COMMIT_TYPES` (set equality), so editing one list without the
  other fails CI. commitlint is **demoted to a mirror, not a gate**: CI never
  runs it — `.github/workflows/validate-commit-title.yml` runs
  `scripts/hooks/commit-msg` itself, so local-hook/CI parity holds _by
  construction_ rather than by configuration similarity.

### 2. Type union goes into the SSOT

`security`, `a11y` and `plans` are added to `COMMIT_TYPES` (observed usage
above: real commits exist for `security` and `plans`; `a11y` is retained for
symmetry with the existing scope vocabulary). `style` was already in the shell
list — commitlint was the side that had to change (its override omitted
`style` while `@commitlint/config-conventional`'s own default includes it).

### 3. Dynamic scopes: no `scope-enum` anywhere — CI is never stricter than the hook

Commitlint's `scope-enum` is **dropped**, not shrunk to match the shell's 26
scopes. Rationale:

- The hook accepts any `[a-z0-9_-]+` scope (or none). A `scope-enum` in CI
  would make the machine stricter than every developer's local hook —
  a developer who commits cleanly locally would go red in CI, which is exactly
  the surprise class this ADR exists to prevent.
- An enum cannot express the dynamic scope space this repo actually uses
  (`goap-277`, `plan-121`, PR-derived labels, wave/batch tags): 74 distinct
  scopes in 500 commits, growing with every GOAP plan. Freezing the list means
  re-editing a config file every sprint to accept the next plan ID.
- Multi-scope subjects (`feat(reader,ci): …`) exist in history but are
  rejected by the hook's regex; that rejection is kept — they are not
  silently blessed by this ADR.

`COMMIT_SCOPES` stays in the SSOT as an **advisory vocabulary** for humans and
error-message hints (`is_valid_commit_scope` is warn-only and has no failing
caller). The parity test asserts `scope-enum` is **absent** from
`commitlint.config.cjs` so the strict rule cannot quietly return.

### 4. Rule parity: commitlint must not be stricter than the hook

config-conventional enables `subject-case`, `subject-full-stop`,
`body-max-line-length`, `footer-max-line-length` and `header-trim` at error
level; the hook enforces none of them (it only _warns_ on a trailing period in
`validate-commit-message.sh`). These are explicitly disabled at level 0 in
`commitlint.config.cjs` — merely omitting them would leave the stricter
`extends` value active. The parity test computes the **effective** rule set
(config-conventional merged with local overrides) and fails if any error-level
rule falls outside the hook-parity allowlist (`type-enum`,
`header-max-length` = 72, `subject-empty`, `type-empty`, `type-case`), so a
future commitlint upgrade cannot smuggle in a stricter rule.

**Subject case policy:** the format regex already forces a lowercase type and
scope; descriptions may start with acronyms — `ci(goap-277): GOAP-277 …`,
`docs(ci): GOAP-277 + ADR-277 …` are live, valid subjects. The unreachable
`^[A-Z]` check in `validate-commit-message.sh` (it tested the type prefix,
which the preceding regex already guarantees lowercase) is removed rather than
widened into a rule that would red existing history; `plans/invariants.json`
is reworded accordingly and its sensor — which cited a
`scripts/check-commitlint.sh` that never existed — is repointed at the real
sensors.

**Body asymmetry is deliberate and scoped:** commitlint has no way to express
"body required", so it stays looser than the hook on bodies. That is
acceptable because commitlint is not a gate (decisions 1 and 6); the hook —
which does enforce bodies — is what CI runs.

### 5. The body requirement on PR commits and PR titles

- **PR commits (`commit-range` job): the full hook runs per commit, body
  requirement included.** No relaxation: these are the same messages the
  local hook validated when they were created.
- **PR titles (`pr-title` job): a new `--subject-only` mode of
  `scripts/hooks/commit-msg`.** A PR title is a single line and structurally
  cannot carry a body; requiring 3 lines of a title field would be nonsense.
  The mode skips _only_ the body check — skip patterns, format regex and the
  72-char cap stay enforced — and is opt-in: git still invokes the hook with
  just the file path, so local commits are untouched. The mode exists because
  the title _is_ a subject, not as a loophole for commits (the `commit-range`
  job and the parity test both pin full mode's body check to exit 1).

### 6. Dependabot: exempt by machine authorship, validated on human edit

- **`pr-title`** skips with an explicit log line when
  `github.actor == 'dependabot[bot]'` (covers `opened`/`synchronize`
  re-titles). When a **human** edits a Dependabot title, the actor is human,
  so the edit is validated like any other PR title — no permanent hole.
- **`commit-range`** skips commits whose author email is exactly
  `49699333+dependabot[bot]@users.noreply.github.com`.
- Why exempt: Dependabot subjects are machine-generated from package/group
  names and can exceed 72 chars (79-char example above); blocking them stalls
  `dependabot-auto-merge.yml` with no human in the loop to retitle; and under
  squash-merge the subject that reaches `main` from a Dependabot PR is its PR
  title, which is validated on any human edit. Their format is already kept
  conventional by `dependabot.yml` `commit-message.prefix` (Dependabot commit
  bodies are real bodies — verified on PR #1178's branch commit — but the
  length cap is the unfixable part).

**Rejected alternatives:**

- _`ignoreLabels`_ — only exists as an option of
  `amannn/action-semantic-pull-request`; adopting a third-party action for
  this contradicts the zero-new-dependency decision below (ADR-247 pin/allowlist
  cost for one skip rule).
- _`chore(deps)` scope via `prefix`+`include: scope`_ — fixes neither the
  79-char length nor authorship; title would still fail the cap.
- _Enforce everything on Dependabot_ — red PRs pile up against auto-merge on a
  schedule nobody can fix retroactively; a machine must be able to open a PR
  its own generator cannot format perfectly.

### 7. Workflow shape (`.github/workflows/validate-commit-title.yml`)

- Events: `pull_request` types `[opened, reopened, edited, synchronize]` —
  `edited` exists specifically so retitling re-validates.
- **`pull_request`, never `pull_request_target`:** the read-only token is all
  this needs; checkout-of-head under `pull_request_target` is the "pwn
  request" pattern; a default GitHub policy blocking `pull_request_target` on
  public repos begins enforcement 2026-11-02.
- **No third-party actions:** only `actions/checkout@3d3c42e…` (already in
  `scripts/validate-shas.sh`), so the allowlist needs no append. The enforcer
  is the repo's own hook script — zero duplication, zero drift, zizmor-clean
  (title and SHAs pass through `env:`, explicit `permissions: contents: read`,
  `persist-credentials: false`).
- Both jobs always run and skip **inside steps with a visible message**
  (ADR-277: a `skipped` gating job is a defect; step-level skips report
  success and keep the check reported).
- `commit-range` uses `fetch-depth: 0` + `git merge-base` over
  `base.sha..head.sha` (full clone; no 250-commit REST API cap) and the
  hook's own `Merge|Revert|WIP|fixup!|squash!` skips absorb "Update branch"
  merge commits inside the range.

### 8. Enforcement wiring (partially pending — see Follow-ups)

New required status checks to register in branch protection once this merges:
**`pr-title`** and **`commit-range`** (job ids = check names; verify the
exact context string in the PR checks UI or branch-protection API before
saving). Registering them without the workflow merged would block every PR,
so it happens in the same maintenance window as the merge.

## Consequences

- PR titles — the string squash-merge actually writes to `main` — become
  machine-validated on open, on every push, and on every title edit, using
  the identical rules a developer's local hook enforced on their commits.
- Type-list drift between shell and commitlint becomes a CI failure instead
  of a silent lie in a file header; the previously unwired
  `commit-validator-parity.sh` suite now runs on every PR.
- `commitlint.config.cjs` loses `scope-enum` and the case/full-stop/length
  rules; anyone relying on `pnpm commitlint` for those gets hook semantics
  instead — which is the point (one rule set).
- Existing open PRs with non-conventional or >72-char titles fail `pr-title`
  the moment the checks are registered (currently: PR #1199
  `ci(goap-277): gate-visibility sensor for silently skipped gates` is 62
  chars and valid; no other open PR at time of writing).
- History containing subjects >72 chars (`chore: bump the
production-dependencies group across 1 directory with 4 updates`, #1167) is
  not retroactively validated: `commit-range` only sees the PR's own commits.
- The `security`/`a11y`/`plans` types are now locally committable again; no
  existing commit changes meaning.

## Follow-ups (deliberately left open)

1. **Branch protection:** register `pr-title` and `commit-range` as required
   status checks (maintainer-only API/UI change; this token got HTTP 403
   reading branch protection).
2. **Gate wiring:** `scripts/quality_gate.sh` and `scripts/gate-manifest.json`
   were not touched by this change (concurrent edit by another work item);
   adding the local/policy wiring for the new check is pending and tracked by
   the GOAP-276 orchestrator. `validate-gate-parity.sh` fuzzy-matches manifest
   entries against `ci.yml` only, so entries for these jobs will report the
   non-blocking "auxiliary workflow" notice until then.
3. **Dependabot authorship exemption** is keyed to the exact bot email; if
   GitHub ever rotates it, `commit-range` starts validating Dependabot
   commits again (fail-visible, not silent).

## Alternatives rejected

- **Enable commitlint as-is in CI** (`--from/--to` range lint): reds existing
  history via `scope-enum`, is stricter than the hook on case/full-stop/body,
  and creates a second rule list with no parity test — the exact drift this
  ADR closes.
- **Adopt `amannn/action-semantic-pull-request` for titles:** a third-party
  action needing a new allowlisted SHA (ADR-247) and its own ruleset that can
  drift from the hook; the hook already _is_ the ruleset.
- **Only lint commits, skip titles:** leaves the squash-title hole — the
  string that actually lands on `main` — wide open.
- **Generate commitlint config from `commit-types.sh` at runtime:** makes the
  local `pnpm commitlint` script depend on bash+node interop for zero
  enforcement gain, since CI runs the hook anyway; a parity test is the cheaper
  drift brake.

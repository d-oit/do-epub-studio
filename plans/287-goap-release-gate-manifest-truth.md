# GOAP-287: Make the release gate manifest tell the truth (closes #1207)

**Status:** COMPLETE
**Date:** 2026-09-26
**ADR:** `plans/287-adr-release-gate-claims.md`
**Closes:** #1207
**Supersedes:** GOAP-283 (`plans/283-goap-release-gate-manifest-truth.md`) — that plan proposed _renaming or retiring_ the three unmet claims; this one implements them instead, per ADR-287.

## Goal

Six of eight `release.checks` claims in `scripts/gate-manifest.json` occurred
zero times in `.github/workflows/release.yml`, and the validator that noticed
printed `⚠` and exited 0.

## What was done

### A — naming drift (3 claims), mechanical

Renamed to the real `name:` values so `grep` resolves them:

- `Tag/Version Agreement` → `Verify tag matches VERSION file`
- `Main Ancestry` → `Verify tag is on main branch`
- `Required PR Checks` → `Verify CI checks passed`
- (`Release Readiness` → `Release Readiness Gate`, for accuracy)

### B — absent claims (3), implemented as real gates

Per ADR-287 the claims are **implemented, not retired**; retiring them would
have silenced the sensor without adding an assurance.

| Claim               | Job                  | What it does                                                                                                                                                                               |
| ------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Coverage Gate`     | `coverage-gate`      | `scripts/validate-coverage-parity.sh` — the same validator the local gate runs, so threshold drift across `coverage-thresholds.json` / `vitest.config.ts` / `codecov.yml` blocks a release |
| `Security Checks`   | `security-gate`      | CodeQL init/analyze/upload against the tagged commit, then `Fail on open security alerts` reads the alert count and blocks on any open alert                                               |
| `Cross-Browser E2E` | `cross-browser-gate` | `playwright test --project=chromium --project=firefox --project=webkit` against the mocked lanes, so the claim is performed at release time rather than only on the nightly schedule       |

All three are added to the `release` job's `needs`, so they actually gate.

### B2 — the step behind `Required PR Checks` was fail-open

`Verify CI checks passed` warned and `exit 0` when no check runs existed, and
only treated `conclusion == "failure"` as red, so `cancelled` / `timed_out` /
`action_required` / `stale` released silently. It now:

- fails when the commit has **no** check runs;
- iterates the **required contexts** (the ADR-286 list) and fails when any is
  missing or not `success`/`neutral` — `skipped` is explicitly not green;
- still prints non-green checks outside the required set, as visibility.

The security gate likewise fails closed if it cannot read the alert count.

### B3 — the rewritten step had two bugs, found by executing it

Rewriting the step to be context-driven is not the same as it working. The
logic was **extracted from the workflow and run against real check-run data**,
which is the only way to catch these — `actionlint` validates the shell, and
`validate-gate-parity.sh` only greps names, so both passed while the step was
broken.

**1. Every required check reported "missing" — every release would fail.**
`gh api --jq` emits **one JSON object per line (JSONL)**, and
`gh api --paginate` without `--jq` emits **one object per page**. Neither is a
single JSON array, so `map(select(.name == $n))` failed on every input with
`Cannot index string with string "name"`, returned empty for every context, and
the step failed closed for the wrong reason. `--slurp` is not available here —
this `gh` rejects it alongside `--jq` — so the fix is to take gh's raw pages
and let `jq -s` do the slurping. The output shape is now validated once
(`jq -e 'type == "array"'`) before any judgement, so a parser error can never be
reported as a missing check.

**2. A check that both succeeded and failed passed.** The verdict was a joined
string, and the test was `grep -qvE '(success|neutral)(,|$)'` over the whole
string — which only proves that _one_ element matched.
`completed/success,completed/cancelled` contains `success,` and therefore
**passed**, letting a required check through on the strength of a superseded
cancelled run. Re-runs are exactly what a tagged commit accumulates, so this was
not hypothetical. Each run is now matched individually against
`^(completed)/(success|neutral)$`.

Both were invisible to every existing check, which is why the plan's own
verification standard for this step is "execute it against real data", not
"the name resolves in the file".

### C — the validator now fails instead of warning

`validate-gate-parity.sh` sets `FAILED=1` on any unmet release claim, and the
`⚠`-forever state is over.

The validator was also **producing a false `⚠` for hyphenated claims**: it
normalised the manifest entry with `sed 's/[^a-z0-9 ]//g'` (hyphens deleted) but
grepped the raw file (hyphens intact), so `Cross-Browser E2E` → `crossbrowser
e2e` could never match `Cross-Browser E2E`. Both sides are now normalised
identically and matched as whole phrases.

## Verification

- `./scripts/validate-workflows.sh` → exit 0, `release.yml` passes actionlint
  zizmor. The first attempt failed: the SHAs I wrote for `github/codeql-action`
  and `actions/upload-artifact` were not in the allowlist. Replaced with the
  SHAs already verified in `codeql.yml` (`1c5b675…` v4.38.1) and `ci.yml`
  (`ea165f8…` v4.6.2) — a rule worth keeping: an unpinned or unknown SHA is
  caught locally, so a workflow change cannot ship an invented pin.
- `bash scripts/validate-gate-parity.sh` → exit 0, **8/8 release claims ✓, zero
  `⚠`**.
- Fail-closed proven by injection: adding a bogus claim (`Nonexistent Gate XYZ`)
  to `gate-manifest.json` makes the validator exit 1; removing it returns exit 0.
- **The readiness step was executed against real check-run data**, extracted
  from the workflow body rather than eyeballed:
  - a known-green commit → all 8 contexts reported `completed/success`, exit 0;
  - an unknown commit → clean `::error::No check runs found`, exit 1, no jq
    noise;
  - the mixed-verdict fix was proven against a synthetic
    `completed/success,completed/cancelled`, which the **old** regex passed and
    the new per-run check rejects.
- The three new gates are real jobs, not name matches: `coverage-gate` (1 run
  step, calls `scripts/validate-coverage-parity.sh`), `security-gate` (4 steps,
  3 pinned CodeQL actions), `cross-browser-gate` (6 steps, runs
  `--project=chromium --project=firefox --project=webkit`, all three confirmed
  defined in `playwright.config.ts`). `actionlint` — which shellchecks `run:`
  blocks — passes on the file.

## Follow-ups (deliberately not done here)

- `Verify CI checks passed` hard-codes the required-context list. It should read
  the branch-protection API. Blocked on the release job's token scope
  (`contents: read`, `checks: read`); widening it is a separate decision. The
  drift direction is safe meanwhile — a context added to protection but not to
  the list fails the release closed.
- The `Security Checks` gate uses `fail-on: none` for the analysis step and
  gates on the API alert count instead, so a transient CodeQL action failure
  cannot masquerade as "alerts found".
- The four pre-existing `⚠` PR-side lines (`Bundle Size`, `Lighthouse audit`,
  `Codacy Static Code Analysis`, `Quality Gate`) are **not** addressed here. They
  are a separate, honest signal: those gates live in auxiliary workflows
  (`bundle-size.yml`, `lighthouse.yml`) or are named differently than the
  manifest's prose (`Quality Gate` vs the real `Full Quality Gate`). Making the
  PR section fail-closed is the natural next step, but it is a distinct claim
  set from the release one this issue is about, and it is left visible rather
  than quietly folded in.

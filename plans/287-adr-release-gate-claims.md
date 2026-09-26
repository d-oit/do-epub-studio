# ADR-287: Release-gate claims are implemented, not retired — and an unmet claim now fails

**Date:** 2026-09-26
**Status:** Accepted
**Deciders:** Project maintainer
**Related:** GOAP-283 (`plans/283-goap-release-gate-manifest-truth.md`), ADR-283, #1207, GOAP-277, ADR-277, ADR-286 (`plans/286-adr-required-status-check-set.md`)

## Context

`scripts/gate-manifest.json` → `release.checks` declared eight "Required release
readiness checks". Six of the eight strings occurred **zero times** in
`release.yml`, and `validate-gate-parity.sh` printed three permanent `⚠` lines
for them while still exiting 0.

GOAP-283 split the problem in two, and this ADR decides both halves.

**Three were naming drift** — the guard existed under a different `name:`:

| Manifest claim          | Actually enforced by                   |
| ----------------------- | -------------------------------------- |
| `Tag/Version Agreement` | step `Verify tag matches VERSION file` |
| `Main Ancestry`         | step `Verify tag is on main branch`    |
| `Required PR Checks`    | step `Verify CI checks passed`         |

**Three were genuinely absent** — no coverage gate, no cross-browser E2E, no
security check anywhere in `release.yml`. The only cross-browser run in CI is
`Scheduled Cross-browser E2E`, which is `if: github.event_name == 'schedule'`
and therefore proves nothing about the commit being tagged.

Reading the workflow for this ADR also surfaced a defect the issue did not
mention. `Verify CI checks passed` — the step that stands in for
`Required PR Checks` — was **fail-open**:

- it warned and `exit 0` when a commit had no check runs at all;
- it only treated `conclusion == "failure"` as red, so `cancelled`, `timed_out`,
  `action_required` and `stale` all released silently;
- it ignored commit _statuses_ entirely, which is where third-party reporters
  (Codecov) publish.

So the one claim that did resolve to a real step was the weakest step in the
workflow.

## Decision

1. **Implement the three absent gates.** A claim may be retired only if the
   assurance genuinely lives elsewhere _and_ something enforces it there.
   "The coverage/e2e/security work happens in ci.yml" is not sufficient, because
   ci.yml is push- and schedule-triggered and says nothing about the tagged
   commit.
2. **Rename the three drifted claims** to the real `name:` values.
3. **`Verify CI checks passed` becomes fail-closed and context-driven**: it
   checks the same required contexts that protect `main` (ADR-286), and treats a
   _missing_ context as an error rather than a warning. `skipped` is not green.
4. **An unmet release claim fails the validator** (exit 1) instead of printing
   `⚠` and exiting 0.

## Why implement rather than retire

Retiring `Coverage Gate` because "coverage is enforced by
`Full Quality Gate`" would be a true statement that produces the wrong outcome:
`Full Quality Gate` runs on a push to `main`, not on a tag, and a tag can be
pushed at any commit. Retiring the claim would also have had the convenient side
effect of turning the `⚠` green, which is precisely the "weakening a sensor to
obtain a passing result" the completion contract forbids. The `⚠` was the
working signal; the fix was to implement, not to silence.

## Why the parity validator must fail

A `⚠` that is always printed and never acted on is a warning nobody reads — the
repo's own recorded anti-pattern. Escalating to exit 1 is the only change that
makes the manifest self-enforcing, and it is the same direction ADR-277 took
for silently-skipped CI jobs.

The validator was also **lying about hyphenated claims**. It normalised the
manifest entry with `sed 's/[^a-z0-9 ]//g'` (hyphens deleted) but grepped the
raw workflow file (hyphens intact), so `Cross-Browser E2E` reduced to
`crossbrowser e2e` and could never match `Cross-Browser E2E` — a false `⚠`
that would have outlived the real fix. Both sides are now normalised
identically and matched as whole phrases with `grep -qF`.

## Consequences

- `release` now depends on seven jobs instead of four. Release wall-clock grows
  by the slowest of `Coverage Gate` / `Security Checks` / `Cross-Browser E2E`.
- The security gate **fails closed when it cannot read its input**: an API error
  blocks the release rather than passing an unverified check. A gate that cannot
  read its input must not report success.
- `Verify CI checks passed` now hard-codes the required-context list. It is
  commented as such, and the drift direction is safe: a context added to branch
  protection but not here fails _closed_ (the release blocks), not open. It
  should eventually be read from the branch-protection API, which is noted as
  follow-up rather than done here because the release job's token is scoped
  `contents: read` + `checks: read` and widening it is a separate decision.
- Any future rename of a release job must update `gate-manifest.json` **and**
  this step, and `validate-gate-parity.sh` will now fail the build if they
  disagree — which is the intended property.

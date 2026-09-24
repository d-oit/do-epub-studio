# ADR-283: `gate-manifest.json` release claims are deferred, not deleted

**Date:** 2026-09-24
**Status:** Accepted (deferral decision only — implementation is GOAP-283)
**Deciders:** Project maintainer
**Related:** GOAP-283 (`plans/283-goap-release-gate-manifest-truth.md`), GOAP-277, ADR-277 (fail-closed skip visibility), ADR-247 (SHA pinning), ADR-083 (numbering), AGENTS.md Tier 1 (surfaced-issue policy)

## Context

While gating GOAP-276 Phase 0 #5, `scripts/validate-gate-parity.sh` printed:

```
▸ Release gate checks:
  ✓ Release Readiness
  ⚠ Tag/Version Agreement (not found in release.yml — may use different naming)
  ⚠ Main Ancestry (not found in release.yml — may use different naming)
  ⚠ Coverage Gate (not found in release.yml — may use different naming)
  ⚠ Required PR Checks (not found in release.yml — may use different naming)
  ⚠ Cross-Browser E2E (not found in release.yml — may use different naming)
  ✓ Performance Budgets
  ⚠ Security Checks (not found in release.yml — may use different naming)
```

A live grep established two distinct causes behind the same symptom:

1. **Three are naming drift** — the guard *is* implemented, just under a
   different `name:` (`Verify tag matches VERSION file`,
   `Verify tag is on main branch`, `Verify CI checks passed`).
2. **Three are genuinely absent** — no `Coverage Gate`, `Cross-Browser E2E` or
   `Security Checks` step or job exists anywhere in `release.yml`.

`gate-manifest.json` has **no workflow-side consumer**: only
`validate-gate-parity.sh` and `validate-coverage-parity.sh` read it, and
matching is `grep -qi` over normalized text of the whole workflow file. So the
manifest is documentation-with-a-linter, not a control — which is precisely why
it was able to drift.

This is the same defect family as GOAP-277 (gates that never run), discovered
through a different sensor.

## Decision

1. **The three unmet claims stay in `gate-manifest.json`.** They are removed
   only if GOAP-283 B decides the assurance lives elsewhere — never merely to
   make the validator quiet. Converting a `⚠` into silence by deleting the
   claim is "weakening a sensor to obtain a passing result", which the
   completion contract forbids outright. The warning is the live signal.
2. **The three naming-drift entries are renamed in GOAP-283, not here.** This
   deferral keeps the surfacing change (coverage SSOT, ADR-282) coherent for
   review; bundling release-gate semantics into a coverage PR would obscure both.
3. **Deferral is legitimate only while the follow-up exists and is linked.**
   AGENTS.md Tier 1 permits a surfaced pre-existing issue to move to a follow-up
   GOAP + ADR + tracking issue *linked from the current PR*; the PR is not
   mergeable until that link exists. This ADR plus GOAP-283 and the tracking
   issue are that link.
4. **The `⚠`-forever state is accepted only as an interim**, with a named owner
   step (GOAP-283 C) to decide escalation to `✗`/exit 1, consistent with
   ADR-277's fail-closed direction for silently-unrun gates.

## Why not fix it in the surfacing PR

- `release.yml` is supply-chain critical (cosign sign-blob, SLSA provenance,
  SBOM, post-deploy health check). Editing it belongs to a change that tests and
  validates workflows as its subject, not to one whose gate phase is
  `coverage-parity`.
- The correct end state for the three absent gates is undecided: adding three
  release jobs and dropping three claims are both plausible, and choosing
  casually inside an unrelated PR would bake in a policy nobody reviewed.

## Alternatives rejected

- **Delete the three claims now** — rejected: silent weakening of the manifest
  linter; the underlying question (are release-time coverage/security/cross-browser
  assurances required?) would go unanswered while the dashboard looked healthy.
- **Rename everything to match today's workflow and call it done** — rejected:
  it would mark `Coverage Gate`, `Cross-Browser E2E` and `Security Checks` as
  satisfied by steps that do not exist, converting a true warning into a false
  green.
- **Escalate `⚠` to `✗` immediately** — rejected: would red every run from this
  PR onward on a pre-existing condition, violating the intent of "fix, don't
  suppress" by forcing an unrelated fix into this change set.

## Consequences

- `validate-gate-parity.sh` continues to print three `⚠` release lines until
  GOAP-283 lands. Non-blocking (`exit 0`), so no gate or CI run is red.
- The next release-readiness audit must start from this ADR rather than
  re-deriving the grep table.
- Any PR that touches `release.checks` or `release.yml` must link GOAP-283.

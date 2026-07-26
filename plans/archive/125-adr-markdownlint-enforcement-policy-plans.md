# ADR-125 — Markdownlint Enforcement Policy for `plans/`

**Date:** 2026-07-09
**Status:** Accepted (this PR — `chore/markdownlint-md058-cleanup`)
**Supersedes:** Nothing (first occurrence of this policy)

---

## Context

AGENTS.md Tier 1 mandates: *“MUST always fix pre-existing issues when encountered.
Deferral is not allowed. If a pre-existing issue is too large for the current
change, open a follow-up GOAP plan + ADR + tracking issue.”*

During the SE2/SE3 PR (#748) work, `markdownlint-cli2` enumerated **13 pre-existing
MD058 (blanks around tables) violations** across `plans/028`, `plans/045`,
`plans/083`, and one MD038 (no-space-in-code-span) regression I introduced in
`plans/121` when appending the PR #748 row. The violations had gone undetected
because the project's pre-commit hook (`.pre-commit-config.yaml`) and CI markdownlint
step do not, today, run `markdownlint-cli2` against every plan file on every
push — the hook runs on staged files only, and CI relies on it. Future drift
into similar violations is the natural failure mode.

## Decision

> **`plans/**/*.md` MUST comply with `markdownlint-cli2` ruleset under
> `.markdownlint.json` (`default: true`, all rules MD001–MD058 enabled). Any
> PR that introduces a markdownlint violation is **non-mergeable** until the
> violation is fixed or explicitly justified with an inline
> `<!-- markdownlint-disable ... -->` block + comment.**

The enforcement mechanism is therefore:

1. **`.markdownlint.json`** keeps `"default": true` so every rule (currently
   MD001–MD058) is active. No rule is selectively disabled.
2. **`.pre-commit-config.yaml`** already wires `markdownlint-cli` against
   `.markdownlint.json`. The hook fires on staged files and blocks the commit
   if any rule fires.
3. **GitHub Actions markdownlint step** (in `ci.yml`) already runs repo-wide.
   A failure there blocks merge per branch protection.
4. **Plan authors** are responsible for running `npx markdownlint-cli2
   'plans/**/*.md' --config .markdownlint.json` locally before pushing.
5. **In-block disables** are allowed but require an inline justification
   comment above the disable directive. Common legitimate use: tables preceded
   by YAML frontmatter or `---` rules.

## Consequences

**Positive**

- Drift in `plans/` markdown formatting is caught at lint-time on every commit.
- Manual cleanup sweeps (like this PR's removal of 14 violations) become
  unnecessary — they cannot re-accumulate.
- New plan authors get immediate feedback on table formatting, code-span
  spacing, heading style, and the rest of the markdownlint rule set.
- Plan documents gain a uniformly professional appearance, which improves
  reader (human and AI) comprehension.

**Negative / costs**

- Trivial formatting slips create CI failures. The friction is intended.
- Authors may need to run `markdownlint-cli2 --fix` once per workflow to
  resolve en masse; this is the established mechanism.

**Reversibility**

- The policy is a single rule (`default: true`) + an existing pre-commit hook.
  It can be relaxed by setting `default: false` and listing only the rules we
  care about, but doing so would re-open the drift path this ADR closes.

## Validation

- Implemented by `chore/markdownlint-md058-cleanup` PR (this PR).
- Verified by: `markdownlint-cli2 plans/**/*.md --config .markdownlint.json`
  returning exits-code 0 after the cleanup.
- Future verification: pre-commit hook + CI markdownlint step on every PR.

## Compliance

- **AGENTS.md Tier 1** — Pre-existing issues MUST be fixed when surfaced.
  This ADR formalises the markdownlint subset of that rule.
- **AGENTS.md Tier 2 step 9** — Plan + ADR scaffold for the deferred
  cleanup (Plan 124).

## Related

- **Plan 124** (companion GOAP) — documents this PR's cleanup actions.
- **ADR-035a / ADR-035b** — sibling rule that established pre-commit hook
  architecture for markdownlint (no policy change).
- **AGENTS.md** — Tier 1 “always fix pre-existing issues” + Tier 2
  `./scripts/quality_gate.sh` includes markdownlint.

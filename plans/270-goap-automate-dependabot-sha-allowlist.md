# GOAP-270: Automate verified-SHA allowlisting for Dependabot actions bumps

**Status:** DONE (Phases 1–3 complete; SHA-append path dogfooded on a live bump)
**Date:** 2026-09-14
**ADR:** ADR-247 (`plans/247-adr-dependabot-sha-allowlist-automation.md`)

## Context

Every Dependabot `github-actions` group bump re-pins external actions to new
commit SHAs. `scripts/validate-workflows.sh` rejects any `uses:` pinned to a
SHA missing from the `ALLOWED_SHAS` list (`scripts/validate-shas.sh`), so each
bump fails the `Pre-commit Hooks` and `Full Quality Gate` checks with
"Disallowed or unverified SHA" until a human appends the new entries. Found in
the GOAP-264b PR sweep on 2026-09-14 while reviewing PR #1124 (CodeQL action
v4.37.9→v4.38.0, Chromatic action v18.7.2→v18.8.1): the failure surfaced only
in CI, and `pnpm lint` also failed because `lint:workflows` runs the same
validator, sending the author to lint rules before the real cause.

The manual remedy (performed in-session for #1124) is to verify each new SHA
against the action's upstream annotated tag via
`git ls-remote <upstream> refs/tags/<tag>^{}` — the GitHub tags API returns
the tag object, not the commit, so naive verification can pass on the wrong
SHA — and then append `action@sha` entries to `ALLOWED_SHAS`. That is manual
friction on every bump and leaves CI red in the interim.

## Phases

| #   | Phase                                                                                                                                                                                                                                 | Exit criteria                                                                                                               | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Script `scripts/allowlist-dependabot-shas.sh`: parse the PR diff for `action@sha` pairs, dereference each against the action's upstream (tag from the trailing `# vX.Y.Z` comment), append verified entries with a provenance comment | Script refuses unresolvable or ambiguous SHAs (exit non-zero, no append); exercised on synthetic diffs incl. negative cases | DONE (this PR: `scripts/tests/allowlist-dependabot-shas.bats`; real-network smoke proves a genuine lightweight-tag SHA verifies and a mutated SHA fails closed; lightweight tags need a plain-ref fallback because servers do not advertise peeled refs for them)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2   | Wire the script into `.github/workflows/dependabot-auto-merge.yml` before the approve step (or a dedicated dependabot-only workflow), committing the append to the PR branch                                                          | The next Dependabot actions bump turns green with no manual allowlist edit; `bot-repush-guard` permits the bot commit       | DONE (this PR: checkout base + verify/allowlist step; runs from the base checkout so PR content cannot alter verification; pushes via `gh auth setup-git` with `persist-credentials: false`; no-automerge rule untouched)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 3   | Dogfood and record: observe one live bump; update this plan and ADR-247 status                                                                                                                                                        | Phase 2 observed end-to-end on a real Dependabot PR; learnings captured via the `learn` skill                               | DONE (SHA-append path OBSERVED 2026-09-21T09:20:20Z: the scheduled `github-actions` group bump opened PR #1164; Dependabot Auto-merge run `35582701376` succeeded, executed `scripts/allowlist-dependabot-shas.sh` against the real diff, verified `chromaui/action` v18.9.4 against its upstream tag and pushed bot commit `cad3fc66` "ci: allowlist verified SHAs from this dependabot bump" onto the PR branch. The entry landed on main in `scripts/validate-shas.sh` and `.github/workflows/visual-regression.yml`, and #1164 merged with **no manual allowlist edit** — the Phase 2 exit criterion. The no-op path was observed earlier on 2026-09-15 across #1132–#1136 (`No new SHAs to allowlist.`, approve withheld per GOAP-224). Learnings recorded in `agents-docs/LEARNINGS.md`) |

## Related

- GOAP-264b (PR swarm triage) — this plan originates from the 2026-09-14 sweep.
- GOAP-224 no-automerge rule — unchanged: automation verifies and allowlists
  only; a human still merges explicitly.

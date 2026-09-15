# GOAP-270: Automate verified-SHA allowlisting for Dependabot actions bumps

**Status:** IN PROGRESS (Phase 1–2 done; Phase 3 dogfood pending)
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

| # | Phase | Exit criteria | Status |
|---|-------|---------------|--------|
| 1 | Script `scripts/allowlist-dependabot-shas.sh`: parse the PR diff for `action@sha` pairs, dereference each against the action's upstream (tag from the trailing `# vX.Y.Z` comment), append verified entries with a provenance comment | Script refuses unresolvable or ambiguous SHAs (exit non-zero, no append); exercised on synthetic diffs incl. negative cases | DONE (this PR: `scripts/tests/allowlist-dependabot-shas.bats`; real-network smoke proves a genuine lightweight-tag SHA verifies and a mutated SHA fails closed; lightweight tags need a plain-ref fallback because servers do not advertise peeled refs for them) |
| 2 | Wire the script into `.github/workflows/dependabot-auto-merge.yml` before the approve step (or a dedicated dependabot-only workflow), committing the append to the PR branch | The next Dependabot actions bump turns green with no manual allowlist edit; `bot-repush-guard` permits the bot commit | DONE (this PR: checkout base + verify/allowlist step; runs from the base checkout so PR content cannot alter verification; pushes via `gh auth setup-git` with `persist-credentials: false`; no-automerge rule untouched) |
| 3 | Dogfood and record: observe one live bump; update this plan and ADR-247 status | Phase 2 observed end-to-end on a real Dependabot PR; learnings captured via the `learn` skill | IN PROGRESS (bait live: chromaui/action downgraded to v18.7.2 on main via #1128, 2026-09-14, SHA still allowlisted and main CI green; Dependabot did not re-scan within ~14.5 h of the manifest change — the manifest-push trigger evidently does not apply to the `github-actions` ecosystem, so the next certain scan is the scheduled weekly run Mon 2026-09-22 09:00 UTC; fallback if no re-bump PR by end of 2026-09-22: restore v18.8.1 manually and close Phase 3 as verified-by-tests, noting the wiring is deployed but the live observation is outstanding) |

## Related

- GOAP-264b (PR swarm triage) — this plan originates from the 2026-09-14 sweep.
- GOAP-224 no-automerge rule — unchanged: automation verifies and allowlists
  only; a human still merges explicitly.

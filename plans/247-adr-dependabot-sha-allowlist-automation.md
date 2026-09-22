# ADR-247: Dependabot actions bumps get automated verified-SHA allowlisting

**Status:** Accepted (2026-09-14) — implemented, dogfood-verified 2026-09-22 (GOAP-270 Phase 3; run `35582701376`, bot commit `cad3fc66`, PR #1164 merged without a manual allowlist edit)
**Date:** 2026-09-14
**Related:** GOAP-270, `scripts/validate-shas.sh`, `scripts/validate-workflows.sh`, `.github/workflows/dependabot-auto-merge.yml`

## Context

The SHA-pinning allowlist in `scripts/validate-shas.sh` is the repo's supply
chain control for third-party GitHub Actions: `validate-workflows.sh` rejects
any `uses:` entry pinned to a SHA that is not explicitly allowlisted. The
control works, but it is manual: every Dependabot `github-actions` bump pins
new SHAs, fails `Pre-commit Hooks` and `Full Quality Gate` in CI, and waits
for a human to verify and append the SHAs (done by hand for PR #1124 during
the GOAP-264b sweep). The failure mode is invisible locally until a bump
lands, and the `pnpm lint` red herring (`lint:workflows` runs the same
validator) misdirects first diagnosis.

## Decision

1. **The allowlist stays the security control and stays append-only.** SHAs
   are never accepted on faith: an entry is added only after the SHA is
   confirmed to be what the upstream tag claims, dereferenced from the
   action's own repository.
2. **Verification is automated, not trusted.** A repo script parses the
   Dependabot PR diff, dereferences each new SHA against the upstream
   annotated tag (`git ls-remote <upstream> refs/tags/<tag>^{}` — the tags
   API returns the tag object, not the commit), appends verified entries with
   a provenance comment, and runs inside the Dependabot workflow so bumps go
   green without manual edits.
3. **Fail closed.** An SHA that cannot be dereferenced, is ambiguous, or does
   not match the claimed version exits non-zero with no append and no
   approval.
4. **The no-automerge rule (GOAP-224) is unchanged.** Automation verifies and
   allowlists only; a human merges explicitly.

## Consequences

- Dependabot actions bumps land green without manual allowlist edits; CI stops
  failing as the first signal of every bump.
- The allowlist keeps growing; pruning SHAs no longer referenced by any
  workflow is intentionally out of scope (append-only preserves audit
  history).
- The script itself must be reviewable: a compromised workflow run must not
  be able to allowlist an arbitrary SHA, so verification reads only from
  upstream `git ls-remote` data, never from the PR body or comments.

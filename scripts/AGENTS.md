# scripts/ AGENTS.md

Guidance specific to authoring and testing scripts in `scripts/`.

## BATS stub layering

- **Stub the lowest-level boundary, not the function under test.** A setup that stubs a high-level function (e.g. `verify_tag_commit`) silently replaces it in every test — lower-level tests then "pass" or "fail" against the stub, not the real logic (GOAP-270: tests 11–13 exercised a `return 0` setup stub instead of the real verifier). Stub the outermost boundary of the unit (network/IO edge, e.g. `resolve_tag_commit`) so per-function tests exercise real logic; override stubs per-test only when that test targets the stubbed seam itself.

- **Stub the clock (`date`), not `sleep`, when testing poll loops.** A bash `sleep` stub spawns a process per iteration; on fork-constrained runners the loop exhausts the fork budget and dies with exit 254 + `SHLVL (1000) too high` noise — a symptom that points at resource limits, not the test. Jump `date` a fixed step per call instead so the deadline/grace branch trips deterministically on the first poll (GOAP-272).

## atomic-commit never stages files

- **`scripts/atomic-commit/run.sh` requires a pre-staged tree**: `validate.sh` runs the full quality gate (lint/typecheck/coverage/build/smoke, plus knip/madge/impeccable) and only then lists the modified/untracked paths it will not commit, and `commit.sh` exits with `No staged changes to commit — Run 'git add <files>' first (this script does NOT auto-stage)`. An unstaged tree therefore costs a complete gate run before it stops. `git add` the intended files first, then run the orchestrator; it also refuses to start on `main`/`master`, so branch before invoking it.

## Dependabot SHA-allowlist dogfooding

- **Dependabot version updates re-bump a downgraded pin to the *latest* upstream release, not the previously pinned one.** A downgrade bait (e.g. chromaui/action v18.7.2 on main) therefore exercises `scripts/allowlist-dependabot-shas.sh`'s append path only when the latest release's SHA is absent from `ALLOWED_SHAS` — if the expected re-bump version is already allowlisted, the live run is a no-op regardless (GOAP-270 Phase 3: v18.9.0 exists upstream and is un-allowlisted, so the re-bump verifies + appends; the earlier fallback plan assumed a no-op re-bump to the allowlisted v18.8.1).
- **Check the bait's expected target SHA against the allowlist before scheduling a live append observation** — `git ls-remote <upstream> "refs/tags/<tag>^{}"` for the latest release vs `scripts/validate-shas.sh`.

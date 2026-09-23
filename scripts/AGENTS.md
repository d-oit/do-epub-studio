# scripts/ AGENTS.md

Guidance specific to authoring and testing scripts in `scripts/`.

## BATS stub layering

- **Stub the lowest-level boundary, not the function under test.** A setup that stubs a high-level function (e.g. `verify_tag_commit`) silently replaces it in every test — lower-level tests then "pass" or "fail" against the stub, not the real logic (GOAP-270: tests 11–13 exercised a `return 0` setup stub instead of the real verifier). Stub the outermost boundary of the unit (network/IO edge, e.g. `resolve_tag_commit`) so per-function tests exercise real logic; override stubs per-test only when that test targets the stubbed seam itself.

- **Stub the clock (`date`), not `sleep`, when testing poll loops.** A bash `sleep` stub spawns a process per iteration; on fork-constrained runners the loop exhausts the fork budget and dies with exit 254 + `SHLVL (1000) too high` noise — a symptom that points at resource limits, not the test. Jump `date` a fixed step per call instead so the deadline/grace branch trips deterministically on the first poll (GOAP-272).

## atomic-commit never stages files

- **`scripts/atomic-commit/run.sh` requires a pre-staged tree**: `validate.sh` runs the full quality gate (lint/typecheck/coverage/build/smoke, plus knip/madge/impeccable) and only then lists the modified/untracked paths it will not commit, and `commit.sh` exits with `No staged changes to commit — Run 'git add <files>' first (this script does NOT auto-stage)`. An unstaged tree therefore costs a complete gate run before it stops. `git add` the intended files first, then run the orchestrator; it also refuses to start on `main`/`master`, so branch before invoking it.

## Quality-gate runs must be serialized

- **`quality_gate.sh` takes an exclusive `flock`** on `${TMPDIR:-/tmp}/do-epub-studio-quality-gate.lock` and exits 2 when another instance holds it: concurrent gates share `<pkg>/coverage/.tmp` (vitest `ENOENT coverage-*.json`, "Something removed the coverage directory") and sibling tasks get SIGTERM'd (`Terminated`, exit 143) — failures that read as lint/test errors but are environmental.
- **A section failure does not stop the gate**: it keeps running the remaining phases and reports at the end, so a mid-run tail showing `✗ Workflow validation FAILED` is *not* completion — wait for the process to exit (or the final `All Quality Gates PASSED` / `Quality Gate FAILED` banner) before starting another run, or the two runs race.

## Dependabot SHA-allowlist dogfooding

- **Dependabot version updates re-bump a downgraded pin to the *latest* upstream release, not the previously pinned one.** A downgrade bait (e.g. chromaui/action v18.7.2 on main) therefore exercises `scripts/allowlist-dependabot-shas.sh`'s append path only when the latest release's SHA is absent from `ALLOWED_SHAS` — if the expected re-bump version is already allowlisted, the live run is a no-op regardless (GOAP-270 Phase 3: v18.9.0 exists upstream and is un-allowlisted, so the re-bump verifies + appends; the earlier fallback plan assumed a no-op re-bump to the allowlisted v18.8.1).
- **Check the bait's expected target SHA against the allowlist before scheduling a live append observation** — `git ls-remote <upstream> "refs/tags/<tag>^{}"` for the latest release vs `scripts/validate-shas.sh`.

## Fresh-container recovery (hooks + do-harness)

- **`.git/hooks` is not versioned — a fresh container ships with NO pre-commit/commit-msg/pre-push**, so every hook-based gate is silently inert. Run `./scripts/install-hooks.sh` (symlinks from `scripts/hooks/`) and verify with `./scripts/validate-git-hooks.sh` before trusting hook enforcement.
- **The `do-harness` binary is container-local too**: reinstall pinned via `curl -fsSL https://raw.githubusercontent.com/d-o-hub/do-harness/main/scripts/install.sh | sh -s -- --version <tag>` (SHA-256 verified, lands in `~/.local/bin`), then `do-harness init-db` + `do-harness explain --set verification --changed`. NEVER run `do-harness hook install` here — it would clobber the scripts/hooks symlinks (ADR-246: repo hooks stay authoritative; its doctor WARNs about unmanaged hooks are expected).

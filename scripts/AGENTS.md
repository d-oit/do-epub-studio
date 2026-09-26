# scripts/ AGENTS.md

Guidance specific to authoring and testing scripts in `scripts/`.

## BATS stub layering

- **Stub the lowest-level boundary, not the function under test.** A setup that stubs a high-level function (e.g. `verify_tag_commit`) silently replaces it in every test — lower-level tests then "pass" or "fail" against the stub, not the real logic (GOAP-270: tests 11–13 exercised a `return 0` setup stub instead of the real verifier). Stub the outermost boundary of the unit (network/IO edge, e.g. `resolve_tag_commit`) so per-function tests exercise real logic; override stubs per-test only when that test targets the stubbed seam itself.

- **Stub the clock (`date`), not `sleep`, when testing poll loops.** A bash `sleep` stub spawns a process per iteration; on fork-constrained runners the loop exhausts the fork budget and dies with exit 254 + `SHLVL (1000) too high` noise — a symptom that points at resource limits, not the test. Jump `date` a fixed step per call instead so the deadline/grace branch trips deterministically on the first poll (GOAP-272).

## atomic-commit never stages files

- **`scripts/atomic-commit/run.sh` requires a pre-staged tree**: `validate.sh` runs the full quality gate (lint/typecheck/coverage/build/smoke, plus knip/madge/impeccable) and only then lists the modified/untracked paths it will not commit, and `commit.sh` exits with `No staged changes to commit — Run 'git add <files>' first (this script does NOT auto-stage)`. An unstaged tree therefore costs a complete gate run before it stops. `git add` the intended files first, then run the orchestrator; it also refuses to start on `main`/`master`, so branch before invoking it.
- **`atomic-commit` can _never_ finish green on a PR that touches `packages/ui/**`** — that path trips `visual-regression.yml`, whose Chromatic app check `UI Tests` stays `pending` until a human accepts baselines, while `verify.sh` counts _every_ pending check and exits 2 at the deadline. The exit is deliberate (`"INCONCLUSIVE, not a failure: the PR and branch are left as they are"`), so read a non-zero `atomic-commit` on such a PR as "go look", not as a red gate: confirm the GitHub-native checks yourself, then `gh pr merge` and let branch protection decide server-side — `mergeStateStatus: UNSTABLE` is still mergeable when the pending check is not required. `Visual Regression` is path-filtered to `packages/ui/**`, `apps/web/src/**/*.css`, `apps/web/tailwind.config.*` and `apps/web/src/index.css`, so editing even a `vitest.config.ts` under `packages/ui/` is enough to trigger it.

## Quality-gate runs must be serialized

- **`quality_gate.sh` takes an exclusive `flock`** on `${TMPDIR:-/tmp}/do-epub-studio-quality-gate.lock` and exits 2 when another instance holds it: concurrent gates share `<pkg>/coverage/.tmp` (vitest `ENOENT coverage-*.json`, "Something removed the coverage directory") and sibling tasks get SIGTERM'd (`Terminated`, exit 143) — failures that read as lint/test errors but are environmental.
- **A section failure does not stop the gate**: it keeps running the remaining phases and reports at the end, so a mid-run tail showing `✗ Workflow validation FAILED` is _not_ completion — wait for the process to exit (or the final `All Quality Gates PASSED` / `Quality Gate FAILED` banner) before starting another run, or the two runs race.

## Dependabot SHA-allowlist dogfooding

- **Dependabot version updates re-bump a downgraded pin to the _latest_ upstream release, not the previously pinned one.** A downgrade bait (e.g. chromaui/action v18.7.2 on main) therefore exercises `scripts/allowlist-dependabot-shas.sh`'s append path only when the latest release's SHA is absent from `ALLOWED_SHAS` — if the expected re-bump version is already allowlisted, the live run is a no-op regardless (GOAP-270 Phase 3: v18.9.0 exists upstream and is un-allowlisted, so the re-bump verifies + appends; the earlier fallback plan assumed a no-op re-bump to the allowlisted v18.8.1).
- **Check the bait's expected target SHA against the allowlist before scheduling a live append observation** — `git ls-remote <upstream> "refs/tags/<tag>^{}"` for the latest release vs `scripts/validate-shas.sh`.

## Fresh-container recovery (hooks + do-harness)

- **`.git/hooks` is not versioned — a fresh container ships with NO pre-commit/commit-msg/pre-push**, so every hook-based gate is silently inert. Run `./scripts/install-hooks.sh` (symlinks from `scripts/hooks/`) and verify with `./scripts/validate-git-hooks.sh` before trusting hook enforcement.
- **The `do-harness` binary is container-local too**: reinstall pinned via `curl -fsSL https://raw.githubusercontent.com/d-o-hub/do-harness/main/scripts/install.sh | sh -s -- --version <tag>` (SHA-256 verified, lands in `~/.local/bin`), then `do-harness init-db` + `do-harness explain --set verification --changed`. NEVER run `do-harness hook install` here — it would clobber the scripts/hooks symlinks (ADR-246: repo hooks stay authoritative; its doctor WARNs about unmanaged hooks are expected).

## check-bundle-budget.mjs covers more than the budget table

- **`walk()` collects only `.js`/`.css`** (gzip/brotli math) — binary assets were invisible to it, so onnxruntime-web's 25.6 MiB `ort-wasm-simd-threaded.asyncify.wasm` passed every local gate and CI budget check, then failed the Cloudflare Pages upload (#1188). The per-file platform cap therefore uses a separate `walkAllFiles()` over EVERY dist file; add any non-js/css rule there, never to `walk()` alone.
- **SW precache exclusion ≠ deploy exclusion**: `injectManifest.globIgnores` (`**/*.wasm`, `**/*.onnx`) keeps engine artifacts out of the service-worker manifest but leaves them in `dist/` for upload. Cloudflare Pages rejects any single file >25 MiB at asset-validation time — after install/tsc/vite/SW pass. The cap lives in `.performance-budgets.json → platformLimits.cloudflarePagesMaxFileBytes` (Plan 214 R5 single source), runs in the quality gate (post-build) + bundle-size CI, and `apps/web/vite.config.ts` drops oversize _emitted_ assets at `generateBundle` time (runtime fetches ORT wasm from its version-pinned CDN per transformers.js defaults); files copied from `public/` are the sensor's job to catch.

## Break-testing a guard before its rewrite is committed

- **Restoring with `git checkout -- <file>` after a break-test restores the _committed_ version, silently clobbering the uncommitted rewrite** — the guard then keeps failing against the pre-change file (symptom: obsolete errors, e.g. the old LOC cap or missing literal, reappear after the restore "succeeded"). Take a `cp` backup of the rewritten file before breaking a rule and restore from that, never from the index (GOAP-279).

## gate-manifest.json documents, it does not control

- **Nothing in `.github/workflows/` reads `scripts/gate-manifest.json`** — only `validate-gate-parity.sh` (parity) and `validate-coverage-parity.sh` (asserts `local.checks` contains `coverage-parity`) consume it, and matching is `grep -qi` of normalized text over the whole workflow file, not job identity. It is therefore documentation-with-a-linter: renaming an entry is safe (no workflow effect), which is also how it drifted — 6/8 `release.checks` strings had zero hits in `release.yml` (3 naming drift, 3 genuinely absent; GOAP-283 / ADR-283 / issue #1207).
- **Never delete an unmet manifest claim just to quiet the `⚠`.** Removing it converts a true warning into a false green — "weakening a sensor to obtain a passing result" — so the warning stays until the gate is actually implemented or the claim retired by an explicit ADR decision.

## check-adr-index.mjs counts ADR rows only

- **`Numbers tracked: N` is not the number of index rows, and cannot prove every plan is indexed**: `addNumber()` is gated on `filePath.includes('-adr-')` (ADR-083 §2 shares one numeric space between `*-goap-*` and `*-adr-*`), so adding a GOAP-only row leaves the count unchanged — row 276 was added and the count stayed at 92. A plan with no row at all is invisible to the validator: `plans/276-goap-external-harness-benchmark-adoption.md` sat unindexed while rows 279–283 all pointed back at it, and CI stayed green. Audit index coverage by row prefix (`^\| [0-9]`), never by this count.

## gh resolves the repository from your cwd

- **A deleted cwd makes `gh` return empty rather than fail loudly**: `gh` shells out to `git` to discover the repo, so from a removed directory it prints `failed to run git: fatal: Unable to read current working directory` and yields nothing — and a caller that swallows stderr (`2>/dev/null || echo "[]"`) sees a legitimate empty list. `atomic-commit`'s `verify.sh` does exactly that, so removing a worktree out from under a still-running `verify.sh` walks the 300 s "No CI checks detected" grace window and exits 2 (`atomic-commit` exit 6, INCONCLUSIVE) **while the PR is in fact fully green** — precisely what happened to #1208 (36/36 checks passing, reported as unverifiable). Never delete a worktree — or otherwise remove a process's cwd — before its background commands have finished; when a query must survive an unknown cwd, pass `--repo <owner>/<name>`, which works from anywhere.

## Chromatic posts two checks with confusable names

- **The workflow run can be green while the check that matters is pending**: `visual-regression.yml`'s job `Chromatic visual regression` finishes `SUCCESS` (`exitZeroOnChanges: true`), yet Chromatic's _separate_ external check `UI Tests` — the one `verify.sh` counts — stays `PENDING` until a human accepts baselines. "All workflow runs succeeded" is therefore not "all checks passed"; read the two apart, and expect `gh run list` to show a passing run next to a permanently pending check.

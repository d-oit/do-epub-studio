# ADR-1008: CI-enforced agent completion contract (do-harness)

**Status:** Accepted
**Date:** 2026-10-17
**Deciders:** Project maintainer
**Applies to:** `.github/workflows/ci.yml` (`harness-contract`), `do-harness.toml`, `AGENTS.md` (Agent Completion Contract)
**ADRs referenced:** ADR-246 (do-harness adoption; sensors wrap the same commands as the gates), ADR-277 (silently-skipped gates), ADR-283 (release gate manifest truth), ADR-286 (required status checks), ADR-083 (ADR numbering)

## Context

GOAP-276 Phase 1 confirmed that CI never runs do-harness, so the Agent
Completion Contract in `AGENTS.md` — `verify --set verification --strict`,
`status` before claiming done — is advisory only. Nothing breaks when a PR
ships with a red or stale local verification story, and the evidence that does
exist (`git_sha`, `signal_set`, per-sensor verdicts) lives on the machine that
ran it and is never inspected by anyone else.

The sensors are already reproducible: they wrap the same pnpm scripts and
gate-only validators as `quality_gate.sh` (ADR-246's same-command principle),
and upstream now ships pinned release tarballs with a `checksums.txt`.

The upstream template pattern additionally publishes a committed
`.github/ci-status/` state artifact. Adopting it would require a freshness
checker plus cleanup workflows for stale entries.

## Decision

1. **CI runs the contract** in a dedicated `harness-contract` job
   ("Agent Completion Contract (do-harness)") on every non-draft PR and on
   pushes — the same trigger as `Full Quality Gate`, deliberately not
   path-filtered:
   - install do-harness **pinned** — download
     `do-harness-v0.2.1-x86_64-unknown-linux-musl.tar.gz` from the upstream
     release and verify it against that release's `checksums.txt` (never a
     floating install script or an unverified binary);
   - `do-harness verify --set verification --format json
--evidence .do-harness/ci/evidence.json --strict --record`;
   - assert freshness: `do-harness status --set verification
--evidence .do-harness/ci/evidence.json --format json` must report
     `state == "green" and reason == "current"`;
   - assert evidence integrity: `.git_sha == $GITHUB_SHA`,
     `.signal_set == "verification"`, every sensor verdict `pass` and every
     sensor `recorded == true`;
   - upload `.do-harness/ci/` as the `do-harness-verification-evidence`
     artifact (`if: always()`, 7-day retention).
2. **The committed `.github/ci-status/` state artifact is not adopted**
   (maintainer decision, 2026-10-17). The CI-side evidence artifact is the
   contract's proof; there is no served state file to keep fresh and nothing
   to clean up.
3. **The check is not added to the `main` ruleset's required status checks.**
   Per ADR-286 the ruleset requires only `Codacy Static Code Analysis`; the
   job reports as a normal check so a failure is visible and diagnosable.
   Promoting it to a required context is a separate ruleset decision and needs
   no repository edit.
4. `--record` state and the evidence artifact live under `.do-harness/`, which
   is already gitignored; nothing is committed from the job.
5. Sensor definitions stay authoritative in `do-harness.toml`. The workflow
   must not inline copies of the sensor commands (ADR-246).

## Consequences

- A verification failure is now a red CI check instead of a local-only
  condition, and the uploaded artifact lets a reviewer confirm the recorded
  `git_sha` and per-sensor verdicts rather than trust a summary.
- Cost: the `verification` set re-runs typecheck, lint and unit tests that the
  path-filtered `lint`, `typecheck` and `test` jobs also run. Accepted — the
  contract is the full set, and the duplicate work buys a single recorded
  evidence artifact.
- do-harness upgrades are deliberate and single-sourced: the pin is one env
  var (`DO_HARNESS_VERSION`) in the job, and a bump must come with the matching
  upstream checksum verification (which the job enforces automatically).
- `notify-failure` lists the job in its `needs`, so a failure on `main`
  notifies like the other gates.

## Verification

Validated locally before wiring CI, with the exact pinned binary
(`v0.2.1`, checksum-verified download): `verify --set verification --format
json --evidence … --strict --record` exited 0; `status --set verification
--evidence … --format json` reported `state: green, reason: current`; the
integrity `jq` assertion above returned true. `scripts/validate-workflows.sh`
(actionlint + zizmor) passes with the job present.

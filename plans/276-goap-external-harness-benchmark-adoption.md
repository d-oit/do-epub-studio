# GOAP-276: Benchmark adoption — github-template-ai-agents + do-harness

**Status:** IN PROGRESS (Phase 0 remediation 7/7 DONE; **Phase 1 COMPLETE 2026-10-17** — release set, release preflight, `--record`, gate sensors, release-notes shape enforcement, Rationalizations + Red Flags in all 42 SKILL.md, untrusted-ingest sink lint, and the CI-enforced completion contract (ADR-1008) DONE, with dropped-PR detection advisory by decision; Phase 2 version-propagation DONE 2026-10-18, duplicate-PR pre-flight guard DONE 2026-10-20, `act` local rehearsal DONE 2026-10-21, and the agent-level eval lift recorded as NOT ADOPTED (frontmatter schema conflict); the Stop hook remains open - see Progress reconciliation)
**Date:** 2026-09-23

Benchmark analysis of `d-o-hub/github-template-ai-agents` (template) and
`d-o-hub/do-harness` (CLI) against the d.o.EPUB Studio coding workflow
(AGENTS.md, `.agents/skills/`, harness, guardrails, CI, release management).
Read-only analysis; no workflow files were modified.

## Goal

Close the gaps the benchmark surfaced — starting with pre-existing
breakages — and adopt the highest-leverage patterns, without regressing
surfaces where this repo already exceeds both benchmarks.

## Already stronger here (do not churn)

- Thin-adapter drift guard (`scripts/check-agent-sync.mjs`) — machine-enforced;
  template only policy-enforces it.
- `release.yml` supply chain: readiness → perf gate → Lighthouse gate →
  cosign sign-blob → SLSA provenance → fail-closed health check.
- `atomic-commit` staged-diff secret scan, 3-state verify (passed/failed/
  inconclusive), `gate-manifest.json` parity check, `guard-gitignore.sh`.
- zizmor + actionlint + SHA pinning + Dependabot-SHA allowlist (ADR-247).
- ADR-246 hook discipline: repo hooks authoritative; `do-harness hook install`
  correctly forbidden.

## Phase 0 — P0: pre-existing issues surfaced by this analysis (must fix)

1. **`release-management` skill references non-existent
   `scripts/release/sync-changelog.sh`** (5 call sites: SKILL.md lines
   78, 125, 141, 153) — `scripts/release/` contains only
   `create-release-tag.sh`.
2. **Release skill claims a `release:cut` label triggers `release.yml` and
   promotes a release-drafter draft** — `release.yml` triggers on tag push
   `v*`; no release-drafter _workflow_ exists (only
   `.github/release-drafter.yml` config). Rewrite the skill to the true
   flow; treat drafter adoption as a separate decision (ADR).
3. **`harness` skill is stale** — references 4 non-existent skills
   (`htn-planner`, `event-modeler`, `spike-runner`, `skill-distiller`),
   Rust-only sensors that don't match `do-harness.toml` (generic:
   verify-fast/typecheck/lint/test-unit/skills), and writes metrics to
   non-existent `.agents/events/`. Rewrite against the real sensor pack;
   replace `skill-distiller` references with `do-harness distill
--from-strikes` where applicable.
4. **500-line source cap unenforced** — `MAX_LINES_PER_SOURCE_FILE=500`
   has no check in `quality_gate.sh`, ESLint, or `do-harness.toml`.
   Fix via do-harness `loc` sensor (450 warn threshold) + ratchet.
5. **Coverage threshold mismatch** — AGENTS.md Tier 2 #4 (web 55/48) vs
   `codecov.yml` (web 40). Reconcile to one source of truth.
6. **Commit messages/PR titles unchecked in CI** — local commit-msg hook
   only; bots and web edits bypass it; no workflow validates PR titles
   despite AGENTS.md mandating `type(scope):`.
   Adopt: commit-range lint (base...head) + PR-title check.
7. **`.agents/AGENTS.md` escapes `check-agent-sync.mjs`** — add it to the
   adapter/guard list or reconcile its content with root AGENTS.md.

### Phase 0 resolution status (2026-09-24)

| #   | Item                                                                           | PR    | Outcome                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `release-management` skill → non-existent `scripts/release/sync-changelog.sh`  | #1197 | **Closed** — skill rewritten to the real flow: release PR + `scripts/release/create-release-tag.sh`; its commit recipe also fixed to satisfy the body-required `commit-msg` hook                                                                                                                                                                                                                         |
| 2   | `release:cut` label + release-drafter promotion claims                         | #1197 | **Closed** — claims removed (no workflow consumes the label; no drafter _workflow_ exists). Drafter adoption stays a separate ADR decision, listed under "Skipped"                                                                                                                                                                                                                                       |
| 3   | `harness` skill stale (4 phantom skills, Rust-only sensors, `.agents/events/`) | #1197 | **Closed** — sensors sourced from `do-harness.toml`, distillation via `skill-creator` / `distill --from-trace`; the same change fixed hook repo-root resolution (`git rev-parse --show-toplevel`), which had been gating the wrong checkout from worktrees                                                                                                                                               |
| 4   | 500-line source cap unenforced                                                 | #1203 | **Closed** — `scripts/check-loc.mjs` + `scripts/loc-baseline.json` shrink-only ratchet (7 grandfathered files), quality-gate phase, `do-harness` `loc` sensor; **ADR-278**                                                                                                                                                                                                                               |
| 5   | Coverage threshold mismatch (three diverging copies)                           | #1208 | **Closed** — `coverage-thresholds.json` SSOT feeding all 7 `vitest.config.ts` (static import) + `codecov.yml`, enforced by the new `coverage-parity` gate phase; AGENTS.md/CONTRIBUTING/docs prose reduced to pointers; **ADR-282**                                                                                                                                                                      |
| 6   | Commit messages / PR titles unchecked in CI                                    | #1205 | **Closed** — `validate-commit-title.yml` runs `scripts/hooks/commit-msg` itself (PR title in subject-only mode, commit range over `fetch-depth: 0`), so CI cannot be stricter or looser than the local hook; `scripts/lib/commit-types.sh` is SSOT, `type-enum` reconciled, `scope-enum` dropped (dynamic scopes); **ADR-279**. Follow-up #1206: register `pr-title` + `commit-range` as required checks |
| 7   | `.agents/AGENTS.md` escapes `check-agent-sync.mjs`                             | #1204 | **Closed** — 197-LOC parallel document rewritten as a 22-LOC pointer; the `ADAPTERS` array is now the real enforcement loop (5 → 6 adapters checked); **ADR-280**                                                                                                                                                                                                                                        |

**Surfaced en route, each with its own record:** **ADR-281** — the local gate
requires `QUALITY_GATE_NO_SMOKE=1` on webkit-unsupported hosts (Debian 11), with
CI `e2e-smoke` left fail-closed per ADR-277 and no sensor weakened;
**GOAP-283 + ADR-283 + issue #1207** — 6 of the 8
`gate-manifest.json → release.checks` strings occur zero times in `release.yml`
(3 naming drift, 3 genuinely absent: `Coverage Gate`, `Cross-Browser E2E`,
`Security Checks`), deliberately _not_ deleted to avoid weakening the sensor.

Plan IDs used by this phase: **278** LOC ratchet · **279** commit/PR-title CI ·
**280** nested `.agents/AGENTS.md` · **281** local-gate platform · **282**
coverage SSOT · **283** release-gate manifest truth.

Each fix: feature branch + PR per Tier 1; ADR only where a decision is
required (drafter adoption, coverage source of truth).

## Progress reconciliation (2026-09-30 audit)

The previous header claimed "all 7 phases closed". That was wrong: the seven
closed entries above are **Phase 0 items**. Phase 1 and Phase 2 were never
verified complete, and `analysis/feature-docs-harness-audit.md` (GOAP-290)
confirmed three Phase 1 items are genuinely absent. No completion percentage
is asserted below and no item is called missing without a probe or source
scan; "NOT VERIFIED IN THIS AUDIT" means exactly that.

| Phase | Item                                                                                                                                               | Status                                        | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | CI-enforced do-harness completion contract (pinned install → `verify --set verification --strict` → status assert → evidence integrity → artifact) | **DONE (2026-10-17)**                         | **ADR-1008**. `harness-contract` job in `.github/workflows/ci.yml` (non-draft PRs + pushes, `needs: [changes, setup]`, added to `notify-failure`): pinned checksum-verified do-harness v0.2.1 tarball → `verify --set verification --format json --evidence … --strict --record` → `status` assertion (`green`/`current`) → `jq` evidence integrity (`git_sha == $GITHUB_SHA`, `signal_set`, all verdicts `pass`, all `recorded`) → artifact upload. The `.github/ci-status/` state artifact is deliberately NOT adopted (maintainer decision) and the check is not ruleset-required (ADR-286)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 1     | `[signal-sets] release` in `do-harness.toml` + `verify --set release --strict` preflight in `create-release-tag.sh`                                | **DONE (2026-10-18)**                         | Added `release` signal set with 14 sensors to `do-harness.toml`; preflight added to `scripts/release/create-release-tag.sh`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 1     | `--record` added to documented verify commands (or drop the Fail-Fast claim)                                                                       | **DONE (2026-10-18)**                         | Added `--record` to `do-harness verify` commands in `AGENTS.md` (lines 171–172)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 1     | Warn-severity sensors for gate-only shell validators (`agent-sync`, `workflows`, `shell`, `markdownlint`, `bundle`)                                | **DONE (2026-10-18)**                         | Added sensors for `agent-sync`, `workflows`, `bundle`, `app-identity`, `adr-index`, `plan-references`, `gate-parity`, and `coverage-parity` to `do-harness.toml`; verified via `do-harness verify --set release`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 1     | Rationalizations + Red Flags sections in all 42 SKILL.md + `validate-skill-format.sh` enforcement                                                  | **DONE (2026-10-18)**                         | All 42 `SKILL.md` files carry `## Rationalizations` (table `\| Rationalization \| Reality \|`, ≥2 rows) and `## Red Flags` (`- [ ]`, ≥3 items); enforced by `scripts/validate-skill-format.sh` checks 8–9 (invoked from `quality_gate.sh` via `scripts/lib/quality_gate_docs.sh`); shipped `.agents/skills/SKILL_TEMPLATE.md`; bats suite `scripts/tests/validate-skill-format.bats`; documented in `agents-docs/SKILLS.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 1     | Release-notes shape enforcement (required sections, surviving placeholders, dropped-PR detection, `--self-test`)                                   | **DONE (2026-10-18)**                         | `scripts/release/check-release-notes.sh` validates the `## [X.Y.Z] - YYYY-MM-DD` header, conventional sections, non-empty Breaking Changes (explicit `None.`), and rejects `TODO`/`TBD`/`FIXME`/`XXX`/`<placeholder>`; `--self-test` sensor; bats suite `scripts/tests/check-release-notes.bats` (8/8); preflight in `create-release-tag.sh`; `release-notes` sensor in `do-harness.toml`. Dropped-PR detection is ADVISORY by user decision: it lists PRs merged since the latest tag not cited in the section and never fails the release. Currently reports 332 uncited PRs since `v0.2.0`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 1     | `untrusted-ingest` sink lint for PR-text consumers                                                                                                 | **DONE (2026-10-17)**                         | `scripts/check-untrusted-ingest-sinks.mjs` scans the executable content of the five consumers (`pr-review-fix`, `pr-roast-batch-close`, `github-pr-autopilot`, `scripts/smart-update-pr.sh`, `.github/workflows/bot-repush-guard.yml`) for `eval`, `sh -c`, `exec`, shell-enabled spawn, `new Function`, `os.system`/`subprocess`; md fences, `.sh`/`.bats`, YAML `run:` blocks and JS/TS/Python are extracted, comment-only lines skipped, and a missing target FAILS (no vacuous pass). Found and removed the one real sink (`bash -c` in `roast-batch-close.bats`); gate phase in `scripts/lib/quality_gate_secondary.sh`, manifest entry `untrusted-ingest` in `scripts/gate-manifest.json`, `untrusted-ingest` sensor in the `release` set; bats suite `scripts/tests/check-untrusted-ingest-sinks.bats` (10/10)                                                                                                                                                                                                                                                                                    |
| 2     | Light/Full process modes; move Skills Reference table to `agents-docs/AVAILABLE_SKILLS.md` pointer                                                 | **DONE (2026-10-20)**                         | `AGENTS.md` gained a `## Process Modes` section (Light/Full) that changes the depth of the plan but never the rules, and the hand-maintained Skills Reference table was replaced by a pointer to the generated `agents-docs/AVAILABLE_SKILLS.md` catalog. The drift guard `scripts/check-agent-sync.mjs` keeps the per-model adapters thin.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2     | `do-harness loc` cap enforcement; `overlap` advisory sensor; `skills suggest`; `skills drift` manifest generalization                              | **DONE (2026-10-17)**                         | LOC-cap portion satisfied by Phase 0 item 4 / ADR-278 (`scripts/check-loc.mjs` + shrink-only baseline + `loc` sensor). `overlap` sensor added to `do-harness.toml` and the `release` set (`when-changed` scoped to `.agents/skills/**`, `agents-docs/AVAILABLE_SKILLS.md`, `do-harness.toml`); the tool is inherently advisory (ranked pairs, exit 0) and the policy — flagged pair = sharpen scope, never merge — is documented in `agents-docs/SKILLS.md` together with the `skills suggest --query` discovery flow. `skills drift` resolved as not applicable with evidence: it requires `.agents/skills-manifest.toml` with pinned `commit`/`content_sha256` for **manifest-managed shared** skills, and all 42 skills are first-party canonical in `.agents/skills/`, so pinning them would add re-pin churn with no consumer — adopt the check when a shared/vendored skill is added                                                                                                                                                                                                               |
| 2     | SessionStart context injection (docs index + changelog, `llms.txt`-based)                                                                          | **DONE (2026-10-20)**                         | `scripts/hooks/claude-session-start.sh` injects a bounded slice of `llms.txt` and the top `CHANGELOG.md` section as `SessionStart` `additionalContext`, registered in `.claude/settings.json`. The byte budgets keep the payload below Claude Code's 10,000-character replacement threshold; `scripts/tests/claude-session-start.bats` covers the truncation and framing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2     | Duplicate-PR pre-flight guard (scheduled detection workflow)                                                                                       | **DONE (2026-10-20)**                         | `.github/workflows/duplicate-pr-guard.yml` + `scripts/check-duplicate-prs.mjs` detect exact-normalized-title duplicates on the same base branch. The workflow is read-only by construction (`permissions: {}` at the top, `contents: read` + `pull-requests: read` on the job), and the detector proves it is not vacuous through a hermetic `--self-test` plus a committed fixture that must exit 1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2     | `version-propagation.sh` replacing sed recipes in the release skill                                                                                | **DONE (2026-10-18)**                         | Implemented `scripts/release/version-propagation.sh`, bats test in `scripts/tests/version-propagation.bats`, `create-release-tag.sh` hint, and `release-management` skill Step 2                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2     | User-facing release verification recipe (checksums + `gh attestation verify`)                                                                      | **DONE (2026-10-17)**                         | `.github/RELEASE_NOTES_TEMPLATE.md` is published as the release body via `body_path` and carries the recipe (`gh release download` → `sha256sum -c SHA256SUMS --ignore-missing` → `gh attestation verify … --repo`); `release.yml` now generates and publishes `SHA256SUMS` over the zip + SBOM, and the `release-management` skill Step 7 runs the same recipe after cutting a tag. Locally verified: `sha256sum -c --ignore-missing` exits 0 on an intact artifact and 1 on a tampered one; `gh attestation verify` (SLSA provenance v1, matching `attest-build-provenance`) exists with `--repo` identity. End-to-end attestation verification can only run against the next published tag — `v0.1.0` carries no assets — and the keyless cosign `.sig` certificates are not published, which the template states                                                                                                                                                                                                                                                                                     |
| 2     | Release skill troubleshooting additions (tag-commit workflow semantics; partial-rerun/idempotency)                                                 | **DONE (2026-10-17)**                         | `release-management` Troubleshooting now covers: a tag run executes `release.yml` from the tagged commit (fix = delete the GitHub Release, re-point the tag to a corrected `main` commit with green CI, re-push; `concurrency: cancel-in-progress: false` queues it), re-run semantics (`gh run rerun <run-id> --failed` keeps tag/SHA, the `release` job rebuilds/re-signs/re-attests without prior-attempt artifacts, `softprops/action-gh-release` updates the existing release with `overwrite_files: true`, 30 days / 50 reruns), and the `GITHUB_TOKEN` no-trigger rule on the existing tag row. Claims verified against `release.yml`, the GitHub rerun docs and the pinned action README                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2     | Agent-level `EVALS.md` / `do-harness eval --agent-cmd` Skill Lift                                                                                  | **NOT ADOPTED (2026-10-21; schema conflict)** | The repo already carries per-skill `evals/evals.json` files and a `skill-evaluator` skill, so the Skill Lift half of the item is present. `do-harness eval` itself cannot validate them here: it rejects the `category` and `version` frontmatter keys that `scripts/validate-skill-format.sh` **requires** on every skill (checks 4 and 6). The two contracts are incompatible - the harness's allowed set is `allowed-tools, description, license, metadata, name`. Dropping the repo's keys would break this repo's own gate, and the harness's set is not ours to change, so the item is recorded as not adopted rather than forced.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2     | `self-fix-loop` closed loop rebuilt on `atomic-commit/verify.sh` with explicit staging                                                             | **DONE (2026-10-20)**                         | `scripts/AGENTS.md` § "CI self-fix loop" documents the three-state contract of `verify.sh` (0 passed / 1 failed / 2 inconclusive), the inspect → fix → verify → stage-by-path → re-run sequence, and the never-`git add -A` staging rule. `AGENTS.md` Tier 2 #3 and the `harness` skill point at it. The loop stays human/agent-driven: no autonomous fixer script was added.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2     | `do-harness dora` (report-only `warn` + FINDINGS ratchet); `compliance` output as compliance doc                                                   | **DONE (2026-10-20)**                         | `plans/dora.json` holds the policy; `scripts/report-dora.sh` wraps `do-harness dora` and always exits 0 (a metrics breach is a trend signal, never a merge condition), with `DORA_REQUIRED=1` as the opt-in promotion. `scripts/generate-compliance-doc.sh` captures `do-harness compliance` into `docs/compliance-mapping.md` and its `--check` mode fails on drift; the generator pads the harness's short table rows so the committed document passes markdownlint.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2     | `llms.txt` generator + drift check; `act` local rehearsal; Stop-hook back-pressure                                                                 | **PARTIAL (2026-10-20)**                      | The **drift check** is delivered: `scripts/check-llms-drift.sh` verifies that every repository path and every `pnpm`/script command named in `llms.txt` and `llms-full.txt` still exists, and that the SessionStart hook's inputs are present. It is a gate phase (`llms-drift`) and a do-harness sensor, with 10 BATS cases including a proven-drift fixture. `llms.txt`/`llms-full.txt` stay hand-written - regenerating them mechanically would lose their prose, so the generator is the drift check, not a rewriter. **`act` rehearsal DONE 2026-10-21**: `act` v0.2.89 (installed from the upstream release binary; no root needed) lists every workflow in the repository, and a `--dryrun` of the new `duplicate-pr-guard` workflow validated all of its steps - the vacuity self-test, the fixture proof, the paginated collection, the scan and the report. The `cloudflare-readonly-inventory` job is gated on `refs/heads/main`, so it is skipped locally by design. **Still open:** Stop-hook back-pressure (the repo has no Stop hook; `agents-docs/HOOKS.md` documents the pattern only). |

The "Skipped (deliberately)" section and every optional/discovery item above
remain **proposals, not adopted policy**; nothing in this reconciliation
changes them.

## Phase 1 — P1: highest leverage

- **CI-enforced do-harness completion contract** (template CI lesson +
  do-harness `verify.yml` pattern): pinned binary install →
  `verify --set verification --format json --evidence … --strict` →
  assert `status --set verification` green → evidence integrity assertion
  (`git_sha`, `signal_set`) → upload artifact. Today CI never runs
  do-harness, so AGENTS.md's completion contract is advisory only.
  Decision: whether `.github/ci-status/` state artifact (template) is also
  wanted — requires freshness check + cleanup workflows; ADR.
- **Add `[signal-sets] release`** to `do-harness.toml`; run
  `verify --set release --strict` in `create-release-tag.sh` preflight
  (and install every tool the set invokes — do-harness releasing lesson).
- **Add `--record` to documented verify commands** (or drop the Fail-Fast
  claim): strikes/beats only persist with `--record`, so the 3-strike halt
  currently never triggers.
- **Warn-severity sensors for gate-only shell validators** with
  `when-changed` globs: `agent-sync`, `workflows` (validate-workflows.sh),
  `shell` (shellcheck), `markdownlint`, `bundle` — extends ADR-246's
  same-command principle beyond pnpm scripts.
- **Rationalizations + Red Flags sections in all 42 SKILL.md files** +
  enforce in `validate-skill-format.sh` (currently 2/42; template requires
  both). Ship `.agents/skills/SKILL_TEMPLATE.md`.
- **Release-notes shape enforcement**: port the compose/check pattern
  (required sections incl. explicit `None.` breaking-changes, surviving
  placeholders, dropped-PR detection, `--self-test` sensor). Group by
  conventional-commit type, not labels.
- **`untrusted-ingest` sink lint** for PR-text consumers
  (`pr-review-fix`, `pr-roast-batch-close`, `github-pr-autopilot`,
  `smart-update-pr.sh`, `bot-repush-guard.yml`): hermetic proof of no
  dynamic-execution sinks (`eval`, `sh -c`, `exec`, shell-enabled `spawn`).

## Phase 2 — P2: backlog (each needs own PR, no ADR unless decision-shaped)

- Light/Full process modes in AGENTS.md; move Skills Reference table to
  `agents-docs/AVAILABLE_SKILLS.md` pointer (frees AGENTS.md budget) —
  **DONE 2026-10-20**.
- `do-harness loc` cap enforcement (if not done in P0), `overlap` advisory
  sensor, `skills suggest` discovery flow, `skills drift` manifest
  generalization beyond `skills-lock.json`.
- SessionStart context injection (docs index + changelog), based on
  `llms.txt` (template `hooks/session-start.sh` pattern) — **DONE
  2026-10-20** (`scripts/hooks/claude-session-start.sh`).
- Duplicate-PR pre-flight guard (scheduled detection workflow) — **DONE
  2026-10-20** (`.github/workflows/duplicate-pr-guard.yml` +
  `scripts/check-duplicate-prs.mjs`; read-only, exact normalized-title +
  same-base rule, see the reconciliation table above).
- `version-propagation.sh` replacing sed recipes in release skill.
- User-facing release verification recipe (checksums + `gh attestation
verify`) in release notes template.
- Release skill troubleshooting additions: tag runs execute the workflow
  file from the tagged commit (delete release + re-point tag to fix);
  partial-rerun/idempotency semantics.
- Agent-level `EVALS.md` (or `do-harness eval --agent-cmd` Skill Lift).
- `self-fix-loop` closed loop — **rebuilt on `atomic-commit/verify.sh` with
  explicit staging; never adopt template's `git add -A`** (collides with
  staged-only discipline / uncommitted WIP). **DONE 2026-10-20**
  (`scripts/AGENTS.md` § "CI self-fix loop").
- `do-harness dora` (report-only `warn` + FINDINGS ratchet) instead of
  template's metrics script stack; `compliance` output as compliance doc —
  **DONE 2026-10-20** (`plans/dora.json`, `scripts/report-dora.sh`,
  `scripts/generate-compliance-doc.sh` -> `docs/compliance-mapping.md`).
- `llms.txt` generator + drift check; `act` local rehearsal; Stop-hook
  back-pressure (silent success / exit 2 failure) per `agents-docs/HOOKS.md` —
  **drift check DONE 2026-10-20** (`scripts/check-llms-drift.sh`); **`act`
  rehearsal DONE 2026-10-21** (`act` v0.2.89 lists every workflow and a
  `--dryrun` of `duplicate-pr-guard` validated all of its steps); the Stop
  hook remains open.
- Agent-level `EVALS.md` (or `do-harness eval --agent-cmd` Skill Lift) —
  **NOT ADOPTED 2026-10-21**: the repo already carries per-skill
  `evals/evals.json` files and a `skill-evaluator` skill, but `do-harness
eval` rejects the `category`/`version` frontmatter keys that
  `scripts/validate-skill-format.sh` requires on every skill. The two
  contracts are incompatible; neither is ours to change unilaterally.

## Skipped (deliberately)

Template skill packs / ADOPTION_PROFILES (product repo, not template),
template metrics+DORA scripts (superseded by `do-harness dora`),
`secretlint` (gitleaks + staged scan cover it), template wasm/LOC shell
gates (native do-harness equivalents), label-triggered patch/hotfix
releases (blocked on P0 #2 truthfulness).

## Quality gates

- Every Phase 0/1 change: `./scripts/quality_gate.sh` + full CI green +
  Codacy clean before merge; learnings captured per Tier 2 #12.
- do-harness contract job must stay green independently of app CI jobs
  (separate failure surface).

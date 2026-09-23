# GOAP-276: Benchmark adoption — github-template-ai-agents + do-harness

**Status:** PROPOSED
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
   `v*`; no release-drafter *workflow* exists (only
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

Each fix: feature branch + PR per Tier 1; ADR only where a decision is
required (drafter adoption, coverage source of truth).

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
  `agents-docs/AVAILABLE_SKILLS.md` pointer (frees AGENTS.md budget).
- `do-harness loc` cap enforcement (if not done in P0), `overlap` advisory
  sensor, `skills suggest` discovery flow, `skills drift` manifest
  generalization beyond `skills-lock.json`.
- SessionStart context injection (docs index + changelog), based on
  `llms.txt` (template `hooks/session-start.sh` pattern).
- Duplicate-PR pre-flight guard (scheduled detection workflow).
- `version-propagation.sh` replacing sed recipes in release skill.
- User-facing release verification recipe (checksums + `gh attestation
  verify`) in release notes template.
- Release skill troubleshooting additions: tag runs execute the workflow
  file from the tagged commit (delete release + re-point tag to fix);
  partial-rerun/idempotency semantics.
- Agent-level `EVALS.md` (or `do-harness eval --agent-cmd` Skill Lift).
- `self-fix-loop` closed loop — **rebuilt on `atomic-commit/verify.sh` with
  explicit staging; never adopt template's `git add -A`** (collides with
  staged-only discipline / uncommitted WIP).
- `do-harness dora` (report-only `warn` + FINDINGS ratchet) instead of
  template's metrics script stack; `compliance` output as compliance doc.
- `llms.txt` generator + drift check; `act` local rehearsal; Stop-hook
  back-pressure (silent success / exit 2 failure) per `agents-docs/HOOKS.md`.

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

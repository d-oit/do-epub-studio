---
name: harness
description: >
  Map the harness-engineering feedforward guides and feedback sensors, and run
  the self-correction protocol when a computational sensor fires. Use when a
  sensor fails (cargo check, test, clippy, fmt), before making code changes, or
  when setting up agent context for a new task. Triggers: "harness", "sensor
  fire", "CI failure", "self-correction", "swarm".
category: workflow
allowed-tools: Read Write Edit Glob Grep Bash
license: MIT
metadata:
  version: "0.1.0"
  tags: harness sensors feedback feedforward self-correction quality
---
## Guides
See references/heuristics.md for distilled heuristics.

# Harness Skill

## What Is the Harness

Agent = Model + Harness. The harness is the system of feedforward guides (what to do before coding) and feedback sensors (what catches violations after coding).

- **Feedforward (guides):** context, constraints, conventions that prevent errors before they happen.
- **Feedback (sensors):** automated checks that fire after code changes, providing structured error output.

Two modes:
- **Computational:** deterministic checks (fmt, clippy, test) — always trust the output.
- **Inferential:** LLM-based guidance (skill docs, agent context) — direction, not commands.

## Feedforward Guides

| Guide | Path | Purpose |
|-------|------|---------|
| Agent contract | `AGENTS.md` | Operating invariants and quality gates |
| GOAP methodology | `.agents/skills/goap-agent` | Analyze → decompose → strategize → execute |
| Task decomposition | `.agents/skills/task-decomposition` | Break work into atomic, executable goals |
| Skill authoring | `.agents/skills/skill-creator` | Creating and pruning skills (anti-AI-slop) |
| Harness heuristics | `references/heuristics.md` | Heuristics distilled from resolved traces |
| Sensor pack | `do-harness.toml` | Single source of truth: sensors + signal sets |

## Feedback Sensors

`do-harness.toml` defines this repo's sensors and signal sets — ADR-246
requires every sensor to wrap the same command the quality gate and CI
run. Query the pack instead of copying a list here; a copied list drifts:

- `do-harness list` — sensor names
- `do-harness explain --set verification` — sensors this change selects,
  without running them
- `do-harness verify --set <set> [--changed] [--strict]` — run them;
  `--record` persists strikes/beats, `--evidence <file>` writes the
  evidence artifact that `status` reads back
- `do-harness status --set <set> [--evidence <file>]` — evidence
  freshness without re-running

Git hooks are the repo's own `scripts/hooks/*`: `do-harness hook install`
stays forbidden (ADR-246), and the quality gate plus CI remain the
merge-blocking source of truth.

## Self-Correction Protocol

When a computational sensor fires:
1. Read the full error message — it includes a fix hint.
2. Classify the error: lint / typecheck / test / build / schema.
3. Apply the minimal fix — do not refactor unrelated code.
4. Re-run the specific sensor.
5. Only proceed when the sensor is green.
6. If the fix was non-obvious, capture it with the `learn` skill in
   `agents-docs/LEARNINGS.md`.

## Fail-Fast Policy

If the same subtask fails a sensor 3 consecutive times: halt and surface a
diagnostic to the developer. Strikes and beats only persist when verify
runs with `--record`, so an unrecorded run leaves nothing to halt on.
Signatures live in `.do-harness/agent_state.db`: inspect them with
`do-harness errors list`, clear one with
`do-harness errors clear sensor:<name>`.

## Steering Loop

When any sensor fires repeatedly (>2 times in one sprint):
1. Identify the root cause category (maintainability / architecture / behaviour).
2. Update the corresponding feedforward guide to prevent recurrence.
3. If no guide exists, create one in `.agents/skills/` with the
   `skill-creator` skill, or distill it from a resolved fix via
   `do-harness distill --from-trace <ID>` — a resolved trace is the
   required evidence (there is no `--from-strikes` flag).
4. The loop closes: sensors fire -> guides update -> sensors fire less.

## Swarm Handoff Protocol

Handoffs between parallel swarm agents are accepted only on computational evidence: the receiving agent verifies the expected artifacts exist (files, directories, DB rows), and the handing-off agent reports exact verification outputs (commands run, exit codes).

- An empty agent result means the work was not done — treat it as a failed handoff, not a success.
- On failed handoff: take over the work directly, record the pattern in this skill, and capture it with the `learn` skill.
- Parallel swarm agents must own non-overlapping file sets to avoid edit conflicts.
- Distill the failure pattern back into this skill so the sensor (empty-result handoff) fires less in the future.

## New-Repo Adoption (Dogfood Rule)

Using the harness in another codebase is proven, never assumed:

- `do-harness init` (rust pack) scaffolds a minimal cargo crate when no
  `Cargo.toml` exists, so `init && verify` exits 0 on a truly empty tree;
  existing crates are never touched, not even with `--force`.
- The generic pack ships zero sensors: its `verify` pass is vacuous until
  real `[[sensors]]` are configured — do not report it as evidence.
- The green/red paths are dogfooded by `crates/do-harness/tests/dogfood.rs`
  and CI (`init && verify` on a fresh temp workspace every push); re-prove
  with `do-harness verify --format json` in the consumer repo.

## Gotchas
- Never trust LLM self-assessment over a computational sensor's exit code.
- Fix the sensor that fired; do not refactor unrelated code in the same pass.
- An empty sensor suite passes vacuously; that is not evidence.
- **Deploy-platform limits are not bundler limits**: vite will happily emit a 25.6 MiB wasm that Cloudflare Pages rejects at upload (>25 MiB/file) *after* every local gate is green — SW `globIgnores` excludes the precache, never the upload. The sensor is `check-bundle-budget.mjs`'s all-files platform-cap walk (quality gate + bundle-size CI); fix at emit time (vite `generateBundle` drop), never by weakening the sensor.

# ADR-246: do-harness as the agent-loop completion contract + upstream web-ui sensor pack

**Status:** Accepted (2026-09-13)
**Date:** 2026-09-13
**Related:** GOAP-269, `quality_gate.sh`, `scripts/atomic-commit/`

## Context

Two failure classes from PR #1114 surfaced only after push (the `.claude/skills`
mirror symlink checked solely by the CI Full Quality Gate, and Codacy gating
Info-level markdownlint) despite a green local minimal gate. The agent loop here
re-runs full gates blindly (`quality_gate.sh`), has no notion of evidence
freshness, and has no computational answer to "is my previous green still
valid for the current tree?". `d-o-hub/do-harness` (Rust CLI, analyzed
hands-on 2026-09-13) provides exactly this layer: change-aware sensors
(`when-changed` + `verify --changed`), signal sets (`feedback`/`verification`/
`release`), fingerprinted evidence with `status green|red|stale|missing`, and
an honest vacuous-pass detector. It ships a `rust` language pack and a
deliberately vacuous `generic` pack; it has **no** web/UI capability.

## Decision

1. **Adopt do-harness (generic pack) as the agent-loop verification layer.**
   Sensors MUST wrap the same underlying scripts that `quality_gate.sh` runs
   so local evidence and CI cannot drift; do-harness owns the agent loop and
   evidence freshness, `scripts/atomic-commit/` remains the push/PR/CI
   orchestrator, and the CI Full Quality Gate remains the merge-blocking
   source of truth.
2. **Sensor sets mirror gate stages:** `feedback` = fast loop set (typecheck,
   lint); `verification` = full pre-completion set (tests, budgets, skill
   validation, shell lint, commitlint); `release` = verification + deploy
   checks. Every sensor declares accurate `when-changed` globs.
3. **Upstream a `web-ui` sensor pack** (proposed `init --language web`) with
   sensors: `e2e` (Playwright, sharded), `viewport-ux` (text-visibility /
   occlusion via `elementsFromPoint` sampling / text-overlap / overflow-reflow
   per route × viewport × locale × scheme), `a11y` (axe-core, WCAG 2.2 AA),
   `visual` (screenshot diffs with dynamics masked), `console` (zero errors /
   failed requests), `perf` (Lighthouse mobile budgets + CWV), `i18n`
   (pseudo-loc, expansion overflow, RTL, tofu). Viewport matrices are encoded
   in the evidence artifact so "green" means full-matrix coverage and matrix
   changes make evidence stale; ratchet baselines (findings may only
   decrease) gate noisy new checks; strike counts quarantine visual flake.
4. **Viewport matrix baseline:** extend this repo's existing 9-entry
   `apps/tests/viewport-matrix.ts` with 360×800 (Android majority), 412×915
   (Pixel), 820×1180 (iPad Air), 1280×720 (minimum desktop); treat 320 as the
   WCAG 1.4.10 reflow floor and add zoom/reflow equivalence (200% text,
   400% page) plus dark-scheme and reduced-motion variants.

## Consequences

- Adoption adds `do-harness.toml`, git hooks, and gitignored
  `.do-harness/` evidence; the generated completion contract is additive to
  (never a replacement of) the repo AGENTS.md.
- Agents gain a cheap pre-push gate that catches skill-mirror and markdown
  classes of failures locally instead of after CI rollbacks.
- Upstream improvements flow back via d-o-hub/do-harness (POSIX installer fix
  and template newline landed in GOAP-269 Phase 2).

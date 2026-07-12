# ADR-129: CI Release Readiness and Failure Triage Policy

**Date:** 2026-07-12
**Status:** Accepted (Plan 129)
**Deciders:** Engineering
**Context plan:** `plans/129-goap-ci-failure-release-prep.md`
**Supersedes (in part):** ADR-087 (CI Failure Resolution Policy — adds release-readiness gate)
**Numbering:** per ADR-083; add to `plans/ADR-INDEX.md` Accepted table on merge

---

## Context

Issue #771 exposed a gap: scheduled cross-browser E2E tests can accumulate
failures on `main` without blocking the merge pipeline (since scheduled runs
are decoupled from PR checks). Three root causes — a sync queue race, mobile
viewport visibility, and a Workbox service worker crash — went undetected
through multiple PR merges. This ADR defines when `main` is release-ready
and how CI failures are triaged.

---

## Decision

### 1. Release Readiness Gate

A release MUST NOT be cut unless ALL of the following are green on `main`:

- [ ] PR merge checks (lint, typecheck, unit tests, build, E2E smoke)
- [ ] Scheduled cross-browser E2E (latest run, all browsers)
- [ ] Codacy Static Code Analysis
- [ ] Lighthouse mobile preset (all budgeted routes)
- [ ] Bundle size budgets
- [ ] Coverage thresholds (per AGENTS.md Tier 2)

If any scheduled E2E run shows failures, the release is blocked until
the failures are triaged and fixed.

### 2. CI Failure Triage Categories

Extends ADR-087 with a fourth category:

| Category | Definition | Action |
|----------|-----------|--------|
| **Current `main`** | Reproducible on latest `origin/main` | Fix before release |
| **Stale PR** | From a merge commit that no longer applies | Document; do not fix unless reproducible |
| **Workflow hygiene** | Lockfile drift, stale imports, missing setup | Prevent by policy |
| **Scheduled-only** | Fails in scheduled runs but passes in PR checks | **New:** Treat as Current `main` — scheduled runs exercise production builds and cross-browser matrices that PR checks do not |

### 3. Scheduled E2E Failure Escalation

When a scheduled E2E run fails:

1. **Within 24h:** Create a GitHub Issue with the run ID, failing test names,
   and root-cause hypothesis.
2. **Within 72h:** Triage into one of the 4 categories above.
3. **Before next release:** All "Current `main`" and "Scheduled-only" failures
   MUST be resolved.

### 4. Sync Queue Test Stability

Tests that exercise offline → online transitions MUST:

- Await a `syncComplete` signal or equivalent before asserting UI state
- Use `waitFor` with a reasonable timeout (≥5s for CI) rather than fixed delays
- Mock the sync queue flush when testing UI behavior in isolation

### 5. Service Worker Test Stability

Tests that exercise service worker lifecycle MUST:

- Guard against `self.registration` being `undefined` (SW not yet active)
- Use Playwright's `page.evaluate` to wait for SW `activated` state before
  testing offline behavior
- Not assume synchronous SW installation

---

## Consequences

**Positive**

- Releases are blocked by objective CI criteria, not subjective judgment
- Scheduled E2E failures get the same urgency as PR check failures
- Sync and SW test patterns are documented, reducing future flakiness
- Clear escalation path (24h triage, 72h classification, pre-release fix)

**Negative / Cost**

- Releases may be delayed by scheduled-only failures that are hard to reproduce
- Requires discipline to triage within 24h (may slip during weekends)

---

## Compliance

- This ADR is referenced from AGENTS.md Tier 2 ("Releases MUST be cut via
  the `release-management` skill") and extends the release gate.
- ADR-087 remains the authority for triage categories; this ADR adds the
  scheduled-only category and the release-readiness gate.
- Future CI failure issues MUST reference this ADR in their triage comment.

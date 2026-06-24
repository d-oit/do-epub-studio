# ADR-110: Backlog Consolidation & Verified-Before-Execution Policy

**Date:** 2026-06-24
**Status:** Proposed
**Deciders:** Project maintainer
**Related:** ADR-052 (Gap Closure Policy), ADR-077 (Phased Feature Delivery), ADR-083 (ADR Numbering), ADR-105 (UI Platform Modernization), ADR-106 (Feature Completeness), ADR-092 (Feature-Gap Policy)

## Context

As of 2026-06-24 the `plans/` directory contains four substantial, still-OPEN
analysis plans authored within a single day (105 comprehensive audit, 105-ui
platform modernization, 106 feature completeness, 107 quality/DX). They:

- **Overlap heavily** — annotation export, catalog pagination, UI primitives
  (Pagination/ConfirmDialog/SearchInput), and container queries each appear in
  two or more plans, so the same work is described and prioritized differently
  in different files.
- **Drift from reality** — none was updated when work shipped. Verification on
  2026-06-24 found plan 105 finding A5 (reading-insights UI) already
  implemented (`InfoPanel.tsx` now renders `computeInsightSummary`), yet the
  plan still lists it as a gap.
- **Track no execution** — they are pure analysis with no single owner of "what
  is actually left."

Continuing to add a new raw-analysis plan per session multiplies stale,
conflicting backlogs and makes it impossible to know the true remaining scope.

## Decision

1. **One execution roadmap at a time.** When multiple OPEN analysis plans
   cover the same domain, a single consolidated GOAP plan (here, plan 110)
   becomes the authoritative execution tracker. The source analysis plans are
   retained as the detailed evidence record but are no longer separately
   prioritized.

2. **Verify before re-listing.** Any finding carried into an execution roadmap
   MUST be re-confirmed against live source at a cited `file:line` (or an
   explicit absence search) on the roadmap's date. Findings that can no longer
   be reproduced are marked DONE, with the implementing commit/file cited, and
   removed from the active backlog.

3. **De-duplicate by ID.** Overlapping findings across plans are merged into a
   single verified ID with one severity and one owning skill. The roadmap
   records which source-plan findings each consolidated ID subsumes.

4. **TIER-1 items jump the queue.** Any AGENTS.md TIER-1 violation surfaced
   during consolidation (e.g. grant-change session revocation) is escalated to
   Phase 1 regardless of its severity label in the source plan.

5. **Independent shippability is preserved.** Consolidation changes ordering
   and de-duplicates; it does not bundle unrelated changes into mega-PRs. Each
   task still ships as its own feature branch + PR gated by
   `./scripts/quality_gate.sh` and the Codacy required check.

6. **Status hygiene.** When a consolidated roadmap supersedes the prioritization
   of source plans, those plans get a one-line status note pointing to the
   consolidated plan; the consolidated plan cites them under "Consolidates".

## Consequences

### Positive

- A single, trustworthy answer to "what is actually left to build."
- No wasted effort re-implementing already-shipped work (A5 caught here).
- Severity and ownership become consistent across the backlog.
- TIER-1 security gaps are guaranteed front-of-queue.

### Negative / costs

- Re-verification adds up-front analysis time per consolidation pass.
- Contributors must consult the consolidated plan, not the older source plans,
  for current priority — mitigated by the cross-reference notes.

## Compliance

- AGENTS.md TIER-2 rule 8 (GOAP plan + ADR for issues; no direct KNOWN-ISSUES edits).
- ADR-083 numbering — `110` is the next free ADR number after `109`.
- Does not weaken any existing security, accessibility, or coverage policy;
  it only governs how backlogs are recorded and sequenced.

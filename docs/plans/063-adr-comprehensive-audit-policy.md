# ADR-063: Comprehensive Audit Policy

**Status:** Proposed
**Date:** 2026-05-30
**Companion to:** `docs/plans/063-goap-comprehensive-audit-2026-05-30.md`
**Related:** ADR-052 (Gap Closure Policy), ADR-039 (Issue & PR Triage Policy), AGENTS.md Tier 2 rule 8

---

## Context

The project has matured through multiple gap-closure sweeps (Plans 033, 052) and
targeted fixes, but no standing policy governs *when* and *how* comprehensive
audits should be repeated. Per AGENTS.md Tier 2 rule 8 ("Document ALL issues as
GOAP plans + ADRs"), the audit process itself needs governance to prevent:

- Drift accumulation between audit cycles.
- Inconsistent audit scope (different categories checked each time).
- Audits treated as one-off exercises rather than recurring hygiene.
- Findings lost because they aren't tracked in the GOAP/ADR framework.

Plan 063 performed a full 10-category swarm analysis on 2026-05-30, producing 65
actionable gaps. This ADR defines the policy so future audits are systematic,
repeatable, and integrated into the planning rhythm.

---

## Decision

### 1. Audit cadence

Comprehensive audits run on a **bi-weekly cadence** (every 2 weeks), aligned
with sprint boundaries. The first audit post-063 is scheduled for 2026-06-13.

In addition, a **triggered audit** runs whenever:

- A major feature branch merges (judgment call — new surface area, new data flow,
  or ≥ 2 new files in a package).
- A new package or dependency category is introduced.
- An incident or near-miss reveals a gap that may have siblings.

### 2. Audit scope (10 categories)

Every comprehensive audit MUST cover all 10 dimensions:

| # | Category | Coverage |
|---|----------|----------|
| A | Missing Implementation & Features | Code vs. docs/ADRs — what's referenced but not built |
| B | Missing Documentation | Docs vs. code — what's referenced but doesn't exist |
| C | Missing UI Components & Patterns | Component library vs. app usage — what's built but not wired |
| D | Missing Tests | Source vs. test files — what's excluded from coverage |
| E | Missing Logging & Observability | Console calls, traceId coverage, structured logging gaps |
| F | Missing Error Handling | Empty catches, missing retry, missing user recovery |
| G | Missing Navigation Patterns | WCAG nav requirements, deep linking, history state |
| H | Missing Contrast & Accessibility | Color contrast, ARIA, focus management, reduced motion |
| I | Missing Performance & Bundle Monitoring | CI-enforced budgets, RUM, image optimization |
| J | Missing Internationalization | Locale coverage, formatting, RTL support |

### 3. Methodology

Every comprehensive audit follows the swarm pattern established in Plan 063:
skill-loading → parallel agent swarm → deep-dive → GOAP plan synthesis. See
Plan 063 §2–§5 for the operational playbook. This ADR governs the *policy* (when
and what), not the mechanics (how).

### 4. Priority system

All findings are assigned one of four priority levels:

| Priority | Definition | Examples |
|----------|------------|----------|
| **P0** | Security risk, data loss, WCAG Level A violation, or production crash | Empty catch swallowing session errors, no 404 route, missing skip-to-content |
| **P1** | Degraded UX, missing documented feature, test gap on critical path, high-value quick win | Toast not wired, safe-regex untested, docs referenced but missing |
| **P2** | Polish, enhancement, moderate scope with clear value | Content skeletons, chapter progress indicator, property-based test expansion |
| **P3** | Future-phase or speculative — deferred to a future plan | AI-assisted workflows, features from roadmap not yet in scope |

### 5. Wave-based execution

Findings are organized into waves with explicit gates:

- **Wave 1**: All P0 items. Blocking — must complete before Wave 2 starts.
- **Wave 2**: High P1 items. 80% completion threshold before Wave 3 starts.
- **Wave 3**: P2 items. No gate — opportunistic within sprint capacity.
- **Wave 4**: P3 items. Deferred to a future plan.

Waves are recorded in the audit GOAP plan with task-level granularity and agent
skill assignments.

### 6. Tracking and closure

- Each audit produces exactly one GOAP plan (this is the "audit plan").
- The audit plan is the single source of truth for all findings from that cycle.
  Do NOT spread findings across multiple plans or track them in
  `KNOWN-ISSUES.md`.
- When a wave completes, update the plan status and mark individual items ✅.
- When all waves complete (or are explicitly deferred), mark the plan status
  ✅ Resolved and leave it in `docs/plans/` for reference. Do not archive until the
  next audit plan supersedes it.
- **Acceptance**: An audit cycle is complete when ≥ 85% of P0+P1 items are
  resolved or explicitly deferred with rationale.
  This threshold is intentionally higher than ADR-039's ≥ 80% cluster-level
  acceptance for triage cycles: audit gaps accumulate silently and have no
  external reporter pushing for closure, so a stricter bar prevents drift.
- **Roll-forward**: Unresolved P2/P3 items from audit cycle N are automatically
  re-scanned in audit cycle N+1 (the swarm will re-discover them). Resolved or
  deferred items carry their rationale forward via the prior plan's notes.
- **Accountability**: The agent spawning the audit is responsible for shepherding
  the resulting GOAP plan through wave completion.

### 7. Integration with release cycle

- Audit findings that impact release metadata (version, changelog, security
  posture) must be flagged in the audit plan.
- The `release-management` skill is the sole executor for release cuts triggered
  by audit findings.
- If an audit reveals a security vulnerability, follow the disclosure process in
  `SECURITY.md` — do not include vulnerability details in the public audit plan.

### 8. Companion ADR requirement

If an audit finding requires new policy to prevent recurrence (e.g., regex
hardening → ADR-034, CSP implementation → ADR-035), create a companion ADR.
The ADR:

- Must be numbered to match the audit plan (e.g., `063-adr-*.md`).
- Must be cross-referenced from the audit plan.
- Follows the established format: Status, Date, Context, Decision, Consequences.

---

## Consequences

### Positive

- Audits are predictable and systematic — no more ad-hoc "gap analysis" sweeps.
- The 10-category scope prevents blind spots (e.g., i18n was missing from
  earlier gap analyses).
- Wave-based execution with explicit gates prevents partial fixes and drift.
- Companion ADRs ensure policy keeps pace with findings.
- Bi-weekly cadence keeps the gap count manageable (Plan 063 found 65 gaps
  accumulated since Plan 052).
- Cadence may be adjusted via a future ADR if two consecutive audits find
  < 15 new gaps (indicating the codebase has stabilized and the cadence can
  be relaxed to monthly).

### Negative

- Full 10-category swarm audits are credit-intensive (~8–12 parallel agent
  spawns).
- Bi-weekly cadence may be too frequent for small sprints; mitigated by the
  triggered-audit exception (no need to re-run if no significant changes).
- Audit plan documents grow the `docs/plans/` directory; archival policy may be
  needed past plan ~100.

### Risks

- Swarm analysis may produce false positives (e.g., flagging sentinel
  `'TODO'` values as real TODOs). Mitigated by the deep-dive phase in the
  audit methodology.
- Audit findings may overlap with active GOAP plans. Mitigated by
  cross-referencing prior plans in the audit plan notes section.
- Bi-weekly cadence may be too frequent and credit-intensive for low-change
  periods. Mitigated by the cadence adjustment mechanism (see Positive
  consequences).

---

## Validation

This policy is validated when:

1. Plan 063 waves execute per the wave definitions in this ADR.
2. The next audit (2026-06-13) follows this methodology and produces a plan with
   comparable scope and rigor.
3. Companion ADRs are created for any new policy required by audit findings.
4. No ad-hoc gap analysis sweeps occur outside this framework.

---

## References

- AGENTS.md Tier 2 rule 7 (GOAP methodology for analysis/planning)
- AGENTS.md Tier 2 rule 8 (document issues as GOAP plans + ADRs)
- ADR-052 (Product, CI, Release, and Documentation Drift Closure)
- ADR-039 (Issue & PR Triage Policy)
- ADR-034 (ReDoS Hardening — example of audit → policy ADR flow)
- Plan 063 (Comprehensive Codebase Audit 2026-05-30)

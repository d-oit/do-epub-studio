# ADR-120: Missing-Implementation Verification and Prioritization Policy

**Date:** 2026-07-07
**Status:** Accepted (Clusters 1–5 shipped, Clusters 6–12 remaining)
**Deciders:** Project maintainer
**Related:** ADR-092 (Feature-Gap Policy), ADR-106 (Feature Completeness), ADR-114 (Audit Remediation), ADR-115 (Verified-Audit Remediation)
**GOAP plan:** `plans/120-goap-missing-implementation-new-features-2026-07-07.md`

## Context

Plans 106, 114, 115, 116, and 117 produced a large backlog of missing-implementation
and feature-completeness items. Subsequent PRs (#675 and later) closed many of them.
However, repeated audits re-scheduled items that were already shipped, wasting agent
cycles and creating noise in the backlog.

A July 2026 re-verification against the current working tree found that:
- Plan 117's two "remaining gaps" (GrantList spinner, AuditLogPage/CommentInput i18n)
  are **already fixed** in the current tree.
- Several items from Plan 106 (catalog search, book editing, export notes, reading
  insights, UI primitives) are **all shipped**.
- New, previously-unidentified gaps exist that no prior plan covers.

## Decision

### 1. Verify-before-schedule (extends ADR-115)

Every missing-implementation finding MUST be verified against the current working
tree with a file/line pointer before it enters a GOAP plan. Stale findings from
prior plans are explicitly corrected with a "DONE" marker so the team does not
re-open already-closed work.

### 2. Prioritization matrix

| Priority | Definition | Examples |
|----------|-----------|----------|
| **P0** | Data loss, security breach, or TIER-1 violation | Orphaned R2 objects, un-revoked sessions |
| **P1** | Core user flow broken or missing | No cascade delete, no library view |
| **P2** | Significant UX or governance gap | No admin stats, no cache invalidation |
| **P3** | Enhancement, hardening, or test coverage | Server-side search, offline test gaps |

### 3. Cascade-delete requirement

Any "delete" or "archive" operation that removes a primary entity MUST cascade to
all dependent resources (storage objects, child rows, sessions, grants). Soft-delete
(archived_at) is acceptable for the primary row, but orphaned child resources are a
P1 data-integrity gap.

### 4. New-feature classification

A "new feature" (vs. "missing implementation") is a capability NOT referenced in
existing code, routes, or PRODUCT.md core flows. New features are P3 minimum and
require a PRODUCT.md or ADR reference before scheduling.

### 5. No re-scheduling of closed items

If a prior plan marked an item as DONE or a re-verification confirms it shipped,
no future plan may re-schedule it. Re-opening requires a regression bug report
with reproduction steps.

## Consequences

### Positive

- Eliminates duplicate work across audit cycles
- Clear separation between "broken" (missing impl) and "new" (feature request)
- Cascade-delete policy prevents silent data accumulation

### Negative

- Verification step adds time to each audit cycle
- New features are deprioritized by default, which may slow product evolution

## Compliance

- AGENTS.md TIER-2 #9 — gaps documented as GOAP plans + ADRs
- ADR-092 §5–8 — feature-gap definition, reporting, and closing
- ADR-115 — verify-before-schedule policy (this ADR extends it)

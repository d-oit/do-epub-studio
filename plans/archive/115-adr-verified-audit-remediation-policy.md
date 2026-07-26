# ADR-115 — Verified-Audit Remediation Policy

**Status:** Accepted (Plan 129)
**Date:** 2026-06-27
**Deciders:** Engineering
**Related plan:** `plans/115-goap-missing-impl-ui-modernization-2026-06-27.md`
**Supersedes (in part):** the OPEN-status rows in Plan 114 that are corrected by Plan 115
**Numbering:** per ADR-083; add to `plans/ADR-INDEX.md` Accepted table on merge

---

## Context

Successive audit plans (105, 110, 114) carried "OPEN" findings forward by
reference rather than re-checking the working tree. Plan 115 verified each
claim against current source and found several TIER-1/P1 items (grant session
revocation, offline bookmark/insight sync queue, annotation import + CFI export,
admin responsive fixes) were **already implemented**. Re-scheduling closed work
wastes cycles and erodes trust in the backlog.

Separately, the `impeccable` detector reports some **false positives** (the CSS
spinner `border-b-2` technique flagged as "accent border on rounded card").
Treating every detector hit as a defect would force pointless churn or
suppressions.

## Decision

1. **Verify before scheduling.** An audit finding may only enter a remediation
   backlog with a concrete evidence pointer (file + line) confirmed against the
   current working tree. Carrying a prior plan's status forward without
   re-verification is not permitted.

2. **Correct stale findings explicitly.** When a newer audit finds a prior
   plan's item already resolved, the newer plan records the correction in a
   "Corrections" table (ID, claim, verified reality + evidence). The stale
   plan is not silently edited.

3. **Classify detector output.** UI anti-pattern detector hits are triaged into
   **real** vs **false positive** with a one-line rationale each. False
   positives are resolved by the lowest-churn route (prefer migrating to an
   existing shared primitive, e.g. `<Spinner>`, over inline suppression).

4. **Severity honesty.** A finding is only TIER-1/P1 if it is currently
   reproducible. Items already shipped are recorded DONE, not P1-OPEN.

5. **Recommendations-only plans change no source.** An analysis plan documents
   recommendations; implementation happens in separate, individually-shippable
   feature-branch PRs with a test added per functional fix.

## Consequences

**Positive**

- Backlog reflects reality; no re-opening of closed work.
- Detector false positives don't generate noise or unjustified suppressions.
- Clear audit trail of who verified what, when.

**Negative / cost**

- Verification adds time to each audit (acceptable vs. the cost of redundant work).
- Requires discipline to cite file+line evidence for every finding.

## Compliance

- Plan 115 is the reference implementation of this policy (Corrections table +
  real/false-positive split + evidence links throughout).
- Future audit plans (116+) MUST follow the same structure.

# ADR-198: Verified-Closure Methodology for Stale GOAP Plans

**Date:** 2026-07-18
**Status:** Accepted
**Deciders:** Project maintainer
**Related:** ADR-187 (Fail-Closed Engineering Gates), Plan 198

## Context

The `plans/` directory accumulated 100+ GOAP plans over 3 months. Several plans
claimed "IN PROGRESS" or "ACTIVE" status long after their implementation was merged.
This created noise in the backlog and risked duplicate work.

Plan 197 began the stale-plan closure process; Plan 198 completes it for the
remaining plans (112, 112-V12, 122, 124) and codifies the methodology.

## Decision

A GOAP plan's status MUST be updated to COMPLETED when ALL of the following hold:

1. **Code evidence exists on `main`** — `git log --oneline --all --grep` or
   `grep -rn` in the working tree confirms every acceptance criterion is
   implemented and merged.
2. **CI evidence exists** — `gh pr checks` or `git log` confirms the merge
   commit passed all required checks.
3. **No residual gaps** — If a plan's "Remaining Gaps" section lists items
   that are NOT in the acceptance criteria, those items are documented as
   a separate follow-up plan (not left as implicit OPEN items).

Status transitions:

| From | To | Condition |
|------|----|-----------|
| IN PROGRESS / ACTIVE | COMPLETED | All acceptance criteria verified on `main` |
| IN PROGRESS / ACTIVE | CLOSED | Scope superseded by another plan (link it) |
| PROPOSED | ACCEPTED | Decision recorded with rationale |
| COMPLETED | SUPERSEDED | A newer plan replaces this one's scope |

## Consequences

- **Positive:** No plan can claim "IN PROGRESS" indefinitely. The backlog
  reflects reality.
- **Positive:** Residual gaps are explicitly tracked as new plans, not
  buried in stale plan comments.
- **Negative:** Requires a verification step before closing plans — adds
  ~5 minutes per plan.
- **Risk:** Over-eager closure could lose context. Mitigated by requiring
  evidence tables in every closure commit.

## Verification Checklist

For each plan being closed:

1. Read the plan's acceptance criteria
2. For each criterion, `grep -rn` or `git log --grep` to find evidence on `main`
3. Record evidence in a table (plan ID → criterion → file:line or commit SHA)
4. If any criterion is unmet, the plan stays OPEN and the gap gets a new plan
5. Update the plan's status line with `✅ COMPLETED` and add the evidence table

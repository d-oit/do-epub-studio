# ADR-024: Warning and Pre-existing Issue Management Policy

**Status:** Accepted
**Date:** 2026-05-15
**Driven by:** AGENTS.md Tier 2 compliance — document unfixable issues; GOAP methodology requires ADR-backed tracking

---

## Context

The codebase contains a set of known warnings and pre-existing issues that cannot be immediately fixed due to external dependencies, tool limitations, or architectural constraints. A systematic policy is needed to track, review, and retire these items.

AGENTS.md Tier 2 requires:

- "Document unfixable issues in `agents-docs/KNOWN-ISSUES.md`"
- "After any change, run diagnostics and document any new warnings in `plans/015-warnings-and-issues.md` or `agents-docs/KNOWN-ISSUES.md`"

However, GOAP methodology requires that planning and tracking be done via GOAP plans with ADR files, not via ad-hoc entries in known-issues files. This ADR resolves the conflict between the two systems.

---

## Decision

### Warning and Issue Classification

All warnings and pre-existing issues are classified into one of three tiers:

| Tier         | Definition                                                         | Storage                                | Review Cadence |
| ------------ | ------------------------------------------------------------------ | -------------------------------------- | -------------- |
| **Active**   | Currently impacting development, fix planned within next 2 sprints | `plans/` — GOAP sprint plan tasks      | Each sprint    |
| **Monitor**  | Known but not actively blocking; track for future sprints          | `agents-docs/KNOWN-ISSUES.md`          | Quarterly      |
| **Resolved** | Fixed or obsoleted                                                 | `agents-docs/KNOWN-ISSUES-RESOLVED.md` | Archived       |

### Policy Rules

1. **GOAP plans are the source of truth** for all issue tracking and resolution planning
2. **KNOWN-ISSUES.md is a reference only** — it mirrors but does not replace GOAP plans
3. **Every warning must have a corresponding GOAP task** if it has a fix path, or a KNOWN-ISSUES entry if unfixable
4. **ADRs document decisions** about which warnings are accepted, why, and for how long
5. **Quality gate must not fail on warnings** — warnings are informational; errors are blocking

### Fix Path Criteria

A warning receives a GOAP task if it satisfies ALL of:

- Has a known fix (not blocked by external dependency)
- Fix can be completed within 2 sprints
- Fix does not introduce architectural risk
- Fix does not reduce functionality

Otherwise it goes to Monitor (KNOWN-ISSUES.md).

---

## Current Classification

| Issue                                                  | Type    | Classification | Fix Path                                          | Sprint |
| ------------------------------------------------------ | ------- | -------------- | ------------------------------------------------- | ------ |
| ESLint `any` in `ui/index.tsx:224`                     | Warning | Active         | Replace `any` with `ComponentType<{...}>`         | #141   |
| ESLint `any` in `cors.test.ts:8`                       | Warning | Active         | Replace `any` with `Response` type                | #141   |
| Tailwind `max-w-[200px]` in `ReaderPage.tsx:766`       | Warning | Active         | Replace with `max-w-50`                           | #141   |
| Tailwind `min-w-[300px]` in `toast.tsx:84`             | Warning | Active         | Replace with `min-w-75`                           | #141   |
| React 18/Vitest concurrency — skipped tests            | Issue   | Monitor        | Requires upstream fix or test isolation           | Future |
| `reader-state.ts` at 482 LOC (near 500)                | Issue   | Monitor        | Refactor when limit exceeded                      | Future |
| `admin.ts` at 465 LOC (near 500)                       | Issue   | Monitor        | Refactor when limit exceeded                      | Future |
| `useReaderEpub.test.tsx` typecheck failures (9 errors) | Issue   | Active         | Fix mock rendition object (missing `next`/`prev`) | #141   |

---

## Consequences

### Positive

- Clear separation between actionable (GOAP-tracked) and accepted (KNOWN-ISSUES) items
- Sprint planning explicitly accounts for warning remediation
- ADR provides policy context for почему warnings are accepted
- KNOWN-ISSUES.md remains focused on truly unfixable items

### Negative / Risks

- Requires discipline to keep GOAP plans and KNOWN-ISSUES.md in sync
- Some warnings may linger if not prioritized in sprints
- Risk of KNOWN-ISSUES.md becoming stale if quarterly review is skipped

### Mitigations

- Sprint reviews include warning count as a quality metric
- Quarterly review is automated via calendar reminder
- Quality gate surfaces new warnings: must be classified within 1 sprint

---

## References

- AGENTS.md Tier 2 — Quality Gates
- Plan 025 — GOAP: Warning resolution and pre-existing issue tracking
- `agents-docs/KNOWN-ISSUES.md` — Monitor-tier reference
- `plans/015-warnings-and-issues.md` — Historical tracking
- `plans/020-goap-sprint-141.md` — Sprint remediation targets

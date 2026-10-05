# ADR-1000: Audit evidence and execution boundaries

**Status:** Accepted
**Date:** 2026-10-04
**Deciders:** Project maintainer
**Applies to:** `plans/1000-goap-implementation-security-e2e-feature-audit.md`
and its owned follow-ups GOAP-1001, GOAP-1002, GOAP-1003 and GOAP-1004
**ADRs referenced:** ADR-214 (audit recommendation governance), ADR-052 (Gap
Closure Policy), ADR-083 (ADR numbering)

## Context

GOAP-1000 audits four domains — missing implementation, security, E2E tests and
new features — entirely from source reading on one checkout. Read-only review is
cheap to over-claim from: a line of source looks like a runtime fact, a delivered
route looks like a reachable user capability, and an unimplemented idea looks
like an unmet promise. ADR-214 already requires classifying audit
recommendations before implementing them. This ADR applies the same discipline to
the audit's own claims, so later readers cannot mistake the published inventory
for proof, certification or authorization.

Prior records in this repository have drifted in exactly these ways: a plan
marked "DONE" while deployment acceptance was still open, and archived ADR
headers still reading `Proposed` under an authoritative `Accepted` index row.

## Decision

The following boundaries govern every claim in GOAP-1000 and its four owned
follow-up plans.

1. **Source evidence is not runtime proof.** Every finding is attributed to a
   re-read source anchor. A control-flow defect confirmed in source is
   classified `source-only`. Runtime consequence, production frequency and
   exploitability are `[INFERENCE]` unless a real execution recorded them.
2. **Priorities are not vulnerability severities.** P1/P2 order execution
   sequence. No published row is a severity rating, a CVSS score, a security
   certification or a claim that a vulnerability exists.
3. **Delivered backend or components are not proof of reachable user
   behavior.** An implemented route, an exported component or a passing mocked
   browser test proves its own unit only. Reachable UI, authorization and
   database integration each need their own evidence.
4. **Optional opportunities are not missing requirements.** GOAP-1004's N1–N3
   are product options. Their absence from `PRODUCT.md` obligations is a
   recorded fact, not a defect.
5. **Document publication does not authorize application or security-policy
   changes.** Approving this plans-folder update implements nothing. Corrective
   work requires its own authorization, and any newly demonstrated exploit
   follows private disclosure in `SECURITY.md` before public mechanics are
   written.

Execution ordering follows: source-confirmed control-flow omissions are
publishable on their own evidence; runtime and deployed-security proof is
outstanding and must be stated as such rather than manufactured or deferred
indefinitely.

## Consequences

- GOAP-1000 is scoped `DONE (analysis only; corrective implementation not
authorized)`; GOAP-1001–1004 are `PROPOSED` and stay unchecked.
- Historical plans retain their dated evidence; corrections arrive as dated
  successor notes, never as rewritten history.
- Prior plan statuses that conflate implementation with deployment acceptance
  are corrected in the index, and archived ADR headers are brought into line with
  the authoritative index without inventing adoption dates.

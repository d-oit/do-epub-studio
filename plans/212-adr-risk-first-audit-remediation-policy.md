# ADR-212: Risk-First Audit Remediation Policy

**Date:** 2026-08-02
**Status:** Accepted
**Deciders:** Project maintainer, security reviewer, product owner
**Related:** GOAP-212, ADR-105b, ADR-106, ADR-115

## Context

GOAP-212 identified cross-cutting audit findings with different disclosure,
dependency, and delivery constraints.

The findings cannot safely be implemented as one broad cleanup:

- Security-sensitive behavior requires private classification and may constrain
  public PR text.
- Error/trace contracts are dependencies for later API and feature work.
- Performance fixes need measurable bounds rather than local optimizations.
- README must describe verified behavior, not work that is merely planned.
- Completed plans 207–211 must remain historical evidence rather than being
  reopened or duplicated.

Existing policies already define private disclosure, audit evidence standards,
offline behavior, observability, and feature priority. This ADR does not replace
those decisions; it defines only the sequencing of GOAP-212 work.

## Decision

Adopt a risk-first remediation sequence with four rules.

### 1. Private triage precedes public security work

Every GOAP-212 security-sensitive finding is classified privately before a
related public issue or PR is opened. Confirmed vulnerabilities use a GitHub
Security Advisory and coordinated disclosure; hardening gaps, accepted risks,
and rejected hypotheses retain only the record appropriate to their outcome.

### 2. Foundational contracts precede their consumers

Unified error and request-trace contracts precede integrations that consume
them. Pagination semantics precede large export and aggregate features. Offline
queue semantics precede conflict persistence and resolution UI.

### 3. Independent current-state work does not wait

Reader search bounds, offline single-flight work, governance reconciliation,
and README setup/architecture corrections proceed independently when they do
not disclose or depend on private findings.

### 4. Documentation converges in two passes

README setup, architecture, and current-state corrections happen immediately.
Security and observability sections follow private classification and verified
contract changes so they contain only approved, implemented claims.

This ADR does **not** supersede ADR-005, ADR-112, ADR-105b, ADR-106, ADR-115, or
any standing security-posture decision. A remediation that conflicts with an
accepted decision requires its own explicit superseding ADR.

## Alternatives Considered

### One comprehensive implementation PR

Rejected. The blast radius, disclosure constraints, and dependency graph make
review and rollback unsafe.

### Feature-first delivery

Rejected. New product flows would expand unbounded APIs and inherit incomplete
error, trace, cache, and privacy contracts.

### Reopen completed plans 207–211

Rejected. Those plans have completed acceptance criteria. GOAP-212 records the
newly evidenced residual gaps and references prior scope boundaries explicitly.

## Consequences

### Positive

- Security-sensitive work is classified before public implementation.
- Later feature work inherits a consistent error, trace, redaction, and paging
  foundation.
- Each implementation unit has focused ownership, tests, and rollback scope.
- README becomes a reliable operational entry point rather than an aspiration.

### Negative

- Dependent feature delivery waits for foundational contract work.
- Private advisory coordination adds process overhead.
- Contract-first ordering can delay dependent work.

### Neutral

- This ADR accepts no finding, severity, remediation, or security-posture
  supersession; the applicable private record or focused ADR owns each decision.

## Compliance

- `SECURITY.md`: private vulnerability disclosure and response SLA
- AGENTS.md Tier 1: private disclosure and security requirements
- AGENTS.md Tier 2: GOAP/ADR issue records and mandatory quality gates
- ADR-105b: observability and global error handling
- ADR-106: feature-completeness delivery order
- ADR-115: verified audit-remediation evidence policy

## Review Triggers

Revisit this decision when GOAP-212 is completed, when private classification
changes which tasks may be discussed publicly, or when a dependency can no
longer be delivered in the stated order.

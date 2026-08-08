# ADR-214: Audit Recommendation Governance

**Date:** 2026-08-03
**Status:** Accepted
**Deciders:** Project maintainer, security reviewer, product owner
**Related:** GOAP-214, ADR-106, ADR-115, ADR-187, ADR-212

## Context

GOAP-214 records a broad audit across security, performance, lint/build/test,
i18n, product features, responsive UI/UX, test harnesses, tracing, and email
sending.

Broad audit results become hard to execute when they mix private security
triage, CI policy drift, product feature gaps, and documentation drift in one
undifferentiated list. The repository already requires GOAP plans plus ADRs for
surfaced issues, private disclosure for vulnerabilities, and fail-closed
engineering gates.

## Decision

Adopt a recommendation governance policy for GOAP-214.

1. **Classify before implementing.** Security-sensitive email, token, PII,
   logging, and recovery-link behavior must be classified privately before
   public implementation detail is written.
2. **Foundation before feature expansion.** Trace validation, background log
   correlation, CI harness policy, and budget alignment precede new product
   feature work that depends on those contracts.
3. **Evidence beats aspiration.** Product, README, and runbook claims must
   describe verified behavior. New feature claims require tests and acceptance
   criteria in the same implementation slice.
4. **One gate, one owner.** Every quality gate drift gets a single owner and a
   concrete enforcement point. Advisory gates are allowed only when explicitly
   documented as advisory.
5. **No duplicate backlog.** Existing completed plans remain closed. GOAP-214
   references residual or newly evidenced gaps without reopening old records.

## Alternatives Considered

### Implement all recommendations in one PR

Rejected. The work spans private security, CI, product UX, PWA behavior, and
test architecture. One PR would be hard to review, hard to revert, and likely
to disclose security-sensitive detail.

### Treat all findings as documentation-only

Rejected. Several findings are executable quality or security controls and need
tests, CI enforcement, or code changes.

### Defer to existing plans 212 and 213

Rejected. Plans 212 and 213 addressed a prior audit wave. GOAP-214 records
current residual drift and newly requested audit areas.

## Consequences

### Positive

- Security-sensitive email work follows the disclosure process.
- Foundational tracing and test harness fixes reduce risk for later features.
- Product and operational claims stay tied to verified behavior.
- CI and performance gates become easier to reason about.

### Negative

- Feature work may wait for harness and tracing foundations.
- Private triage adds process overhead.
- Some recommendations require follow-up ADRs if they supersede existing
  accepted policies.

## Compliance

- `SECURITY.md`: private disclosure and coordinated vulnerability handling.
- AGENTS.md Tier 1: secrets, sessions, trace IDs, tests, and Codacy policy.
- ADR-106: backend/contracts before feature UI.
- ADR-115: verified audit remediation.
- ADR-187: fail-closed engineering gates.
- ADR-212: risk-first audit remediation.

## Review Triggers

Revisit this ADR when GOAP-214 completes, when an implementation PR needs to
supersede an accepted ADR, or when CI policy changes make any listed gate
advisory instead of blocking.

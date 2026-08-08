# ADR-215: Audit Wave 2026-08-03 Execution Policy

**Date:** 2026-08-03
**Status:** Accepted
**Deciders:** Project maintainer, security reviewer, QA owner
**Related:** GOAP-215, ADR-092, ADR-199, ADR-212, ADR-214

## Context

GOAP-215 consolidates a fresh all-dimension audit (security, performance,
lint/build/test, i18n, product features, responsive UI/UX, test pyramid,
harness, global error handling with tracing, and email sending) into one
compact backlog extending Plan 214. The audit confirmed the existing security
and observability posture is strong (Argon2id, allowlist sanitization,
sandboxed iframe, strict CSP, trace propagation, Sentry on both tiers) and
surfaced new evidence beyond Plan 214: static analysis excludes application
source (`.codacy.yml`), there is no integration test layer between unit and
E2E, grants are created without invite emails or any transactional template,
all 13 locale modules ship in the main bundle, number formatting has no Intl
helper, and two docs drift from implemented behavior.

Several of these findings require policy before execution can start.

## Decision

Adopt the following execution policy for GOAP-215.

1. **One ranked backlog.** GOAP-215 is the single working backlog for this
   audit wave. It references Plan 214 IDs (`R1`–`R12`) instead of copying
   them; new findings carry `N` IDs. No completed plan is reopened.
2. **Static analysis must cover app source.** Codacy, or an equivalent
   type-aware gate, must analyze `apps/**` and `packages/**`. Until the
   `.codacy.yml` path exclusion (N1) is fixed, `pnpm lint` with type-aware
   `typescript-eslint` rules remains the authoritative gate.
3. **Integration layer before new E2E surface.** New cross-boundary coverage
   is added as worker-route integration tests (miniflare or handler-level
   with real `packages/schema` validation) or MSW-backed component tests —
   not as additional full-browser E2E specs — until N2 lands.
4. **Email expansion is gated.** Invite emails and transactional templates
   (N3) ship only after R1 private triage closes and R12 delivery
   observability exists. Templates carry exactly one signed link and never
   embed token material, recipient PII, or message-body content in logs.
5. **i18n grows formatting, not plural rules.** `Intl.NumberFormat` and lazy
   per-locale loading (N4) are in scope; ICU plural rules remain deferred per
   ADR-199.
6. **Viewport matrix is a merge gate for new UI.** New reader/admin surfaces
   must pass the R9 responsive matrix (320, 375, 390, 768, 1024, 1440, and a
   landscape mobile size, in LTR and RTL) before merge.

## Alternatives Considered

### Fold the new findings into Plan 214 directly

Rejected. Plan 214 is already governed by ADR-214 with its own private-triage
and sequencing policy; appending new evidence to it would blur ownership and
violate the no-duplicate-backlog rule in the opposite direction (one plan,
two audit waves).

### One ADR per new finding

Rejected for compactness. Findings N1–N8 share one decision context (audit
wave execution order and gating). Individual follow-up ADRs are still
required when a remediation supersedes an accepted policy (for example, an
OpenTelemetry decision under N7).

## Consequences

### Positive

- One compact, prioritized backlog with clear wave ordering and owners.
- Email feature expansion cannot leak tokens or PII before controls exist.
- Test growth targets the genuinely thin integration layer instead of
  inflating E2E runtime.
- Static analysis and responsive coverage become enforceable gates.

### Negative

- Feature work (invite emails, insights aggregation) waits on Wave 0/1
  foundations.
- Lazy locale loading adds a build/runtime loading path that must itself be
  tested.
- Codacy scope changes may surface a backlog of pre-existing findings that
  need triage under ADR-181.

## Compliance

- AGENTS.md Tier 1: secrets, sessions, trace IDs, and sanitization policy.
- AGENTS.md Tier 2 Rule 9: all findings recorded as GOAP + ADR in `plans/`.
- ADR-092: token storage and CSRF posture remain standing (N8).
- ADR-199: plural rules stay deferred.
- ADR-212: risk-first remediation ordering.
- ADR-214: recommendation governance, private triage, no duplicate backlog.

## Review Triggers

Revisit this ADR when GOAP-215 Wave 1 completes, when Codacy scope changes
land (N1), when an OpenTelemetry decision is proposed (N7), or when any
remediation needs to supersede an accepted ADR.

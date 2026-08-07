# ADR-217: OpenTelemetry Evaluation as a Follow-Up Decision

> **Status:** Accepted (deferred decision: evaluation scheduled)
> **Supersedes:** none
> **Related:** `plans/215-goap-all-dimension-audit-recommendations.md` (N7), ADR-067, ADR-212
> **Deciders:** maintainers
> **Tags:** observability, telemetry, otel, deferral

## Context

Plan 215 (recommendation N7) asked whether the telemetry pipeline should be
migrated from structured JSON logs (`client-logger` / worker `logApp*`)
toward OpenTelemetry (OTLP) spans/metrics/traces. Plan 215 was executed as a
non-gated remediation wave (Plan 216); N7 was explicitly left unscheduled and
recorded to "go to a follow-up ADR". This ADR records that deferral as an
accepted decision so the follow-up is traceable rather than silently dropped.

## Decision

1. **No OTel adoption now.** Telemetry stays on the current structured-logging
   path (traceId/spanId propagated via `RequestContext`, `createTraceId`,
   `createSpanId`). This satisfies current observability needs at negligible
   cost and preserves compatibility with the existing Workers/CF observability
   surface (ADR-067).
2. **The evaluation is scheduled, not abandoned.** A decision to adopt OTLP is
   deferred until telemetry volume or cross-service tracing demand justifies
   it. Criteria to revisit (any one triggers re-evaluation):
   - Cross-request distributed tracing becomes a concrete requirement.
   - Trace/metrics volume makes JSON-log aggregation impractical.
   - A managed OTLP sink is provisioned in the CF account.
3. **No new OTel-specific DTOs, SDKs, or envelope formats are added** until this
   ADR is reopened. Any migration must be additive and dual-emit during a
   transition window.

## Consequences

### Positive

- Keeps the existing, already-observable pipeline (traceId spans live across
  the app, worker, and offline layers) without new dependencies or egress.
- Defines explicit, reviewable triggers to revisit, preventing both
  over-engineering now and silent stagnation later.
- Aligns with ADR-212's risk-first remediation policy (do the smallest thing
  that satisfies current needs).

### Negative

- No OTLP interoperability until adoption; external OTel-native collectors
  cannot ingest these logs directly without a translation shim.
- Distributed-trace request IDs are app-defined (traceId/spanId), not
  W3C `traceparent`-aware across third-party services.

### Neutral

- Production code and log schemas are unchanged by this decision.

## Compliance

- Follow-up work must reference this ADR by number and satisfy one of the
  revisit criteria above to reopen it.
- Any later OTel PR must update `plans/ADR-INDEX.md` and, if it ships,
  supersede this deferral ADR.

# GOAP 212: Comprehensive Product, Security, Performance, and Reliability Audit

**Date:** 2026-08-02
**Status:** Completed (non-security work via GOAP-213 PR #897, GOAP-217 PR #915, and GOAP-226 (2026-08-11) closing the remaining implementable gaps: P4 grants pagination, P8 export concurrency, O3 telemetry drop signal, O6 SW observability, F1 chapter duration + reading speed; S1–S9 remain in private triage per ADR-212)
**Goal:** Convert the evidence-based audit into sequenced, testable remediation work without duplicating completed plans 207–211.
**Decision:** [ADR-212](212-adr-risk-first-audit-remediation-policy.md)

> **Security handling:** Findings S1–S9 are security-sensitive and intentionally
> sanitized. Their evidence, severity, reproduction, and remediation details
> belong in private triage records. Confirmed vulnerabilities move to GitHub
> Security Advisories for coordinated disclosure; hardening, accepted-risk, and
> rejected findings retain the record appropriate to their classification. Do
> not add private details to this public plan.

## 1. Scope and Method

The audit statically reviewed `README.md`, `PRODUCT.md`, security posture and
observability documentation, active top-level plans, Worker routes and
middleware, web application code, service-worker/offline behavior, reader-core,
shared contracts, configuration, and representative tests.

Requested domains:

1. New and incomplete product features
2. Security and privacy
3. Performance and resource bounds
4. README accuracy and onboarding
5. Global error handling
6. Distributed tracing
7. Structured logging and telemetry

No source code, configuration, or README changes are part of this audit. The
findings describe commit `130bce7e986a93a3d713961fde9d28d313ce1301` plus the
current working tree after synchronizing with `origin/main`. Existing unrelated
edits to plans 098, 208, and 209 were not modified.

### Evidence standard

- **Confirmed:** Directly demonstrated by current code or tests.
- **Decision review:** Current behavior is intentional or partly documented,
  but its residual risk needs an explicit decision and regression test.
- **Documentation drift:** The implementation and its public documentation do
  not provide the same contract.

## 2. Executive Priorities

| Priority | Outcome                                                                      | Finding IDs   |
| -------- | ---------------------------------------------------------------------------- | ------------- |
| Private  | Classify security-sensitive findings before public implementation work       | S1–S9         |
| P1       | Restore end-to-end error and trace correlation                               | O1–O9         |
| P1       | Bound high-growth reads, rendering, search, export, and sync work            | P1–P4, P7, P8 |
| P1       | Complete documented offline conflict behavior                                | F2            |
| P1       | Make setup, architecture, security, and operations truthful in README        | R1–R8         |
| P2       | Complete reading insights, improve quota behavior, and add admin aggregation | F1, P6, F3    |

## 3. Security and Privacy Findings

The public record preserves scope and ownership without pre-empting private
classification or disclosure. Private triage must also reconcile accepted
ADR-005 offline leases, ADR-112 upload trade-offs, the current signed-capability
contract, and local staged-diff secret scanning before proposing changes.

| ID  | Private review area                     | Public disposition                                                             |
| --- | --------------------------------------- | ------------------------------------------------------------------------------ |
| S1  | Upload trust and publication boundary   | Private triage; decide whether ADR-112 remains valid                           |
| S2  | Protected file capability lifecycle     | Private decision review against the accepted bearer-capability contract        |
| S3  | Local protected-data cleanup            | Private triage; separate local logout from remote/offline revocation semantics |
| S4  | Untrusted EPUB execution deadlines      | Private triage of cancellation, isolation, and extraction-output controls      |
| S5  | EPUB network-isolation defense in depth | Private verification of the existing sanitizer, sandbox, and CSP contract      |
| S6  | Reanchor worker CPU/memory boundary     | Private policy-drift review; do not characterize fixed regexes as proven ReDoS |
| S7  | Email and client telemetry sink privacy | Private triage across console, transport, persistence, and third-party sinks   |
| S8  | Secret-scanning coverage                | Private hardening review including existing local staged-diff controls         |
| S9  | Protected client-cache isolation        | Private triage against ADR-005 and the authenticated API cache contract        |

### Security acceptance criteria

- [ ] Each private record classifies behavior confidence, exploitability,
      severity, existing compensating controls, and disclosure status separately.
- [ ] Accepted ADRs remain in force unless a new accepted ADR explicitly
      supersedes them.
- [ ] Every approved remediation has concrete budgets and regression tests in
      its private record before public implementation begins.
- [ ] Public PR descriptions contain only coordinated-disclosure-approved detail.
- [ ] Security-header and isolation regression coverage has an explicit owner in
      the approved implementation plan.

## 4. Performance and Resource-Bound Findings

| ID  | Priority | State              | Evidence                                                                                                                                                                                                                                      | Finding and smallest remediation                                                                                                                                                                                              |
| --- | -------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | P1       | Confirmed          | `apps/web/src/features/reader/hooks/useReaderSearch.ts:45-90`                                                                                                                                                                                 | Reader search loads every spine item concurrently, caps only after all work, and does not cancel superseded work. Use bounded concurrency, stop scheduling at the result cap, cancel stale searches, and unload in `finally`. |
| P2  | P1       | Confirmed          | `apps/web/src/lib/offline/sync.ts:59-90,108-165`                                                                                                                                                                                              | Every enqueue can start a drainer, and each drainer repeatedly filters/sorts the same snapshot. Add a single-flight drain promise/mutex, sort once, and wake the existing FIFO drainer.                                       |
| P3  | P1       | Confirmed          | `apps/worker/src/routes/books.ts:11-28`; `apps/web/src/features/library/MyLibraryPage.tsx:19-39,66-130`                                                                                                                                       | Library retrieval and rendering are unpaginated. Add bounded deterministic pagination consistent with repository contracts and incremental rendering; derive groups in one pass.                                              |
| P4  | P1       | Confirmed          | `apps/worker/src/routes/comments.ts:33-68`; `apps/worker/src/routes/reader/bookmarks.ts:23-54`; `apps/worker/src/routes/reader/highlights.ts:28-54`; `apps/worker/src/routes/admin/grants.ts:49-70`; `apps/worker/src/routes/export.ts:60-90` | Multiple list/export paths read unbounded datasets. Enforce bounded pagination; bound or asynchronously stream large exports.                                                                                                 |
| P5  | Private  | Security-sensitive | S4 private record                                                                                                                                                                                                                             | Review parser cancellation and resource-release behavior privately; publish performance work only after classification.                                                                                                       |
| P6  | P2       | Confirmed          | `apps/web/src/sw.ts:71-106,109-133`                                                                                                                                                                                                           | Storage estimation runs on each eligible cache write and pressure eviction targets only one unrelated cache. Throttle checks and evict globally by measured age/size policy.                                                  |
| P7  | Private  | Security-sensitive | S7/S9 private records                                                                                                                                                                                                                         | Review request-cache key privacy privately; the public performance scope is bounded TTL/LRU behavior and eviction of rejected promises.                                                                                       |
| P8  | P1       | Confirmed          | `apps/worker/src/routes/export.ts:60-83`                                                                                                                                                                                                      | Independent export reads execute serially. After adding memory/row bounds, run them concurrently or through a supported database batch.                                                                                       |

### Performance acceptance criteria

- Reader search uses at most four concurrent chapter loads, stops at 50
  results, cancels stale work, and unloads every loaded chapter.
- A burst of 1,000 offline mutations starts one drainer, queue CPU work scales
  linearly, and repeated delivery of one mutation ID has one idempotent effect.
- List endpoints enforce bounded deterministic pagination with documented
  offset/cursor semantics; initial library rendering does not mount the full
  collection.
- Export has an explicit row/memory ceiling or asynchronous streaming contract.
- Request caches follow the privately approved keying contract, never exceed
  their configured entry bound, and retry after rejected promises.
- Each implementation PR chooses and tests explicit cache, export, quota,
  buffer, and latency budgets before changing behavior.

## 5. New and Incomplete Feature Findings

| ID  | Priority | State                  | Evidence                                                                                                                                         | Finding and smallest remediation                                                                                                                                                                                                        |
| --- | -------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | P2       | Confirmed gap          | `PRODUCT.md:15-20`; `apps/web/src/lib/offline/reading-insights.ts:184-220`; `apps/web/src/features/reader/components/info/InfoPanel.tsx:252-310` | Product promises chapter time and reading speed, but current insights expose aggregates and streaks only. Record chapter identity and active reading deltas; define and display chapter duration and reading-speed units.               |
| F2  | P1       | Confirmed gap          | `docs/offline.md:100-107`; `apps/web/src/lib/offline/conflict-resolution.ts:39-82`; `apps/web/src/lib/offline/sync.ts:108-165`                   | Documented ADR-005 conflict behavior is not integrated into the sync pipeline. First clarify the versioned conflict contract and automatic entity policies, then separately persist and present conflicts that require user resolution. |
| F3  | P2       | Documented future work | `docs/reading-insights.md:130-134`; `apps/web/src/App.tsx:132-179`                                                                               | Admin per-book/per-grant reading insight aggregation has no route. Add a paginated aggregate endpoint and one admin summary view after F1 data semantics stabilize.                                                                     |

Feature work must follow ADR-106: backend/contract first, Zod validation,
authorization, trace propagation, rate-limit review, offline semantics where
applicable, accessible UI, and automated tests.

## 6. Global Error Handling, Tracing, and Logging Findings

| ID  | Severity | State                           | Evidence                                                                                                                                                                                                                       | Finding and smallest remediation                                                                                                                                                                                                                                                                                                 |
| --- | -------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O1  | High     | Confirmed                       | `apps/worker/src/app.ts:27-36`; `apps/worker/src/middleware/observability.ts:10-32`                                                                                                                                            | A headerless 414 creates one trace for middleware/logs and another for the body. Store request context in Hono context and use it for every response.                                                                                                                                                                            |
| O2  | Private  | Security-sensitive              | S7 private record                                                                                                                                                                                                              | Review every browser logging/error-reporting sink, including console, telemetry transport, persistence, and Sentry, before publishing the approved privacy contract.                                                                                                                                                             |
| O3  | Medium   | Confirmed                       | `apps/web/src/lib/client-logger.ts:34-54`; `apps/worker/src/routes/telemetry.ts:31-35,64-89`                                                                                                                                   | Client batches are removed before transport acceptance, transport results are incompletely handled, and persistence failures have no signal. Add bounded buffering, handle `sendBeacon() === false`, use acknowledgement where fetch supports it, and emit recursion-safe drop/retry counters while keeping telemetry fail-open. |
| O4  | Medium   | Confirmed                       | `apps/worker/src/routes/telemetry.ts:39-61`; `apps/worker/src/lib/observability.ts:128-180`                                                                                                                                    | Re-emitted telemetry obscures correlation among the ingest request, client event, and generated server log. Preserve separately named `ingestTraceId` and validated `clientTraceId`/`clientSpanId`; never treat client-controlled IDs as authoritative server context.                                                           |
| O5  | Medium   | Confirmed                       | `apps/web/src/features/reader/components/notifications/NotificationBadge.tsx:17-33`; `apps/web/src/features/reader/components/notifications/NotificationPanel.tsx:39-68`; traced path at `apps/web/src/lib/api/core.ts:41-120` | Notification requests bypass the traced API layer, suppress polling failures, and can update local state after failed writes. Use the traced client and mutate state only after confirmed success; rate-limit repetitive poll logs.                                                                                              |
| O6  | Medium   | Known limitation                | `apps/web/src/sw.ts:71-103,122-150,164-224`; `plans/archive/207-goap-missing-impl-cleanup.md:24-29`                                                                                                                                    | Service-worker errors and sync/cache events are isolated from app telemetry and initiating traces; retryable sync failures are swallowed. Add a service-worker-safe redacted logger, propagate page trace context, install global handlers, and rethrow retryable sync failures.                                                 |
| O7  | Medium   | Confirmed                       | `packages/shared/src/dtos.ts:1-16`; `apps/worker/src/middleware/observability.ts:21-32`; `apps/worker/src/routes/telemetry.ts:12-25`                                                                                           | Public error envelopes are inconsistent and the shared type omits trace correlation. Add `traceId` to the shared error contract and centralize non-success JSON response creation from request context.                                                                                                                          |
| O8  | Medium   | Confirmed                       | `apps/worker/src/middleware/cors.ts:8-20`; `apps/web/src/lib/api/core.ts:100-104`                                                                                                                                              | Cross-origin browser code cannot read trace response headers because CORS does not expose them. Expose trace, span, and `traceparent` headers and verify with a real cross-origin integration test.                                                                                                                              |
| O9  | Low      | Positive control / residual gap | `apps/web/src/main.tsx:31-143`; `apps/web/src/components/ErrorBoundary.tsx:26-55`                                                                                                                                              | Window errors, unhandled rejections, and React render failures already have global handling and tests. Preserve them; the uncovered global runtime is the service worker in O6.                                                                                                                                                  |

### Observability acceptance criteria

- For representative 400, 401, 403, 404, 413, 414, 423, 429, 500, and 504
  responses, body, response headers, request logs, and client events share one
  trace ID.
- Approved sink-privacy controls cover console, memory, network, storage, and
  third-party error reporting and never throw on circular/deep metadata.
- Failed telemetry delivery is bounded and observable without recursively using
  the failing persistence path.
- Notification and service-worker operations propagate trace/span context and
  do not report failed writes as successful locally.
- Cross-origin browser tests can read all observability response headers.

## 7. README and Onboarding Findings

| ID  | Priority | Evidence                                                                                                               | Required update                                                                                                                                                                            |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | P1       | `README.md:8`; `apps/worker/wrangler.jsonc:12-29`; `docs/observability-telemetry.md:58-62`                             | Qualify “production-grade” with required Cloudflare provisioning and operational readiness, including telemetry retention.                                                                 |
| R2  | P1       | `README.md:23-28`; `apps/worker/.dev.vars.example:1-5`; `apps/web/.env.local.example:1`; `docs/setup-local.md:117-138` | Keep Quick Start concise, but identify prerequisites, canonical app-local environment files, database initialization, health check, and local URLs with links to reconciled setup details. |
| R3  | P1       | `README.md:11-15`; `apps/worker/src/db/client.ts:1-50`; `apps/worker/wrangler.jsonc:12-37`                             | Replace ambiguous “D1/Turso” wording with the authoritative runtime architecture and explain any local/libSQL compatibility role.                                                          |
| R4  | P1       | `README.md:23-28`; `docs/setup-local.md:5-12,44-90`; `scripts/health-check.sh:26-39`; `docs/setup-cloudflare.md:10-38` | Reconcile Node requirements, D1/Turso guidance, secret names, and environment-file locations before linking setup as canonical.                                                            |
| R5  | P1       | `README.md:10-21`; `pnpm-workspace.yaml:1-3`; `apps/web/src/App.tsx:17-181`; `apps/worker/src/app.ts:66-77`            | Add workspace/architecture map and an evidence-based “implemented capabilities” section with status semantics.                                                                             |
| R6  | P1       | `README.md:19-21`; `docs/security.md:5-48,87-95`; `docs/security-posture.md:12-67,117-150`                             | Add a concise security model: bearer-token posture, compensating controls, grant revocation, private R2 access, rate limiting/lockout, and private disclosure.                             |
| R7  | P1       | `README.md:23-35`; root `package.json:7-32`; `docs/setup-local.md:148-163,194-250`                                     | Add command, quality-gate, Playwright setup, deployment, and common troubleshooting sections.                                                                                              |
| R8  | P1       | `README.md:35`; `docs/observability-telemetry.md:10-84`; Worker and web observability modules                          | Document tracing, structured/redacted logs, global browser handling, telemetry opt-in/configuration, failure behavior, and retention ownership.                                            |

All current local README links resolve, and stated major dependency versions
match package manifests. Preserve those positive controls.

## 8. Existing-Plan and ADR Overlap

| Record                                                        | Status            | Relationship to this audit                                                                                                                       |
| ------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `plans/106-adr-feature-completeness-policy.md`                | Proposed on disk  | Governs F1–F3 delivery; do not create another generic completeness policy. Its status conflicts with `ADR-INDEX.md`, which lists it as accepted. |
| `plans/archive/207-goap-missing-impl-cleanup.md`                      | Completed         | Its scoped logging criteria remain complete; service-worker logging was explicitly out of scope (O6).                                            |
| `plans/archive/208-goap-schema-centralization-and-validation-gaps.md` | Completed         | Its schema criteria remain complete; it explicitly left silent telemetry failure outside scope, now revisited by O3.                             |
| `plans/archive/209-goap-plan207-remaining-structured-logging.md`      | Completed         | Its transport migration remains complete; S7 is a newly verified payload-privacy review.                                                         |
| `plans/archive/210-goap-telemetry-logging-and-smoke-tags.md`          | Completed         | Its Worker routing criterion remains complete; O2–O4 concern residual sink, delivery, and correlation semantics.                                 |
| `plans/archive/211-goap-frontend-backend-schema-mismatches.md`        | Completed         | Its payload/schema repair remains complete; P2/F2 concern residual concurrency and conflict semantics.                                           |
| `plans/archive/112-adr-stream-upload-edge-cache.md`           | Accepted/archive  | Records skipped validation as a best-effort trade-off; S1 requires a new private risk decision.                                                  |
| `plans/archive/198-goap-close-remaining-gaps.md`              | Completed/archive | Considered regex gaps closed, but S6 demonstrates worker-path drift.                                                                             |
| `plans/ADR-201-webkit-smoke-ci.md`                            | Accepted          | Missing from `ADR-INDEX.md`; fix when governance documentation is next updated.                                                                  |

## 9. GOAP Decomposition and Dependencies

| Task                                           | Priority | Dependencies          | Deliverable                                            |
| ---------------------------------------------- | -------- | --------------------- | ------------------------------------------------------ |
| T0: Private security classification            | Private  | None                  | Private records for S1–S9 and approved public scope    |
| T1: Approved security remediation units        | Private  | T0                    | One independently reviewable task per approved finding |
| T2: Unified request context and error contract | P1       | T0 classification     | O1/O7/O8 contract and integration tests                |
| T3: Telemetry correlation semantics            | P1       | T0 classification, T2 | O4 ingest/client correlation contract                  |
| T4: Telemetry delivery durability              | P1       | T0 classification     | O3 bounded queue and operational signal                |
| T5: Notification tracing and error handling    | P1       | T2                    | O5 focused client tests                                |
| T6: Service-worker observability               | P1       | T0 classification     | O6 tracing, global handlers, and retry semantics       |
| T7: Library/list pagination                    | P1       | None                  | P3/P4 bounded deterministic API/UI pages               |
| T8: Export bounds and query concurrency        | P1       | T7 contract decisions | P4/P8 load and memory tests                            |
| T9: Request-cache bounds                       | P1       | T0 classification     | P7 TTL/LRU and rejection tests                         |
| T10: Reader search bounds                      | P1       | None                  | P1 benchmark and cancellation tests                    |
| T11: Offline single-flight drainer             | P1       | None                  | P2 concurrency and idempotency tests                   |
| T12: Quota policy                              | P2       | T0 classification     | P6 explicit budget and measured eviction policy        |
| T13: Offline conflict contract/storage         | P1       | T11                   | F2 API policy and persistence tests                    |
| T14: Conflict resolution UI                    | P1       | T13                   | F2 accessible user-resolution flow                     |
| T15: Reading-insight semantics                 | P2       | None                  | F1 data contract, UI, offline/sync tests               |
| T16: Admin insight aggregation                 | P2       | T7, T15               | F3 paginated endpoint and view                         |
| T17: Immediate README truth corrections        | P1       | None                  | R1–R5/R7 current-state setup and architecture          |
| T18: README security/observability update      | P1       | T0, T2–T6             | R6/R8 disclosure-approved verified contracts           |
| T19: Governance reconciliation                 | P1       | None                  | ADR-106 status/priority and ADR-201 index consistency  |

## 10. Execution Strategy

Use a **risk-first hybrid strategy**:

1. **Private security gate:** T0 classifies findings before related public work.
2. **Immediate independent work:** T7, T10, T11, T17, and T19 can proceed
   without waiting for unrelated contracts.
3. **Observability foundation:** T2 precedes dependent correlation and client
   integration work; T3–T6 remain independently reviewable.
4. **Data/product wave:** T7 precedes T8/T16; T11 precedes T13/T14; T15 remains
   P2 per ADR-106 unless T19 changes that decision.
5. **Documentation convergence:** T18 follows approved security and verified
   observability contracts; T17 does not wait for P2 product work.
6. **Quality gates per implementation PR:** focused tests, full lint/typecheck,
   coverage, build, workflow validation where applicable, Codacy, and the full
   repository quality gate before commit.

## 11. Definition of Done

- [ ] Every non-security finding has a linked implementation PR, explicit
      accepted-risk ADR, or evidence-based rejection.
- [ ] Security-sensitive findings have private classifications; confirmed
      vulnerabilities have advisories and coordinated disclosure records.
- [ ] Approved security remediations pass the private regression criteria
      attached to their classification records.
- [ ] Public API errors and critical UI/SW operations are end-to-end traceable.
- [ ] High-growth operations have enforced and benchmarked resource bounds.
- [ ] Product documentation distinguishes shipped, deferred, and planned work.
- [ ] README setup and validation commands work from a clean supported environment.
- [ ] All required repository quality and CI checks pass without suppressing new
      findings.

## 12. Audit Limitations

- Static source review only; no deployed Cloudflare configuration, production
  logs, D1 query plans, browser profiles, penetration tests, fuzzing, bundle
  analysis, or load tests were performed.
- Third-party internals and infrastructure account policies were not audited.
- External README links and badges were checked structurally, not live.
- Security severity is preliminary until private triage validates exploitability
  and existing deployment compensating controls.

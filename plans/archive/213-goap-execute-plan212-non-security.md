# GOAP 213: Execute Plan 212 Non-Security Findings

**Date:** 2026-08-02
**Status:** ✅ COMPLETED
**PR:** [#897](https://github.com/d-oit/do-epub-studio/pull/897)
**Goal:** Implement all non-security findings from Plan 212 (T2–T19, excluding T0/T1 which are private security).
**Related:** Plan 212, ADR-212

## 1. Analysis

From Plan 212, 10 areas were analyzed. 9 are unaddressed, 1 partially done:
- **Open:** T7/pagination, T10/search bounds, T11/single-flight, T2/request-context, T3/telemetry-correlation, T4/telemetry-delivery, T7/CORS headers, T5/notification-tracing, T7/shared-DTOs
- **Partial:** ADR-201 (WebKit smoke done, ADR-INDEX row missing)

## 2. Decomposition — Parallel Waves

### Wave 1: Independent Tasks (no deps)

| Task | Finding | Files | Priority |
|------|---------|-------|----------|
| T17: README truth corrections | R1-R5,R7 | `README.md` | P1 |
| T19: Governance reconciliation | ADR-201 index | `plans/ADR-INDEX.md` | P1 |
| T10: Reader search bounds | P1 | `useReaderSearch.ts` | P1 |
| T11: Offline single-flight | P2 | `offline/sync.ts` | P1 |
| T7a: Library pagination | P3/P4 | `books.ts`, `MyLibraryPage.tsx` | P1 |
| T8a: CORS trace headers | O8 | `middleware/cors.ts` | P1 |

### Wave 2: Observability Foundation

| Task | Finding | Files | Priority |
|------|---------|-------|----------|
| T2: Unified request context | O1/O7/O8 | `app.ts`, `observability.ts` | P1 |
| T7b: Shared DTO traceId | O7 | `packages/shared/src/dtos.ts` | P1 |

### Wave 3: Observability Consumers

| Task | Finding | Files | Priority |
|------|---------|-------|----------|
| T3: Telemetry correlation | O4 | `routes/telemetry.ts`, `observability.ts` | P1 |
| T4: Telemetry delivery | O3 | `client-logger.ts` | P1 |
| T5: Notification tracing | O5 | `NotificationBadge.tsx`, `NotificationPanel.tsx` | P1 |

### Wave 4: Export + Documentation

| Task | Finding | Files | Priority |
|------|---------|-------|----------|
| T8b: Export bounds | P4/P8 | `routes/export.ts` | P1 |
| T18: README security/obs | R6/R8 | `README.md` | P1 |

## 3. Execution Strategy

**Hybrid** — Wave 1 parallel swarm, Wave 2 sequential (foundation), Wave 3 parallel (consumers), Wave 4 sequential.

## 4. Acceptance Criteria

- [x] Library list uses bounded pagination (P3/P4)
- [x] Reader search caps at 4 concurrent loads, stops at 50, cancels stale, unloads chapters (P1)
- [x] Sync uses single-flight drain promise with sort-once (P2)
- [x] Request context stored in Hono context, shared by all middleware/handlers (O1)
- [x] Shared `ApiError` includes optional `traceId` (O7)
- [x] CORS exposes trace headers (O8)
- [x] Telemetry preserves ingest/client trace correlation (O4)
- [x] Client logger has bounded queue, sendBeacon failure handling (O3)
- [x] Notifications use traced client and check response success (O5)
- [x] Export has row/memory bounds (P4/P8)
- [x] README is truthful about current architecture and capabilities (R1-R8)
- [x] ADR-201 in ADR-INDEX.md (T19)
- [x] All CI passes, quality gate passes
- [x] PR created and reviewed

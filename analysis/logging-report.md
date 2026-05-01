# Logging Analysis Report

**Analysis Date:** 2025-01-20
**Scope:** do-epub-studio codebase

---

## Executive Summary

The codebase has a **partial implementation** of centralized logging with telemetry infrastructure. Trace IDs are required per AGENTS.md and are partially implemented. However, there are inconsistencies including duplicate traceId implementations and direct console usage outside of centralized logging utilities.

---

## 1. Current Logging Patterns

### 1.1 Centralized Logging Utilities

| File | Purpose | Direct Console Usage |
|------|---------|---------------------|
| `packages/shared/src/telemetry.ts` | Core ID generation + error serialization | No |
| `apps/web/src/lib/telemetry.ts` | Client-side event logging | Yes (lines 40-45) |
| `apps/worker/src/lib/observability.ts` | Server-side request logging | Yes (lines 45-50) |
| `packages/reader-core/src/epub-loader.ts` | EPUB loading with trace context | Yes (line 143-149) |

### 1.2 Direct Console Statements (Not Using Centralized Logging)

| File | Line | Type | Description |
|------|------|------|-------------|
| `apps/web/src/lib/offline/sync.ts` | 65-69 | `console.warn` | Max retry exceeded |
| `apps/web/src/lib/offline/sync.ts` | 76-86 | `console.error` | Permission revoked |
| `apps/web/src/sw.ts` | 94-96 | `console.error` | Sync failed |
| `apps/web/src/sw.ts` | 106-108 | `console.log` | Cache deleted |
| `apps/tests/accessibility-audit.spec.ts` | 65-67 | `console.log` | Axe violations (test) |
| `apps/tests/accessibility-audit.spec.ts` | 95-97 | `console.log` | Axe violations (test) |
| `apps/tests/accessibility-audit.spec.ts` | 113-115 | `console.log` | Axe violations (test) |
| `packages/reader-core/src/epub-loader.ts` | 143-149 | `console.error` | EPUB load failure |

---

## 2. TraceId Usage Analysis

### 2.1 Where TraceId is Properly Used

| Location | Implementation | Notes |
|----------|---------------|-------|
| `apps/web/src/lib/api.ts` | Uses `createTraceId()` from telemetry | ✅ Full implementation |
| `apps/worker/src/lib/observability.ts` | Uses `createTraceId()` from shared | ✅ Full implementation |
| `apps/worker/src/index.ts` | Uses `createRequestContext()` | ✅ Full implementation |
| `packages/reader-core/src/epub-loader.ts` | Has local `generateTraceId()` | ⚠️ Duplicated code |

### 2.2 Where TraceId is Missing

| File | Gap | Severity |
|------|-----|----------|
| `apps/web/src/lib/offline/sync.ts` | No traceId in any log statements | Medium |
| `apps/web/src/sw.ts` | No traceId in sync/cache logs | Medium |
| `apps/worker/src/index.ts` | Handled correctly | N/A |

---

## 3. Inconsistent Logging Patterns

### 3.1 Duplicate TraceId Generation

Three different implementations exist:

```do-epub-studio/packages/shared/src/telemetry.ts#L24-29
export function createTraceId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${randomSegment(12)}`;
}
```

```do-epub-studio/apps/web/src/lib/telemetry.ts#L11-16
export function createTraceId(): string {
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${randomSegment(12)}`;
}
```

```do-epub-studio/packages/reader-core/src/epub-loader.ts#L11-16
function generateTraceId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}
```

### 3.2 Inconsistent Error Handling

- **Worker observability.ts:** Uses `serializeError()` from shared package
- **Reader-core:** Uses local `formatError()` function (less complete)
- **Web telemetry.ts:** Does not use error serialization

### 3.3 No Standardized Logging Levels

Current implementation only supports `'info' | 'error'`:

```do-epub-studio/packages/shared/src/telemetry.ts#L16
level: 'info' | 'error';
```

Missing levels: `warn`, `debug`, `trace`

---

## 4. Logging Infrastructure

### 4.1 Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      packages/shared                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   telemetry.ts                       │   │
│  │  - createTraceId()                                   │   │
│  │  - createSpanId()                                    │   │
│  │  - serializeError()                                  │   │
│  │  - TRACE_HEADER, SPAN_HEADER constants              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
           │                                    │
           ▼                                    ▼
┌─────────────────────┐            ┌─────────────────────────┐
│      apps/web       │            │       apps/worker       │
│  ┌───────────────┐  │            │  ┌───────────────────┐  │
│  │  telemetry.ts │  │            │  │ observability.ts  │  │
│  │ logClientEvent│  │            │  │ logRequestStart   │  │
│  │ (console.*)   │  │            │  │ logRequestEnd     │  │
│  └───────────────┘  │            │  │ logRequestError   │  │
│                     │            │  │ (console.*)       │  │
└─────────────────────┘            └─────────────────────────┘
```

### 4.2 Missing Integration

- **No external logging service** (e.g., Cloudflare Logs, Datadog)
- **No log aggregation** between worker and web
- **Service worker** logs go to browser console only

---

## 5. Priority Recommendations

### P0 - Critical (Must Fix)

1. **Remove duplicate traceId implementations**
   - `reader-core` should import from `@do-epub-studio/shared`
   - `web/telemetry.ts` duplicates `shared` - consolidate

2. **Add traceId to all error logs**
   - `sync.ts` - add traceId to `console.warn` and `console.error`
   - `sw.ts` - add traceId to all console statements
   - `epub-loader.ts` - already has traceId, but uses console.error directly

### P1 - High Priority

3. **Centralize console output in worker**
   - Replace direct `console.log/error` calls with structured logging
   - Add Cloudflare Workers log binding support

4. **Add missing log levels**
   - Support `warn`, `debug`, `trace` levels
   - Add level-based filtering

5. **Create browser log forwarding**
   - In production, forward client logs to worker API endpoint
   - Add proper error boundary integration

### P2 - Medium Priority

6. **Add structured metadata to all logs**
   - Include user context (if authenticated)
   - Include device/browser information
   - Add timestamp with ISO format

7. **Implement log sampling for high-volume events**
   - Sample info-level request logs
   - Always log errors

### P3 - Nice to Have

8. **Consider logging library**
   - Current console-based approach is lightweight
   - For scale, consider pino (compatible with Cloudflare Workers)

---

## 6. Action Items Summary

| Priority | Item | Files Affected |
|----------|------|----------------|
| P0 | Import shared traceId in reader-core | `packages/reader-core/src/epub-loader.ts` |
| P0 | Remove web/telemetry duplicate | `apps/web/src/lib/telemetry.ts` |
| P0 | Add traceId to sync.ts logs | `apps/web/src/lib/offline/sync.ts` |
| P0 | Add traceId to sw.ts logs | `apps/web/src/sw.ts` |
| P1 | Add warn/debug log levels | `packages/shared/src/telemetry.ts` |
| P1 | Add production log forwarding | `apps/web/src/lib/telemetry.ts` |
| P2 | Add structured metadata | All telemetry files |

---

## 7. References

- AGENTS.md Section: TIER 1 - Critical
- Current trace implementation follows ADR-006 (multi-signal locators)
- Related files:
  - `packages/shared/src/telemetry.ts`
  - `apps/web/src/lib/telemetry.ts`
  - `apps/worker/src/lib/observability.ts`
  - `packages/reader-core/src/epub-loader.ts`

# Swarm Analysis — Summary

> **Status:** ALL 28 GAPS CLOSED (verified 2026-07-28)
> **Full analysis:** `plans/archive/swarm-analysis-2026-06-15-updated-2026-07-28.md`

## Results

| Severity | Gaps | Status |
|----------|------|--------|
| Critical | G14, G15, G16 | CLOSED |
| High | G17–G23 | CLOSED |
| Medium | G24–G28 | CLOSED |
| Low | G1–G13 | CLOSED (prior wave) |

## Key Fixes (G14–G28)

- **G14 (Comments IDOR):** `assertBookAccess()` on all comment routes
- **G15 (Magic-link email):** Real email transport via `createEmailTransport()`
- **G16 (Locator validation):** `parseLocatorRow()` wraps JSON.parse with schema validation
- **G17 (Admin recovery):** Full recovery-request + recovery-verify flow
- **G18 (Book CRUD):** PATCH + DELETE with cascade
- **G19 (Progress load):** `useReaderDataLoader` fetches on mount
- **G20 (Zod centralization):** All schemas in `@do-epub-studio/schema`
- **G21 (Orphan UI):** All components wired in GrantsPage
- **G22 (Tenant isolation):** `assertBookAccess()` on all reader routes
- **G23 (Security posture):** Tests in both web and worker
- **G24 (Catalog test):** Full route test coverage
- **G25 (ADR files):** All referenced files exist
- **G26 (ADR index):** `plans/ADR-INDEX.md` created
- **G27 (CHANGELOG):** Current with all PRs
- **G28 (Panel exclusivity):** Single `activePanel` state

## Backlog

1. Dead code cleanup in schema/shared packages (deferred per Plan 204)
2. Telemetry persistence (console-only, documented limitation)
3. Email transport binding for production

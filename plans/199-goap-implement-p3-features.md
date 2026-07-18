# Plan 199: GOAP — Implement Remaining P3 Features

**Status:** ✅ COMPLETED

**Date:** 2026-07-18
**Decision:** [ADR-187](187-adr-fail-closed-engineering-gates.md)
**Strategy:** Swarm — independent features executed in parallel
**Extends:** Plan 198 (P3 feature backlog)

## Goal

Implement the 5 remaining P3 feature plans (LC1, F3, N3, N6, N7) from Plan 198.
Each feature is independently shippable and addresses a specific gap in the platform.

## Audit Results

| Plan | Feature | Status Before | Action |
|------|---------|---------------|--------|
| LC1 | API Rate Limiting | ✅ ALREADY IMPLEMENTED | Plan status updated to COMPLETED |
| F3 | Cross-Isolate Cache | PROPOSED | ✅ KV-backed cache version implemented |
| N3 | Server-Side Search | PROPOSED | ✅ FTS5 full-text search implemented |
| N6 | EPUB Re-Export | PROPOSED | ✅ Markdown/HTML export implemented |
| N7 | Reply Notifications | PROPOSED | ✅ Notification system implemented |

## Task Completion Evidence

| Task | Status | Evidence |
|------|--------|----------|
| T1 (LC1) | ✅ | Rate limiting fully implemented: DO-based, per-route limits, Retry-After headers |
| T2 (F3) | ✅ | `edge-cache.ts` — KV-backed `getCacheVersion()`/`bumpCacheVersion()` with local fallback |
| T3 (N7) | ✅ | `notifications.ts` route + `NotificationBadge`/`NotificationPanel` + D1 migration 0006 |
| T4 (N3) | ✅ | `search.ts` route + FTS5 migration 0007 + `indexBookContent()` helper |
| T5 (N6) | ✅ | `export.ts` route — Markdown + HTML export with highlights, comments, bookmarks |

## Files Created/Modified

| File | Change |
|------|--------|
| `packages/schema/migrations/0006-notifications.sql` | D1 migration: notifications table |
| `packages/schema/migrations/0007-fts-search.sql` | D1 migration: FTS5 virtual table + search index |
| `apps/worker/src/routes/notifications.ts` | Notification CRUD endpoints + createReplyNotification helper |
| `apps/worker/src/routes/search.ts` | Full-text search endpoint + indexBookContent helper |
| `apps/worker/src/routes/export.ts` | Markdown/HTML annotation export endpoint |
| `apps/worker/src/routes/index.ts` | Export new routers |
| `apps/worker/src/routes/comments.ts` | Trigger notification on reply |
| `apps/worker/src/lib/edge-cache.ts` | KV-backed cache version for cross-isolate invalidation |
| `apps/worker/src/app.ts` | Mount new routes |
| `apps/worker/wrangler.jsonc` | Add CACHE_KV binding |
| `apps/worker/src/worker-configuration.d.ts` | Add CACHE_KV type |
| `apps/web/src/features/reader/components/notifications/NotificationBadge.tsx` | Bell icon with unread count |
| `apps/web/src/features/reader/components/notifications/NotificationPanel.tsx` | Notification list with mark-as-read |
| `apps/web/src/i18n/en.ts` + 12 locales | i18n keys for notifications, search, export |
| `apps/worker/src/__tests__/fixtures.ts` | Add CACHE_KV to test env |
| `apps/worker/src/__tests__/edge-cache.test.ts` | Await async buildCacheKey |
| `apps/worker/src/__tests__/middleware.test.ts` | Add CACHE_KV to inline makeEnv |
| `apps/worker/src/__tests__/password-coverage.test.ts` | Add CACHE_KV to inline env |
| `apps/worker/src/__tests__/rate-limit-client.test.ts` | Add CACHE_KV to inline makeEnv |

## Acceptance Criteria

- [x] LC1 plan status updated to COMPLETED
- [x] F3: Cache version stored in KV, cross-isolate invalidation works
- [x] N7: Notifications table exists, notification endpoint works, UI shows badge
- [x] N3: FTS5 table exists, search endpoint returns results
- [x] N6: Export endpoint returns Markdown/HTML with annotations
- [x] `pnpm lint` passes
- [x] `pnpm typecheck` passes (7/7)
- [x] `pnpm test:unit` passes (862 web + all worker/reader-core/shared)
- [x] `pnpm build` passes

## Execution Strategy

**Swarm** — all 5 tasks are independent and executed in parallel.

| Task | Agent Type | Dependencies |
|------|-----------|-------------|
| T1 (LC1) | goap-agent | None |
| T2 (F3) | cloudflare-worker-api | None |
| T3 (N7) | cloudflare-worker-api + reader-ui-ux | None |
| T4 (N3) | cloudflare-worker-api + reader-ui-ux | None |
| T5 (N6) | cloudflare-worker-api + reader-ui-ux | None |

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| FTS5 not available in local D1 | Low | Medium | Use LIKE fallback for local dev |
| EPUB re-export complexity | Medium | High | Start with Markdown export, add EPUB later |
| Notification volume | Low | Low | Pagination + mark-as-read |

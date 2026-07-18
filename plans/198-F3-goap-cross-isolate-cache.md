# Plan 198-F3: GOAP — Cross-Isolate Cache Invalidation

**Status:** 📋 PROPOSED
**Date:** 2026-07-18
**Decision:** ADR-198 (Verified-Closure Methodology)
**Priority:** P3
**Source:** Plan 121 (F3), Plan 112-V12
**Ships as:** `perf/cross-isolate-cache-invalidation`

## Goal

Replace the per-isolate `CACHE_VERSION` variable in `edge-cache.ts` with a
Durable Object or KV-backed version counter so that cache invalidation on
book content changes propagates across all Worker isolates in the colo.

## Context

The current `bumpCacheVersion()` in `apps/worker/src/lib/edge-cache.ts` uses
a module-level `let CACHE_VERSION` variable. This only affects the isolate
that processed the upload — other isolates continue serving stale cache
until the TTL expires (60s max-age, 300s s-maxage).

## Decompose

| ID | Task | Effort | Deps |
|----|------|--------|------|
| T1 | Design cache-version DO or KV schema | M | — |
| T2 | Implement CacheVersionDO with `getVersion()` and `bump()` | M | T1 |
| T3 | Update `edge-cache.ts` to read version from DO/KV | M | T2 |
| T4 | Update `books.ts` upload-complete to bump DO/KV version | S | T2 |
| T5 | Add tests for cross-isolate invalidation | M | T3 |
| T6 | Update `wrangler.toml` with DO binding | S | T2 |

## Risks

- **Latency:** DO/KV lookup adds ~5-10ms per cache check
- **Cost:** DO operations have billing implications
- **Complexity:** DO lifecycle management adds operational burden

## Acceptance Criteria

- [ ] Cache version is stored in DO/KV, not module-level variable
- [ ] Upload on any isolate invalidates cache on all isolates
- [ ] Cache hit rate is not significantly degraded by version lookup
- [ ] Tests verify cross-isolate invalidation behavior
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test:unit` pass

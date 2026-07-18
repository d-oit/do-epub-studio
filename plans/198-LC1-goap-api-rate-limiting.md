# Plan 198-LC1: GOAP — API Rate Limiting Per Tenant

**Status:** 📋 PROPOSED
**Date:** 2026-07-18
**Decision:** ADR-198 (Verified-Closure Methodology)
**Priority:** P3
**Source:** Plan 121 (LC1)
**Ships as:** `feat/api-rate-limiting`

## Goal

Add per-tenant rate limiting to the Worker API to prevent abuse, protect
shared resources, and ensure fair usage across all tenants.

## Context

The Worker currently has no rate limiting beyond Cloudflare's default DDoS
protection. Individual tenants can make unlimited API calls, which could
exhaust D1 query quotas or R2 bandwidth.

## Decompose

| ID | Task | Effort | Deps |
|----|------|--------|------|
| T1 | Design rate-limit strategy (Durable Object counter or CF Rate Limiting API) | M | — |
| T2 | Implement rate-limit middleware for Hono | M | T1 |
| T3 | Configure per-route limits (read: 100/min, write: 30/min, admin: 60/min) | S | T2 |
| T4 | Add `RateLimitError` response with `Retry-After` header | S | T2 |
| T5 | Add rate-limit headers to responses (`X-RateLimit-*`) | S | T2 |
| T6 | Add tests for rate-limit enforcement and header correctness | M | T4 |
| T7 | Update `docs/api.md` with rate-limit documentation | S | T4 |

## Risks

- **Legitimate bursts:** Users with many tabs or rapid navigation may hit limits
- **Cost:** DO-based rate limiting has per-request billing
- **Testing:** Rate-limit tests need time-based mocking

## Acceptance Criteria

- [ ] API routes enforce per-tenant rate limits
- [ ] Rate-limit responses include `Retry-After` header
- [ ] Rate-limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`) are present
- [ ] Admin routes have separate (higher) limits
- [ ] Tests cover enforcement, headers, and error responses
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test:unit` pass

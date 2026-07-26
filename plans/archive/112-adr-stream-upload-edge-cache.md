# ADR-112: Stream Upload + Worker Edge Cache for Read-Mostly Endpoints

**Date:** 2026-06-25
**Status:** Accepted
**Deciders:** Project maintainer
**Related:** ADR-067 (Observability), ADR-105 (UI Platform), ADR-110 (Backlog consolidation), V12 in `plans/110-goap-missing-impl-modern-ui-2026-06-24.md`

## Context

The Cloudflare Worker currently buffers full EPUB uploads in memory via
`await c.req.raw.arrayBuffer()` (`apps/worker/src/routes/admin/books.ts:90`).
With the 200 MB cap, a single upload can pin a Worker instance for the
duration of the buffer copy, causing memory spikes proportional to
concurrent admin activity. Cloudflare Workers can stream bodies to R2
natively — there is no reason to hold the full payload in memory.

Separately, the public catalog endpoint
(`apps/worker/src/routes/catalog.ts`) re-runs the `COUNT(*)` + paginated
SELECT on every request. Catalog content changes at most a few times per
day, and the route is public with no auth — ideal for an edge cache. The
existing `responses.ts` helper hard-codes `Cache-Control: no-store`, which
forces every catalog fetch to hit Turso.

## Decision

1. **Stream uploads, do not buffer.** Replace
   `await c.req.raw.arrayBuffer()` with a size-guarded `TransformStream`
   that pipes the raw body into `bucket.put`. The `ReadableStream` from
   `c.req.raw.body` is consumed lazily, so peak Worker memory is bounded
   by the transform chunk size (~64 KB), not the EPUB.

2. **Hard cap uploads at 200 MB.** A `ByteCounter` `TransformStream`
   wraps the body. If the running byte total exceeds 200 MB, the
   transform's `controller.error()` aborts the stream, `bucket.put`
   rejects, and the route returns 413. The pre-existing `Content-Length`
   pre-check is kept for the cheap fail-fast path.

3. **Support both raw and multipart bodies.** The admin frontend still
   uses raw `application/octet-stream` PUT (no breaking change). New
   clients that prefer `multipart/form-data` can send a `file` part;
   the route uses the request's `Content-Type` to dispatch. Both paths
   share the same streaming R2 writer.

4. **EPUB validation is best-effort for very large files.** For uploads
   > 25 MB, validation is skipped on the streaming path and recorded as
   a warning in the response. Small files (≤ 25 MB) are still fully
   validated with `validateEpub(arrayBuffer)` to keep the existing
   contract intact. This preserves memory safety while keeping fast
   feedback for the common small-file case.

5. **Edge cache the public catalog.** The catalog handler is wrapped in
   a helper that:
   - Builds a `cacheKey` Request derived from the catalog URL and
     `Accept-Language` header.
   - Calls `caches.default.match(cacheKey)`. On hit, returns the cached
     response with the original `Cache-Control` header preserved.
   - On miss, runs the handler, then `caches.default.put(cacheKey, resp)`
     in the background (`c.executionCtx.waitUntil`).

6. **Cache headers per route, not a global default.** Keep
   `responses.ts` `no-store` for auth and admin paths. The catalog
   explicitly opts in to `public, max-age=60, s-maxage=300,
   stale-while-revalidate=86400`. This avoids accidentally caching
   user-specific or admin responses.

## Consequences

### Positive

- Worker memory stays bounded regardless of upload size.
- Public catalog latency drops from ~RTT-to-Turso to a few ms on
  warm cache; Turso load drops proportionally.
- The 200 MB cap is enforced both declaratively (pre-check) and
  defensively (stream abort).
- Edge cache degrades gracefully — origin errors are still returned
  on miss; `waitUntil` errors are swallowed.

### Negative / cost

- The edge cache adds one `caches.default` call per request (sub-ms).
- The size cap is a constant — changing it requires a code change.
- The best-effort validation warning for large files must be documented
  in admin UI to avoid surprising admins when validation results
  diverge from the small-file case.

## Compliance

- AGENTS.md TIER-1 "MUST guard every regex" — no new regex added.
- AGENTS.md TIER-1 "MUST use static imports" — new helper imported
  statically.
- AGENTS.md TIER-2 rule 8 — issues documented as GOAP + ADR
  (`plans/112-goap-v12-stream-upload-edge-cache.md`).
- ADR-083 numbering — 112 is the next free ADR after 110.

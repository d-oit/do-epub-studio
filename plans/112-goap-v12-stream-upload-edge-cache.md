# GOAP — V12: Stream/Multipart Upload + Worker Edge Cache

**Date:** 2026-06-25
**Status:** ✅ COMPLETED (Plan 198 verified 2026-07-18 — merged via PR #649 `0f42e40`)
**Source plan:** `plans/110-goap-missing-impl-modern-ui-2026-06-24.md` T10
**Closes:** V12 (P2 perf)
**Branch:** `feat/v12-stream-upload-edge-cache`

## Analyze

`apps/worker/src/routes/admin/books.ts:78-90` buffers the full EPUB via
`arrayBuffer()` (up to 200 MB) before any R2 write happens. Memory spikes
on the Worker instance proportional to the largest concurrent upload.

`apps/worker/src/routes/catalog.ts` and `apps/worker/src/lib/responses.ts`
ship `Cache-Control: no-store` for every response, including the public
catalog. Repeated catalog hits on the edge re-run the SQL count + paginated
SELECT, even though the response is read-mostly.

## Decompose

| ID | Part | Action | Owner |
|----|------|--------|-------|
| T-A1 | A | Replace `arrayBuffer()` in `PUT /api/admin/books/:id/upload` with a streaming transform that pipes the request body through a size-guarded `TransformStream` to R2. | this |
| T-A2 | A | Optional `multipart/form-data` support for clients that need to bundle file + metadata. Plain `application/octet-stream` path remains. | this |
| T-A3 | A | Add 200 MB max-size guard via a `ByteCounter` TransformStream that aborts when exceeded. | this |
| T-A4 | A | Validate EPUB server-side by collecting the streamed body for small uploads (< 25 MB) and using a streaming hash for large ones; or skip post-R2 hash check on huge files and rely on `Content-Length` + size cap. | this |
| T-B1 | B | Add `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=86400` to `GET /api/catalog` via a header helper. | this |
| T-B2 | B | Use `caches.default.match()` short-circuit before Turso; on miss, run the handler then `caches.default.put()`. Key derived from URL + `Accept-Language`. | this |
| T-B3 | B | Add a `caches.default` mock + a test that proves the second call is served from cache. | this |

## Strategize

Hybrid: A (sequential, one file) and B (sequential, one file) merged into
a single PR per plan 110 ADR-110 rule 5 ("independently shippable"). Both
share `app.ts` only as a no-op (B mounts the cache middleware in the
catalog router, not at the app level).

## Quality gates

- `pnpm --filter @do-epub-studio/worker typecheck` clean.
- `pnpm --filter @do-epub-studio/worker lint` clean.
- `pnpm --filter @do-epub-studio/worker test:unit -- --run` passes,
  including the new streaming + cache tests.
- Coverage thresholds in `apps/worker/vitest.config.ts` respected.

## Pre-existing issues fixed in this PR

- None in scope; pre-existing TIER-1 V1 (grant session revoke) is closed by
  `d2b3cbf` / T1 in plan 110. Codacy findings on the touched files are
  addressed in the same change set per AGENTS.md TIER-1 rule.

## Compliance

- AGENTS.md TIER-1 "MUST guard every regex against untrusted input" — no new
  regex; the only `match()` is in `validateEpub` (unchanged).
- AGENTS.md TIER-1 "MUST use static imports" — `import multipartParser` style.
- AGENTS.md TIER-2 rule 8 — issues documented as GOAP + ADR (this file).

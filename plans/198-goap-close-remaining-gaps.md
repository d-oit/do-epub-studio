# Plan 198: GOAP — Close Remaining Gaps & P3 Feature Plans

**Status:** 🔄 IN PROGRESS
**Date:** 2026-07-18
**Decision:** [ADR-187](187-adr-fail-closed-engineering-gates.md)
**Strategy:** Swarm — independent tasks executed in parallel

## Goal

Close the remaining actionable gaps from Plans 105/110/197 (S2 scroll-driven
progress bar, stale plan status updates) and create GOAP plans for the remaining
P3 feature backlog (N3, N6, N7, F3, LC1) from Plan 121.

## Audit Results (2026-07-18)

### Plans Verified as NOW DONE (status needed updating)

| Plan | Claimed Status | Verified Status | Evidence |
|------|---------------|----------------|----------|
| 112 (CI Hardening) | IN PROGRESS | ✅ COMPLETED | PR #650 (`7862146`) — bundle budget + impeccable wiring |
| 112-V12 (Stream Upload) | IN PROGRESS | ✅ COMPLETED | PR #649 (`0f42e40`) — streaming upload + edge cache |
| 122 (CSP + Fonts) | ACTIVE | ✅ COMPLETED | PR #748 — CSP Level 3 + self-hosted fonts |
| 124 (Markdownlint) | SHIPPING | ✅ COMPLETED | PR #749 (`7bfc960`) — 14 violations fixed |
| 197 (Storybook) | IN PROGRESS | ✅ COMPLETED | PR #816 (`9ffaacd`) — 5 stories + stale closures |

### V5 Audit — Typed Errors + Log Redaction

| Component | Status | Evidence |
|-----------|--------|----------|
| `redact.ts` scrubber | ✅ EXISTS | `apps/worker/src/lib/redact.ts` — email, bearer, token, sensitive-key redaction |
| `observability.ts` integration | ✅ EXISTS | `observability.ts:49` — `scrub(payload)` called on every log entry |
| `app.ts` global error handler | ✅ EXISTS | `app.ts:71-72` — `toApiError(err)` + `isAppError(err)` for status |
| Shared error types | ✅ EXISTS | `packages/shared/src/errors.ts` — AppError, ValidationError, NotFoundError, etc. |
| Route-level typed errors | ⏳ OPTIONAL | Routes use inline `c.json({ ok: false, error: {...} })` — acceptable Hono pattern |

**V5 conclusion:** The log-redaction layer exists and is integrated. Typed errors
are available and used by the global error handler. Route-level adoption is optional
and would be a refactor, not a gap closure.

### V13 Audit — ReDoS Policy + HSTS

| Component | Status | Evidence |
|-----------|--------|----------|
| epub-validator ReDoS | ✅ DONE | `epub-validator.ts:2` — imports `matchBounded` from safe-regex |
| File response HSTS | ✅ DONE | `security-headers.ts:47` — `minimalSecurityHeaders` includes HSTS |
| Pages `_headers` HSTS | ✅ DONE | `_headers:9` — `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` |
| Security headers middleware | ✅ DONE | `security-headers.ts:6-11` — file routes get `minimalSecurityHeaders` |

**V13 conclusion:** All ReDoS and HSTS gaps are already addressed.

### BooksPage Refactor Audit

| Metric | Status | Evidence |
|--------|--------|----------|
| Line count | ✅ 423 LOC | `wc -l BooksPage.tsx` — under 500 LOC limit |

**BooksPage conclusion:** Already under the 500 LOC cap. No refactor needed.

## Tasks

### T1: S2 — Scroll-driven progress bar (P2)
- Add `animation-timeline: scroll()` CSS to `globals.css`
- Create `ScrollProgressBar` component with `@supports` + `prefers-reduced-motion` guard
- Integrate into `ReaderPage.tsx`

### T2: Update stale plan statuses (P1)
- Plans 112, 112-V12, 122, 124: mark COMPLETED with evidence

### T3: Create P3 feature GOAP plans (P2)
- N3: Server-side full-text EPUB search
- N6: EPUB re-export / packager
- N7: Comment reply notifications
- F3: Cross-isolate cache invalidation
- LC1: API rate limiting per tenant

### T4: Create Plan 198 ADR (P1)
- Document the verified-closure methodology for stale plans

## Acceptance Criteria

- [x] Scroll-driven progress bar CSS exists in globals.css
- [x] ScrollProgressBar component created and integrated in ReaderPage
- [x] Stale plans updated to COMPLETED with evidence
- [x] P3 feature GOAP plans created in plans/
- [x] Plan 198 ADR created
- [x] `pnpm lint` passes
- [x] `pnpm typecheck` passes (7/7)
- [x] `pnpm test:unit` passes
- [x] `pnpm build` passes

## Execution Strategy

**Swarm** — all 4 tasks are independent and executed in parallel.

| Task | Agent Type | Dependencies |
|------|-----------|-------------|
| T1 (S2) | reader-ui-ux | None |
| T2 (stale) | goap-agent | None |
| T3 (P3 plans) | goap-agent | None |
| T4 (ADR) | goap-agent | None |

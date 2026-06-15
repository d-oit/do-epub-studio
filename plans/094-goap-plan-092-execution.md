# GOAP 094 — Phase B: Plan #092 Resolution (T1, T2, T3, T5, T6)

**Date:** 2026-06-14
**Status:** ✅ EXECUTED — PR #527 merged, post-merge main CI green
**Branch:** `feat/plan-092-resolution` (deleted after squash-merge)
**PR:** https://github.com/d-oit/do-epub-studio/pull/527
**Merge commit:** `e62a2cb` on `main`
**Predecessor plans:** #092 (analysis), #093 (Phase A — T4)
**Methodology:** GOAP (analyze → decompose → strategize → coordinate → execute → synthesize)

## Goal (GOAP)

Resolve the remaining open items from plan #092: T1, T2, T3, T5, T6
(T4 was already shipped via PR #525 in Phase A). All five
deliverables land on a single feature branch via a hybrid
strategy: documentation streams and a worker contract change
landed together as one atomic commit after parallel sub-stream
work.

## Baseline (Analyze)

At the start of Phase B, main was at `f280ecd` (post Phase A).
The plan-092 backlog contained 6 items (T1–T6); T4 was done in
Phase A, leaving T1, T2, T3, T5, T6.

| Item | Type | Source | Status at start |
|------|------|--------|------------------|
| T1 | CSP audit + record | plan #092 | Open (verify) |
| T2 | CSRF-N/A policy record | plan #092 | Open (doc) |
| T3 | Proactive session expiry | plan #092 | Open (impl) |
| T5 | External telemetry contract | plan #092 | Open (doc) |
| T6 | Signed-URL `fileSize`/`mimeType` | plan #092 | Open (impl) |

## Decomposition (tasks)

| ID | Task | Type | Status |
|----|------|------|--------|
| T1 | Audit `apps/web/public/_headers` against ADR-035; record result | Security/doc | ✅ |
| T2 | Document CSRF-N/A decision in `docs/security-posture.md` | Doc | ✅ |
| T3 | Worker: extend `createSession` to return `expiresAt`; client: add `sessionExpiresAt` to auth store; add `useSessionExpiry` hook | Impl | ✅ |
| T5 | Add `docs/observability-telemetry.md` capturing the `VITE_TELEMETRY_ENDPOINT` contract | Doc | ✅ |
| T6 | Add R2 `head` to `generateSignedUrl`; in-process LRU cache; populate real `fileSize`/`mimeType` | Impl | ✅ |

## Strategy (Strategize)

- **Hybrid strategy:** A1 (worker session contract) and B1
  (client session contract) must land together — the client
  cannot read `expiresAt` if the worker doesn't return it. B2
  (R2 head) is independent of A1. A2 (docs) and B2 are also
  independent.
- **One atomic PR:** the user requested a single PR for the
  swarm; disjoint file paths (worker vs web vs docs) make
  conflicts unlikely. The whole change set is logically a
  single feature ("apply plan-092") so a single commit is
  coherent.
- **Risk:** T6 latency regression from the extra R2 `head`
  per signed URL. Mitigation: in-process LRU (max 200 entries,
  TTL = signed-URL expiry 1h). Documented in the PR body.
- **Risk:** T3 logout-mid-action losing unsaved input. Mitigation:
  the hook only fires `logout()` on the `expired` state, which
  the server itself has just enforced. In-progress editors are
  not the hook's responsibility; the forced logout already
  happens on `401` via the existing `handleUnauthorized`
  handler.

## Coordination (Execution)

### Branch

- Worktree branch: `feat/plan-092-resolution`
- Base: `main @ f280ecd` (post Phase A, post plan-093 doc)

### Commit plan

| Commit | Purpose |
|--------|---------|
| `d153907` | Main change: T1 + T2 + T3 + T5 + T6 + new docs |
| `f8ffc38` | Codacy remediation: 3 findings (2 medium + 1 high) on session-expiry hook |

### Files changed

- `apps/web/src/hooks/useSessionExpiry.ts` (new, 167 lines)
- `apps/web/src/hooks/useSessionExpiry.test.ts` (new, 89 lines)
- `apps/web/src/stores/auth.ts` (+ sessionExpiresAt, refreshSession)
- `apps/web/src/features/auth/LoginPage.tsx` (pass expiresAt)
- `apps/web/src/App.tsx` (mount useSessionExpiry globally)
- `apps/web/src/i18n/{en,de,fr}.ts` (3 new keys each)
- `apps/worker/src/auth/session.ts` (createSession returns CreatedSession)
- `apps/worker/src/routes/access.ts` (return expiresAt in 3 places)
- `apps/worker/src/storage/signed-url.ts` (R2 head + LRU cache)
- `apps/worker/src/__tests__/{routes.access,recovery,signed-url}.test.ts` (mock updates + new test file)
- `docs/security-posture.md` (new, 130 lines)
- `docs/observability-telemetry.md` (new, 100 lines)
- `docs/security.md` (cross-link)
- `README.md` (cross-links)

### Codacy remediation (round 1)

| Finding | Severity | Fix |
|---------|----------|-----|
| `setInterval(() => setNow(...))` | Medium | Wrap arrow in braces |
| `return () => clearInterval(id)` | Medium | Wrap arrow in braces |
| `if (res?.sessionToken)` on non-nullish | High | Drop `?.` |

After the 3-line fix in commit `f8ffc38`, Codacy re-ran the
analysis: **0 new issues** on the PR diff.

## Risks and how they were resolved

- **T6 latency regression:** in-process LRU cache bounded at
  200 entries, TTL = signed-URL expiry. First call: 1 R2 `head`;
  subsequent calls: O(1) cache lookup.
- **T3 logout-mid-action:** the hook only logs out on the
  `expired` state, which the server has already enforced. The
  existing `api.ts:handleUnauthorized` path still covers the
  server-initiated 401 case independently.
- **CSP audit false negative:** CSP `script-src` is now confirmed
  strict per ADR-035. The audit outcome is recorded in
  `docs/security-posture.md` so future audits see the standing
  decision and don't re-litigate.
- **Telemetry contract drift:** `docs/observability-telemetry.md`
  pins the contract: external by default; opt-in to a worker
  route only if all 4 conditions (auth, rate limit, validation,
  no secrets) are met.
- **Coverage:** worker coverage threshold (55/50) still met
  (136 tests, +4 from signed-url test). Web coverage (55/48)
  still met (284 tests, +5 from useSessionExpiry test).
- **Codacy strict-zero policy:** the project gates on
  `quality_gate.sh` and Codacy `isUpToStandards`. Both green
  at the merged commit.

## Quality Gates

- `./scripts/quality_gate.sh` — all green at every commit
  (lint, typecheck, 284 web unit tests, 136 worker unit tests,
  coverage, build, e2e smoke, workflow validation, skill
  validation, skill frontmatter, markdownlint, actionlint,
  zizmor, agent adapter checks).
- 16/16 active PR checks green; 4 expected skips (schedule,
  performance-report-PR-only, notify-on-failure, dependabot-
  auto-merge, scheduled-cross-browser-E2E).
- Post-merge `main @ e62a2cb` CI: SUCCESS (verified).

## Synthesis (Results)

| Metric | Value |
|--------|-------|
| PRs opened | 1 (PR #527) |
| PRs merged | 1 (squash-merge to `main` at `e62a2cb`) |
| Branches deleted | 1 (`feat/plan-092-resolution`) |
| Files changed | 18 (4 new, 14 modifications) |
| Lines changed (cumulative across 2 commits) | +728/-160 |
| New unit tests | 9 (5 hook, 4 signed-url) |
| Codacy findings | 3 → 0 across 1 fix commit |
| Plan-092 items closed | 5 of 6 (T1, T2, T3, T5, T6) |
| Local quality gate | PASS at every commit |
| PR CI run | 16/16 active checks green |
| Post-merge main CI | SUCCESS |

### CI checks that passed on the merged commit (e62a2cb)

- Path-based change detection, Setup & Diagnostics, Pre-commit
  Hooks, Typecheck, Lint, Unit Tests, Build, E2E Smoke Tests,
  Benchmark, Performance Report, CodeQL Alert Check, CodeQL
  (Analyze javascript-typescript), Dependency Vulnerability
  Scan, Lighthouse audit, Codacy Static Code Analysis, Cloudflare
  Pages, PR Labeler.
- Expected skips: Scheduled Cross-browser E2E (schedule-only),
  Notify on failure (failure-only), Auto-merge minor/patch
  (Dependabot-only), Close resolved CI failure issues (no open
  CI failures).

### Verification matrix

| Capability | Verified by |
|------------|-------------|
| Worker `createSession` returns `{ token, expiresAt }` | routes.access.test.ts, recovery.test.ts |
| Refresh route returns `expiresAt` | routes.access.test.ts |
| Web auth store persists `sessionExpiresAt` | stores.test.ts (unchanged) |
| `useSessionExpiry` state machine | useSessionExpiry.test.ts (5 tests) |
| R2 `head` populates `fileSize`/`mimeType` | signed-url.test.ts (4 tests) |
| LRU cache hits on second call | signed-url.test.ts |
| R2-down fallback | signed-url.test.ts |
| CSP `script-src` strict (no `unsafe-inline`) | docs/security-posture.md (recorded) |
| CSRF-N/A decision recorded | docs/security-posture.md |
| Telemetry external-by-default contract | docs/observability-telemetry.md |

## Cross-references

- GOAP #092 (backlog/analysis) — `plans/092-goap-codebase-improvements-analysis-2026-06-14.md`
- ADR-092 (policy) — `plans/092-adr-token-storage-and-feature-gap-policy.md`
- GOAP #093 (Phase A: T4) — `plans/093-goap-phase-a-jules-in-book-search.md`
- ADR-034 (bounded regex) — `plans/034-adr-security-redos-hardening.md`
- ADR-035 (CSP) — `plans/035-adr-content-security-policy.md`
- `secure-invite-and-access` skill — applied to T3 implementation
- `cloudflare-worker-api` skill — applied to T6 implementation
- `do-web-doc-resolver` skill — applied to T2/T5 documentation

## Follow-up

- Plan #092 is now **fully closed**: all 6 items (T1–T6) shipped.
- The session-expiry hook emits `session-expiring`,
  `session-refreshed`, `session-refresh-failed`, and
  `session-expired` telemetry events; these are buffered
  client-side and flushed only when `VITE_TELEMETRY_ENDPOINT` is
  configured (per ADR-092 D3 and the new observability doc).
- The signed-URL LRU is in-process and per-worker-instance. If
  the worker scales to many isolates, each will warm its own
  cache; this is acceptable because R2 `head` is cheap (no
  data transfer) and the cache TTL matches the signed-URL
  expiry.
- No further plan is required from #092.

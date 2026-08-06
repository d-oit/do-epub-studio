# GOAP 215: All-Dimension Audit Recommendations (Compact Backlog)

**Date:** 2026-08-03
**Status:** Proposed
**Decision:** [ADR-215](215-adr-audit-wave-2026-08-03-execution-policy.md)
**Goal:** Consolidate the fresh 2026-08-03 audit — security, performance,
lint/build/test best practices, i18n, new features, responsive UI/UX, test
pyramid, harness, global error handling with tracing, and email sending —
into one compact prioritized backlog that extends Plan 214 without
duplicating it.

**Related:** Plan 212, Plan 213, Plan 214, ADR-092, ADR-199, ADR-212, ADR-214

## 1. Analysis

### Method

Static audit of `apps/web`, `apps/worker`, `packages/*`, root quality config,
CI workflows, and `docs/`, fanned out across three focus areas:
structure/conventions, security/observability/email/performance, and
tests/build/i18n/UI. Scope is planning-only: this change touches `plans/`
exclusively, matching Plan 214's method.

### Relationship to Plan 214

Carried-over items keep their Plan 214 IDs (`R1`–`R12`). Newly evidenced
findings get `N` IDs. No completed plan is reopened (ADR-214 Decision 5).

### Confirmed strengths (no action needed)

| Area | Evidence |
| --- | --- |
| Auth/sessions | Argon2id (64 MiB, 3 iter), hashed session tokens, rotation, lockout — `apps/worker/src/auth/*` |
| Content security | `sanitizeEpubDocument` allowlist + content hooks, iframe `sandbox: ['allow-same-origin']`, strict CSP, archive validator — `packages/reader-core/src/sanitizer.ts`, `archive-validator.ts` |
| Regex safety | `matchBounded`/`testBounded` at all untrusted-input sites (ADR-034) |
| Error handling | Root `ErrorBoundary` + global `error`/`unhandledrejection` handlers, Worker `app.onError` + observability middleware, traceId surfaced to users |
| Tracing | traceId/spanId propagation (W3C traceparent shape), Sentry web + worker, redacted structured logs (`redact.ts`) |
| PWA/caching | Per-route-class Workbox strategies, encrypted IndexedDB (AES-GCM), edge cache + signed-URL LRU cache |
| i18n coverage | 13 locales with key-parity tests, RTL wiring, `i18next/no-literal-string` enforced |
| Responsive base | Container queries, OKLCH tokens, 3 themes, reduced-motion, safe-area insets, `@mobile` E2E tag |

## 2. Recommendations

| ID | Pri | Area | Recommendation | Evidence / ref |
| --- | --- | --- | --- | --- |
| R1 | P0/private | Security/email | Private triage of email transport logging and recovery-link token/PII handling before public changes | 214-R1 |
| R2 | P1 | Tracing | Bound/validate inbound trace-span headers; mint server-side IDs | 214-R2 |
| R3 | P1 | Tracing | Background logs inherit request context where a request exists | 214-R3 |
| R4 | P1 | Test harness | Resolve Vitest pool policy; add a mobile project to PR smoke | 214-R4 |
| R5 | P1 | Performance | One enforced budget model across bundle, route, and Lighthouse configs | 214-R5 |
| R6 | P1 | Build | Replace `readFileSync` of `VERSION` with a static import in `apps/web/vite.config.ts` | 214-R6 |
| R7 | P1 | Harness | Service-worker-enabled `pwa-chromium` E2E lane | 214-R7 |
| R8 | P1 | i18n | Formatting depth (placeholders, Intl dates) + RTL viewport verification | 214-R8 |
| R9 | P1 | UI/UX | Responsive viewport regression matrix (320–1440 + landscape, LTR/RTL) | 214-R9 |
| R10 | P2 | Features | Align reading-insights claims with capability; admin aggregation after privacy review | 214-R10 |
| R11 | P2 | Tests | Split >500-line test files; move repeated setup into testkit builders | 214-R11 |
| R12 | P2 | Email ops | Delivery health signal, retry/bounce policy, redacted observability | 214-R12 |
| N1 | P1 | Lint/security | Codacy excludes `apps/**` and `packages/**` — point static analysis at app source or document it as advisory with an alternative gate | `.codacy.yml` |
| N2 | P2 | Test pyramid | No integration layer between unit and E2E — add worker-route (miniflare or handler-level with real schema validation) or MSW-backed slice; grow testkit builder tests (1 today) | `apps/tests/fixtures.ts`, `packages/testkit` |
| N3 | P2 | Email/features | Grants are created without any invite email (credentials travel out-of-band); add invite email + minimal token-safe transactional templates | `apps/worker/src/auth/password.ts` (`createGrant`) |
| N4 | P2 | i18n/perf | All 13 locale modules are statically bundled — lazy-load per locale; add missing `Intl.NumberFormat` helper | `apps/web/src/i18n/*` |
| N5 | P2 | Docs | Stale "RTL planned but not implemented" claim; no telemetry retention runbook | `docs/accessibility.md`, `docs/observability-telemetry.md` |
| N6 | P3 | UI/UX | Page-level skeletons (spinner-only today), centralized keyboard shortcuts, app-level Storybook | `PageLoadingFallback.tsx`, `packages/ui` stories |
| N7 | P3 | Tracing | Evaluate OpenTelemetry adoption vs custom traceparent (decision goes to a follow-up ADR) | `packages/shared/src/telemetry.ts` |
| N8 | P3 | Security | Reaffirm accepted risks: localStorage token storage + CSRF-not-applicable under ADR-092; documentation-only | `docs/security-posture.md` |

## 3. Decomposition — Waves

### Wave 0: Private gate

| Task | Finding | Priority |
| --- | --- | --- |
| T0.1 Private email/token triage record | R1 | P0 |

### Wave 1: Foundations (parallel)

| Task | Finding | Deps | Priority |
| --- | --- | --- | --- |
| T1.1 Trace header validation | R2 | none | P1 |
| T1.2 Background log request context | R3 | none | P1 |
| T1.3 Static analysis over app source | N1 | none | P1 |
| T1.4 Budget model consolidation | R5 | none | P1 |
| T1.5 `VERSION` static import | R6 | none | P1 |

### Wave 2: Harness depth (parallel)

| Task | Finding | Deps | Priority |
| --- | --- | --- | --- |
| T2.1 Vitest pool decision + mobile PR smoke | R4 | none | P1 |
| T2.2 PWA service-worker E2E lane | R7 | T2.1 | P1 |
| T2.3 i18n formatting depth + lazy locales | R8, N4 | none | P1/P2 |
| T2.4 Viewport regression matrix | R9 | none | P1 |
| T2.5 Integration test slice + testkit growth | N2, R11 | T2.1 | P2 |

### Wave 3: Product and email expansion

| Task | Finding | Deps | Priority |
| --- | --- | --- | --- |
| T3.1 Email delivery ops (health/retry/bounce) | R12 | T0.1 | P2 |
| T3.2 Invite emails + transactional templates | N3 | T0.1, T3.1 | P2 |
| T3.3 Insights alignment + admin aggregation | R10 | none | P2 |
| T3.4 Docs fixes + telemetry retention runbook | N5 | none | P2 |

### Backlog (unscheduled)

N6 (UI polish bundle), N7 (OTel evaluation), N8 (accepted-risk reaffirmation).

## 4. Execution Strategy

Risk-first hybrid per ADR-212/ADR-214: Wave 0 private gate → Wave 1
foundations in parallel → Wave 2 harness depth → Wave 3 product/email
expansion. One PR per logical change; each PR passes
`./scripts/quality_gate.sh` and updates `plans/` records in the same commit.

## 5. Acceptance Criteria

- [ ] Every R/N ID above has an implementation PR, an accepted-risk ADR, or an
      evidence-based rejection.
- [ ] R1/N3 email work ships only after the private triage (T0.1) closes.
- [ ] `node scripts/check-adr-index.mjs` and markdownlint pass on `plans/`.
- [x] ~~This plan's own PR contains no source changes (plans-only scope).~~
      Superseded: Plans 214/215 ship in the Wave 1–3 execution PR
      (GOAP-216) at maintainer request — governance records land with
      the remediation they govern.

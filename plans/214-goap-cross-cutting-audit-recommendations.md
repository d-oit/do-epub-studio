# GOAP 214: Cross-Cutting Audit Recommendations

**Date:** 2026-08-03
**Status:** Completed (non-gated recommendations via GOAP-216; R1/R12 remain gated behind private email triage per ADR-214 D4)
**Decision:** [ADR-214](214-adr-audit-recommendation-governance.md)
**Goal:** Convert the current codebase audit into a compact, testable backlog
for security, performance, lint/build/test, i18n, product features, responsive
UI/UX, test harness, tracing, and email sending.

## 1. Method

Static review covered active source under `apps/`, `packages/`, root quality
configuration, CI workflows, existing plans 212-213, product docs, and current
test harnesses.

Validation run during the audit:

- `git fetch origin main` and `git merge origin/main`: already up to date.
- `./scripts/minimal_quality_gate.sh`: passed lint, typecheck, shellcheck.
- `pnpm audit --audit-level moderate`: no known vulnerabilities found.

Full coverage, build, Playwright, Codacy, and Lighthouse were not run because
this change intentionally updates only `plans/`.

## 2. Executive Priorities

| ID  | Priority   | Area             | Recommendation                                                                                                 |
| --- | ---------- | ---------------- | -------------------------------------------------------------------------------------------------------------- |
| R1  | P0/private | Security/email   | Privately triage email transport logging and token/PII handling before changing public behavior.               |
| R2  | P1         | Tracing/security | Bound and validate inbound trace/span headers before echoing them.                                             |
| R3  | P1         | Error handling   | Let background logs inherit request context where a request exists.                                            |
| R4  | P1         | Test harness     | Reconcile Vitest pool policy and run mobile smoke in PR CI.                                                    |
| R5  | P1         | Performance      | Consolidate bundle, route, and Lighthouse budgets into one enforced model.                                     |
| R6  | P1         | Build/lint       | Replace Vite config `readFileSync` of `VERSION` with a bundler-safe static import.                             |
| R7  | P1         | PWA/test harness | Add a service-worker-enabled E2E lane for offline/PWA behavior.                                                |
| R8  | P1         | i18n             | Upgrade formatting and RTL verification beyond key parity.                                                     |
| R9  | P1         | UI/UX            | Enforce full viewport, text overflow, and horizontal-scroll regression checks.                                 |
| R10 | P2         | Product          | Align reading insights and magic-link claims with implemented capability, then add the missing feature slices. |
| R11 | P2         | Maintainability  | Split oversized test files and move repeated setup into testkit/builders.                                      |
| R12 | P2         | Email ops        | Add delivery observability, retry/bounce policy, and admin-facing health checks for real email sending.        |

## 3. Findings and Remediation Units

### R1: Email Transport Privacy and Recovery Links

**Evidence:** `apps/worker/src/lib/email-transport.ts`,
`apps/worker/src/routes/access.ts`, `apps/worker/src/routes/admin/auth.ts`.

**Finding:** Recovery and admin recovery email flows exist, with a fallback
transport for environments without the Cloudflare Email Sending binding. The
public remediation must not expose token, recipient, or message-body details.

**Smallest remediation:** Create a private security triage record for fallback
logging, recovery URL handling, sender verification, and email audit payloads.
After classification, implement redacted delivery events, no token-bearing
message previews, request trace propagation, and tests.

**Acceptance:** Recovery email tests prove no token material or raw recipient
PII is logged; failed sends are observable; successful sends retain a redacted
audit trail; behavior remains enumeration-resistant.

### R2: Inbound Trace Header Validation

**Evidence:** `apps/worker/src/lib/observability.ts`.

**Finding:** Request context accepts inbound trace/span IDs and later echoes
them in response headers. The IDs should be treated as client-controlled input.

**Smallest remediation:** Add bounded charset/length validation. Preserve
invalid client IDs only as scrubbed metadata and mint a server trace ID for
authoritative correlation.

**Acceptance:** Unit tests cover missing, valid, overlong, and invalid IDs;
response headers always contain server-valid IDs; logs keep a separate
client-provided correlation field when useful.

### R3: Background Log Trace Continuity

**Evidence:** `logAppInfo`, `logAppWarn`, `logAppError` in
`apps/worker/src/lib/observability.ts`; email and telemetry ingestion callers.

**Finding:** Background helpers mint new trace IDs even when called from a
request path, which fragments email, telemetry persistence, and audit
correlation.

**Smallest remediation:** Add optional `RequestContext` to background logging
helpers and route request-scoped background work through it.

**Acceptance:** Email send, telemetry receive, audit waitUntil, and cache
invalidation logs correlate to the initiating request trace when available.

### R4: Test Pyramid and CI Harness Drift

**Evidence:** `apps/web/vitest.config.ts`, `playwright.config.ts`,
`.github/workflows/ci.yml`.

**Finding:** Web Vitest uses `pool: 'threads'` while repo guidance requires
fork isolation. PR smoke runs desktop Chromium/WebKit only, while mobile
projects are defined but not selected in the smoke command.

**Smallest remediation:** Decide whether web can explicitly supersede the forks
policy with evidence, or switch to forks. Add at least one mobile project to PR
smoke and keep full cross-browser E2E scheduled.

**Acceptance:** CI output proves unit isolation policy, PR smoke includes a
real mobile viewport, and full E2E remains a deeper scheduled/workflow-dispatch
gate.

### R5: Performance Budget Drift

**Evidence:** `.performance-budgets.json`, `.lighthouserc.json`,
`scripts/check-bundle-size.mjs`, `scripts/check-bundle-budget.mjs`,
`.github/workflows/lighthouse.yml`, `docs/lighthouse.md`.

**Finding:** Raw-byte and gzipped bundle budgets overlap but differ. Lighthouse
targets `/reader` and `/auth`, while the app routes are `/read/:bookSlug` and
`/login`. The route budget config references an admin entry that does not match
the current admin route component.

**Smallest remediation:** Make one budget source authoritative, update route
entries to real components/routes, and give LHCI an auth/fixture script for
protected reader/admin routes.

**Acceptance:** Bundle, route-aware, startup, and LHCI reports use the same
route names and fail closed on budget violations for catalog, admin, auth,
reader, and offline routes.

### R6: Config Read Best Practice

**Evidence:** `apps/web/vite.config.ts`.

**Finding:** Vite reads root `VERSION` with `readFileSync`. Repo guidance says
bundled config should prefer static imports for repo-bundled assets to avoid
Codacy path-traversal findings.

**Smallest remediation:** Import `VERSION` through a supported static text/raw
import or generated typed module and remove the direct file read from Vite
config.

**Acceptance:** `pnpm lint`, Codacy Static Code Analysis, and web build pass
without non-literal filesystem findings.

### R7: Service Worker and PWA Harness Coverage

**Evidence:** `playwright.config.ts`, `apps/web/src/sw.ts`,
`apps/tests/pwa-strategies.spec.ts`, `apps/tests/offline-reader.spec.ts`.

**Finding:** Global Playwright config blocks service workers so route mocks are
stable. That is useful for most E2E tests, but it weakens confidence in actual
Workbox routing, background sync, and cache strategy behavior.

**Smallest remediation:** Add a dedicated `pwa-chromium` project with service
workers enabled and narrow it to PWA/offline specs that use preview mode and
controlled fixtures.

**Acceptance:** One PR or nightly lane verifies real service worker install,
cache routing, offline navigation, sync retry semantics, and no sensitive API
cache writes.

### R8: i18n Formatting and RTL Depth

**Evidence:** `apps/web/src/i18n/index.ts`, `apps/web/src/hooks/useDocumentLocale.ts`,
`apps/web/src/__tests__/i18n-parity.test.ts`, `apps/tests/i18n-e2e-helpers.ts`.

**Finding:** Catalog parity is strong across 13 locales, but formatting is
simple replacement, repeated placeholders are not guaranteed, plural/date/number
rules are not centralized, and E2E helper strings duplicate catalog values.
Arabic direction is wired but needs full viewport verification.

**Smallest remediation:** Introduce a typed formatting helper for repeated
placeholders, Intl date/number/plural formatting, and generate E2E fixture
strings from catalogs where possible.

**Acceptance:** Tests cover repeated placeholders, plural categories, date and
number formatting, Arabic `dir=rtl`, and no horizontal overflow in RTL mobile,
tablet, and desktop viewports.

### R9: Responsive UI/UX Coverage

**Evidence:** `apps/web/src/styles/globals.css`, `apps/tests/app-identity-responsive.spec.ts`,
`playwright.config.ts`, reader/admin/catalog route tests.

**Finding:** Container-query primitives exist, but viewport verification is
uneven. Login has explicit multi-width checks; reader, catalog, library, admin
grants, audit, notifications, and settings need the same no-overflow and text
fit matrix.

**Smallest remediation:** Add a reusable viewport harness covering 320, 375,
390, 768, 1024, 1440, and a landscape mobile size. Assert no horizontal scroll,
no clipped controls, visible focus, and usable overflow menus.

**Acceptance:** E2E responsive checks pass for core reader and admin workflows
in LTR and RTL, with screenshots retained on failure.

### R10: Product Feature Alignment

**Evidence:** `PRODUCT.md`, `docs/reading-insights.md`,
`apps/web/src/lib/offline/reading-insights.ts`,
`apps/worker/src/routes/reader/insights.ts`.

**Finding:** Product language promises chapter time and reading speed. Current
insights provide active minutes, pages, streaks, recent activity, and estimated
remaining time. Admin aggregation remains future work.

**Smallest remediation:** Either narrow product/docs wording to implemented
metrics or add chapter/time-speed semantics, then implement admin aggregation
after privacy boundaries are reaffirmed.

**Acceptance:** Reader insights display tested units; server buckets preserve
privacy boundaries; admin aggregation is paginated and does not expose raw
reader timelines.

### R11: Test Maintainability

**Evidence:** line-count scan found large tests including
`apps/web/src/features/admin/BooksPage.test.tsx`,
`apps/web/src/features/reader/components/annotations/AnnotationToolbar.test.tsx`,
`packages/schema/src/__tests__/schemas.test.ts`,
`apps/web/src/__tests__/offline-db.test.ts`, and
`apps/web/src/__tests__/reader-hooks.test.ts`.

**Finding:** Several test files exceed the 500-line policy, making failures
harder to isolate and encouraging repeated setup.

**Smallest remediation:** Split by behavior, move fixtures to testkit or local
builders, and keep source tests below the line target.

**Acceptance:** No first-party test file exceeds 500 lines unless an ADR grants
a scoped exception with owner and sunset criteria.

### R12: Email Delivery Operations

**Evidence:** `apps/worker/src/lib/email-transport.ts`,
`docs/runbooks/infrastructure-setup.md`.

**Finding:** Real delivery depends on Cloudflare Email Sending binding, while
fallback behavior is local/logging oriented. Operations need a clear health
signal, delivery failure mode, retry policy, and redacted observability.

**Smallest remediation:** Add a non-recipient health check or admin diagnostics
flow that verifies binding presence without sending secrets, and document retry
and bounce behavior.

**Acceptance:** Admin can distinguish "email disabled", "send failed", and
"accepted for delivery"; logs include trace ID and redacted message ID only.

## 4. Execution Strategy

Use a risk-first hybrid sequence:

1. Private gate: classify R1 before public email/logging changes.
2. Foundations: implement R2, R3, R4, R5, R6.
3. Harness depth: implement R7, R8, R9, R11.
4. Product/email expansion: implement R10 and R12 after privacy and tracing
   contracts are stable.

## 5. Definition of Done

- [ ] Each recommendation has an implementation PR, accepted-risk ADR, or
      evidence-based rejection.
- [ ] Security-sensitive email findings are triaged privately before public
      remediation detail is published.
- [ ] Minimal and full quality gates pass before implementation commits.
- [ ] Codacy Static Code Analysis is green for config, source, and tests.
- [ ] Responsive, RTL, service worker, and mobile smoke coverage are enforced
      in the agreed CI lane.
- [ ] Product docs and implemented feature behavior describe the same contract.

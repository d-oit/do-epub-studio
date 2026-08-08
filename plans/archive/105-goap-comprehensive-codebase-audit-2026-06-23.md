# GOAP 105 — Comprehensive Codebase Audit (Features, Security, Error Handling, Logging, Performance, Lint, Build)

**Date:** 2026-06-23
**Status:** ✅ COMPLETED (analysis resolved by Plans 110, 120, 186–198)
**Execution tracker:** consolidated & re-verified in `plans/110-goap-missing-impl-modern-ui-2026-06-24.md` (finding A5 now DONE)
**Author:** Analysis session 2026-06-23 (post plan 104 production-readiness closure)
**Branch (proposed):** `chore/audit-105` (each task ships as its own PR)
**Related ADR:** `plans/105-adr-error-handling-and-observability-completeness.md`
**Extends:** plan 091 (codebase improvements), plan 104 (production readiness), ADR-034 (ReDoS), ADR-067 (observability), ADR-035a (CSP)
**Methodology:** GOAP (analyze → decompose → strategize → coordinate → execute → synthesize)

## Goal

Re-audit the mature `d.o.EPUB Studio` codebase across seven dimensions —
missing features/implementation, security, global error handling, logging,
performance, lint best-practice, and build best-practice — and record a
verified, prioritized, independently-shippable remediation backlog. Every
finding below was confirmed by reading source at the cited `file:line`; false
positives surfaced during analysis are explicitly noted so they are not
re-investigated.

## Analyze — baseline

| Signal | Result |
|--------|--------|
| Stack | React 19 / Vite 8 / Hono Workers / Turso / R2 / Durable Objects |
| Non-test TS/TSX LOC | ~34.8k |
| Files > 500 LOC (Tier 3) | 0 (only generated `worker-configuration.d.ts`) |
| `TODO`/`FIXME`/`HACK` in prod source | 0 |
| Predecessor state | plan 104 merged (PR #624): identity/version governance, all swarm gaps G1–G28 closed |

The repository is in strong health. The findings below are **hardening and
completeness level** — none are release-blocking outages, but several are
genuine correctness, security-compliance, and observability gaps.

### Verified false positives (do NOT re-investigate)

- **Worker `wrangler` config is NOT missing.** `apps/worker/wrangler.jsonc`
  exists and declares `main`, `compatibility_date` (2026-05-30), R2 bucket,
  `RATE_LIMITER` Durable Object + migration, and `send_email`. An earlier
  pass that searched only for `wrangler.toml` reported a P0 deploy blocker;
  this is incorrect. The worker deploys via `wrangler deploy`, not turbo
  `build`, so the missing worker `build` script is by-design.

---

## Findings by dimension (verified)

### A. Missing features / incomplete implementation

| ID | Status | Sev | Evidence | Finding |
|----|--------|-----|----------|---------|
| A1 | MISSING | P1 | `apps/web/src/features/admin/AdminLoginPage.tsx:109-117`, `apps/web/src/App.tsx:119-148`, `apps/worker/src/routes/admin/auth.ts:79-160` | Admin login + recovery emails link to `/admin/recover?token=…`; Worker implements the recovery endpoints, but the web router has **no** `/admin/recover` route → the UI path 404s. |
| A2 | PARTIAL | P1 | `apps/web/src/lib/offline/sync.ts:185-203`, `apps/web/src/lib/offline/db.ts:15-28` | Offline annotation type includes `bookmark`, but sync treats every non-highlight as a comment, so a queued bookmark would POST to `/comments` (wrong endpoint / data shape). |
| A3 | PARTIAL | P1 | `apps/web/src/lib/offline/sync.ts:59-63`, `apps/web/src/lib/offline/db.ts:30-39` | Offline sync queue supports only `progress` + `annotation`; bookmarks and reading-insight buckets have local stores/routes but no first-class queue type. |
| A4 | PARTIAL | P1 | `apps/web/src/lib/offline/reading-insights.ts:1-5`, `apps/web/src/features/reader/hooks/useReadingTimer.ts:39-59`, `apps/worker/src/routes/reader/insights.ts:57-90` | Reading-insights sync bypasses the generic offline queue; on failure only a warning is logged, no retry item is enqueued → silent data loss offline. |
| A5 | PARTIAL | P2 | `apps/web/src/features/reader/ReaderPage.tsx:381-389`, `apps/web/src/features/reader/components/info/InfoPanel.tsx:90-224`, `useReadingTimer.ts:73-85` | `ReaderPage` never passes `getSummary` to `InfoPanel`; computed insights are not surfaced in the reader UI. |
| A6 | PARTIAL | P2 | `apps/web/src/features/reader/ReaderPage.tsx:175-188` | Offline reader fallback restores only `progress` from IndexedDB; cached annotations/highlights/comments/bookmarks are not restored into reader state. |
| A7 | STUB | P1 | `apps/worker/src/lib/email-transport.ts:14-23,46-50` | Magic-link email production fallback is `LoggingEmailTransport` (logs recipient/subject/preview) when `EMAIL_SEND` binding is absent → emails silently not sent. `wrangler.jsonc` defines `send_email`, so wire-up should be verified per-environment. |
| A8 | MISSING | P2 | only `apps/web/src/features/reader/hooks/useExportNotes.ts:41` found; no import route/UI | Annotation **import** is missing (export-only). Export at `useExportNotes.ts:15-43` also omits locator/CFI/chapter metadata, blocking round-trip. |
| A9 | PARTIAL | P2 | `apps/web/src/features/reader/hooks/useReaderSearch.ts:94-100` | Search chapter lookup calls `spine.get(result.cfi)`; `spine.get` resolves by href/index, not a CFI → chapter titles may be unreliable. |
| A10 | PARTIAL | P2 | `apps/tests/in-book-search.spec.ts:75-76` | In-book search E2E has no real EPUB fixture and asserts nothing about results/navigation → feature only lightly verified. |
| A11 | PARTIAL | P3 | `apps/worker/src/routes/admin/audit.ts:72-76` | `/api/admin/audit-logs` is only a 301 compatibility redirect, not a full endpoint. |
| A12 | STUB | P3 | `apps/web/src/components/VirtualList.tsx:13` | `VirtualList` documents variable-row-height as "not implemented" (acceptable simplification, tracked). |

### B. Security

| ID | Sev | Evidence | Finding |
|----|-----|----------|---------|
| B1 | **P1** | `apps/worker/src/routes/admin/grants.ts:72-99` (PATCH) vs `:112-124` (revoke) | **TIER-1 violation:** grant *updates* (`mode`, `comments_allowed`, `offline_allowed`, `expires_at`) do **not** revoke active `reader_sessions`; only explicit revoke does. AGENTS.md requires "revoke sessions immediately on grant change." A downgraded grant leaves elevated sessions live. |
| B2 | P2 | `packages/shared/src/epub-validator.ts:39-40,53-56` | Uploaded (untrusted) EPUB `container.xml` / OPF XML parsed with direct `.match()` instead of `matchBounded`/`testBounded` (ADR-034 ReDoS policy). |
| B3 | P2 | `apps/worker/src/routes/files.ts:52-57` + `apps/worker/src/middleware/security-headers.ts:7-14` | Signed file responses set their own CSP, which makes the global `applyMinimalSecurityHeaders` skip → file responses miss HSTS, XFO, Referrer-Policy, Permissions-Policy, COOP, CORP. |
| B4 | P3 | `packages/schema/src/locator.ts:41-52`, `packages/reader-core/src/reanchor.ts:160,172`, `reanchor.worker.ts:76,168`, `epub-accessibility.ts:34-35,63-64`, `fixed-layout.ts:22-24` | Several untrusted-input regex calls use direct `.match()` (some length-bounded) instead of the standardized bounded helpers. |
| B5 | P3 | `apps/web/public/_headers:2-7` | Web Pages `_headers` lacks `Strict-Transport-Security` (HSTS). |
| B6 | P3 | `apps/worker/src/routes/access.ts:200-213` | Logout/refresh extract token via `replace('Bearer ', '')`, not the stricter `parseAuthHeader` (`session.ts:93-96`); inconsistent header parsing. |
| B7 | P3 | `apps/web/vite.config.ts:11-16`, `apps/tests/app-identity-responsive.spec.ts:10-13` | `readFileSync` (and `readFileSync(new URL(...))` in tests) for repo-bundled `VERSION`/`app-identity.json` — the pattern AGENTS.md/Codacy flag; prefer static `import`. |
| B8 | P3 | `apps/worker/README.md:22` vs `apps/worker/src/lib/env.ts:2-4` | Doc drift: README lists `TURSO_DB_URL`/`JWT_SECRET`/`COOKIE_SECRET`; real env uses `TURSO_AUTH_TOKEN`/`SESSION_SIGNING_SECRET`/`INVITE_TOKEN_SECRET`. |

Verified-strong (no action): Argon2id hashing (`auth/password.ts:27-43`),
SHA-256 hashed bearer sessions (`auth/session.ts`), HMAC signed R2 URLs with
1h expiry (`storage/signed-url.ts`), restricted (non-wildcard) CORS
(`middleware/cors.ts:9-20`), IP+token rate limiting via DO
(`middleware/rate-limit.ts`, `lib/rate-limiter-do.ts`), broad Zod boundary
validation.

### C. Global error handling

| ID | Sev | Evidence | Finding |
|----|-----|----------|---------|
| C1 | P1 | `apps/worker/src/app.ts:21-27` (guard) before `:29` (observability) | The path-length guard returns `414` **before** observability middleware runs → no `traceId` in body, no request log, no trace headers. Violates "traceId on every Worker request." |
| C2 | P1 | `packages/shared/src/errors.ts:1-71` (defined) vs worker/web (unused) | Shared typed errors (`AppError`, `ValidationError`, `NotFoundError`, …, `toApiError`) exist but are **not used** in worker/web prod code; routes return ad-hoc JSON and the central catch maps everything to generic 500, losing typed status/code. |
| C3 | P1 | `apps/worker/src/routes/reader/insights.ts:86-89` | Route-level catch returns `500` without `traceId` in body and logs without trace context, bypassing the centralized pattern. |
| C4 | P2 | `apps/web/src/components/ErrorBoundary.tsx:36-45` + `apps/web/src/main.tsx:87-97` | Root passes `onCatch` that logs `ui.error-boundary` while the boundary also logs the same event → duplicate telemetry per render error. |
| C5 | P3 | `apps/worker/src/storage/signed-url.ts:51-64,153-156`, `apps/web/src/lib/client-logger.ts:41-50,95-100`, `apps/worker/src/middleware/validation.ts:15-33` | Several catches swallow failures with no telemetry; likely intentional resilience but no consistent policy. |

Verified-strong: worker central `observabilityMiddleware`
(`middleware/observability.ts:14-33`) converts unhandled errors to structured
500 + traceId; web `ErrorBoundary` + `window.error`/`unhandledrejection`
handlers (`main.tsx:28-124`); trace propagation in `lib/api.ts:50-57,155-164`.

### D. Logging / observability

| ID | Sev | Evidence | Finding |
|----|-----|----------|---------|
| D1 | P1 | `apps/worker/src/lib/observability.ts:93-108`, `packages/shared/src/telemetry.ts:38-50` | No redaction layer — worker logs serialize full error messages + stacks; risk of leaking secrets/PII/tokens carried in error text. |
| D2 | P1 | `apps/web/src/lib/client-logger.ts:1-12,68-79`, `ErrorBoundary.tsx:38-45`, `main.tsx:31-60` | Web telemetry emits arbitrary metadata + stacks to console / `VITE_TELEMETRY_ENDPOINT` with no scrubber. |
| D2b| P2 | `apps/web/src/features/reader/hooks/useReaderHandlers.ts:57-59,106-108`, `useAnnotationHandlers.ts:71-73,113-115`, `features/admin/GrantsPage.tsx:49-50` | Production UI catches use raw `console.error`, bypassing `logClientEvent` (no event name, trace IDs, buffering). |
| D2c| P2 | `apps/worker/src/lib/rate-limit-client.ts:43-46`, `lib/email-transport.ts:16`, `auth/admin-middleware.ts:100-109`, `routes/reader/insights.ts:87` | Worker has ad-hoc `console.*` outside `lib/observability.ts`; inconsistent structure, some missing trace IDs. |
| D3 | P2 | `apps/web/src/features/reader/hooks/useReaderSearch.ts:80-124`, `hooks/useSessionExpiry.ts:71,100,109,126,152` | Static pseudo trace IDs (`'reader-search'`, `'session'`) used for critical UI events instead of generated IDs → no per-event correlation. |
| D4 | P2 | `apps/web/src/lib/api.ts:171-175` vs `:76-145` | `apiRaw` propagates trace headers but logs nothing (no success/failure/network) → inconsistent client API telemetry vs `apiRequest`. |
| D5 | P3 | `apps/worker/src/lib/observability.ts:47-108`, `apps/web/src/lib/client-logger.ts:16-29` | No log sampling/rate control for high-volume request/client logs (web has level filter only). |

### E. Performance

| ID | Sev | Evidence | Finding |
|----|-----|----------|---------|
| E1 | P1 | `apps/worker/src/routes/admin/books.ts:78-90` | Large EPUB uploads fully buffered via `await c.req.raw.arrayBuffer()` despite 200 MB max + declared multipart constants → memory spikes. |
| E2 | P1 | `apps/worker/src/lib/responses.ts:11-14`; no `caches.default` usage found | All JSON helpers default to `Cache-Control: no-store`; no Worker Cache API use → read-mostly endpoints (catalog/metadata) uncached at the edge. |
| E3 | P2 | `packages/reader-core/src/reanchor-worker.ts:83-92` | Reanchoring sequentially preloads all unique TOC chapter contents before posting → costly/duplicated memory for large books. |
| E4 | P2 | `packages/reader-core/src/epub-parser-worker.ts:25-92` | Single global parser worker with unbounded `pending` map, no timeout/backpressure → stuck parses leak. |
| E5 | P2 | `apps/web/src/features/reader/components/search/SearchPanel.tsx:158-166` | Search results render with plain `.map()` (no virtualization) → jank on many matches. |
| E6 | P2 | `.lighthouserc.json:8,17-25` | Lighthouse perf gate is permissive (min 0.5, FCP/TTI warnings only) and desktop-only → weak mobile-regression gating. |
| E7 | P3 | `.performance-budgets.json:10-15` | Only the `reader` route has a budget; no catalog/admin/auth/offline budgets. |

Verified-strong: route-level `React.lazy` (`App.tsx:15-30`), manual chunk
strategy + bundle analyzer (`vite.config.ts:59-131`), `VirtualList` used by TOC,
reader-core `bench` script.

### F. Lint best-practice

| ID | Sev | Evidence | Finding |
|----|-----|----------|---------|
| F1 | P1 | per-package `eslint src …` (`apps/web/package.json:12`, `apps/worker/package.json:11`, all packages) | Local `pnpm lint` only lints `src`; root configs (`playwright.config.ts`, `vite.config.ts`, `vitest.config.ts`, root scripts) are **not** linted locally — only Codacy covers them (AGENTS.md note). Green local lint ≠ Codacy green. |
| F2 | P1 | `eslint.config.js:119-136` | Type-safety override disables `no-floating-promises`/`no-misused-promises` (+ unsafe rules) for `scripts/**` and `*.config.*` → unhandled-promise bugs can hide there. |
| F3 | P2 | `eslint.config.js:97,99` | `security/detect-object-injection` and `import/order` explicitly disabled despite plugins installed. |
| F4 | P2 | `eslint.config.js:66` | `no-console` is `warn` and allows `log` → production logs not blocked by lint (relates to D2b/D2c). |
| F5 | P2 | `eslint.config.js:68-70,93,101,103` | `exhaustive-deps`, `react-compiler`, `promise/catch-or-return`, `prefer-nullish-coalescing`, `prefer-regexp-exec` are warnings/off, not errors. |

Verified-strong: flat config + `typescript-eslint` type-checked
(`projectService: true`), strong safety rules for normal source
(`eslint.config.js:107-115`), security/promise/import-x/react/a11y/unicorn
plugins, Prettier + markdownlint + yamllint present.

### G. Build best-practice

| ID | Sev | Evidence | Finding |
|----|-----|----------|---------|
| G1 | P2 | `turbo.json:35` (`stats.html`) vs `apps/web/vite.config.ts:63` (`dist/stats.html`) | `build:analyze` declared output path mismatches actual visualizer output → cache miss/incorrect output capture. |
| G2 | P2 | `turbo.json:79-87` | `test:e2e.dependsOn` is only `["^build"]`; does not guarantee the app under test (`apps/web`) is built first. |
| G3 | P2 | `apps/web/vite.config.ts:75-131` | No explicit `build.target`/`minify`/`cssCodeSplit`/tree-shaking policy — relies on implicit Vite defaults. |
| G4 | P3 | `tsconfig.base.json:6,11` | `allowJs: true` + `skipLibCheck: true` in the shared base can hide migration debt / library type conflicts. |
| G5 | P3 | `.github/workflows/lighthouse.yml:62-70` vs `.lighthouserc.json:10-13` | LHCI workflow tests deployed `/reader` while config URLs are localhost dev → config drift. |
| G6 | P3 | `apps/worker/package.json` (no `build`); `turbo.json:12-25` build expects `dist/**` | Worker has no `build` script (by design — deploys via wrangler); turbo build over worker is a no-op. Confirm this is intentional and documented to avoid future confusion. |

Verified-strong: pinned `packageManager` + `--frozen-lockfile`, turbo global
deps for cache invalidation, declared task inputs/outputs, manifest emit,
production sourcemaps off, strict modern TS baseline
(`noUncheckedIndexedAccess`, `isolatedModules`, `moduleResolution: bundler`).

---

## Decompose & strategize — remediation backlog

Each item is atomic and independently shippable via its own feature branch +
PR, validated by `./scripts/quality_gate.sh`. Strategy: **hybrid** — P1
correctness/security in sequence first, P2/P3 hardening in parallel swarm.

### Phase 1 — P1 correctness & security (sequential, do first)

| Task | Closes | Area | Notes |
|------|--------|------|-------|
| T1 | B1 | security | Revoke `reader_sessions` inside the grant-PATCH transaction (mirror revoke logic) when capabilities/expiry tighten. **TIER-1 compliance.** |
| T2 | C1 | error/obs | Move the path-length guard inside/after observability, or attach traceId+log to the 414. |
| T3 | C2, C3, D1, D2 | error/obs | Adopt shared typed errors in worker routes + a central log-redaction scrubber. Governed by **ADR-105**. |
| T4 | A1 | feature | Add `/admin/recover` web route consuming the existing Worker endpoints. |
| T5 | A2, A3 | feature | Fix offline bookmark routing + add first-class queue types for bookmarks/insights. |
| T6 | A4 | feature | Route reading-insights sync through the generic offline queue with retry. |
| T7 | A7 | feature | Verify `EMAIL_SEND` wiring per environment; fail loudly (not silent log) in production when transport is absent. |
| T8 | E1 | perf | Stream/multipart EPUB upload instead of full `arrayBuffer()` buffering. |

### Phase 2 — P2 hardening (parallel swarm)

B2, B3 (file-response security headers + bounded EPUB-validator regex), C4
(dedupe ErrorBoundary logging), D2b/D2c/D3/D4 (route console→logger, real
trace IDs, `apiRaw` telemetry), E2–E6 (edge cache, reanchor preload,
parser-worker timeout, search virtualization, Lighthouse mobile gate), F3/F4
(re-enable import/order + object-injection, harden `no-console`), G1/G2/G3
(turbo output/dep fixes, explicit Vite build policy), A5/A6/A8/A9 (insights
UI wiring, offline restore, annotation import + locator-rich export, search
chapter lookup).

### Phase 3 — P3 polish (parallel, low priority)

B4/B5/B6/B7/B8, D5, E7, F1/F2/F5, G4/G5/G6, A10/A11/A12 — bounded-regex
sweep, HSTS on Pages, strict auth-header parsing, static imports for bundled
assets, doc drift, sampling, route budgets, lint-coverage of root configs,
tsconfig tightening, and remaining feature polish.

## Quality gates

- Phase 1 gate: T1 covered by a session-revocation-on-downgrade test; T3
  covered by redaction unit tests; `./scripts/quality_gate.sh` green; Codacy
  PR check green.
- Each PR: lint + typecheck + unit + coverage thresholds + build + e2e smoke.
- Security tasks: re-run `security-code-auditor` skill on touched files.

## Synthesize — deliverables of THIS plan

- This GOAP analysis + backlog (`plans/105-goap-comprehensive-codebase-audit-2026-06-23.md`).
- Policy ADR (`plans/105-adr-error-handling-and-observability-completeness.md`).
- `plans/ADR-INDEX.md` row for ADR-105.
- No application code changed; remediation ships as the PRs above.

## Compliance

- AGENTS.md TIER-2 rule 8 — issues documented as a GOAP plan + ADR (not direct
  `KNOWN-ISSUES.md` edits).
- AGENTS.md TIER-1 "fix pre-existing issues when encountered" — this plan is
  the required follow-up record; B1 (TIER-1 session-revocation) is escalated
  to Phase 1, task T1.
- ADR-083 numbering — `105` is the next free number after `104`.

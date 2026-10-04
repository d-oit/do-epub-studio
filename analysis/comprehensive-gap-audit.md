# Comprehensive gap audit: implementation, features, docs, harness, E2E, security, logging and i18n

**Date:** 2026-09-30 · **Type:** read-only eight-domain analysis (GOAP-298) ·
**Canonical finding inventory:** A1–A13; A14 was rejected during revalidation
and its entry is retained for traceability

An eight-domain gap analysis of the current tree: missing/incomplete
implementation, features, documentation truth, harness coverage, E2E proof
quality, security and logging controls, and internationalization. Nothing here
implements a fix. Every recommendation is a backlog specification with an
observable acceptance test for a future, separately authorized slice; this
report authorizes no product change, dependency upgrade, security-policy edit,
test rewrite, migration or deployment. Governance: ADR-214 (classify before
implementing; evidence beats aspiration), ADR-246 (do-harness completion
contract). The earlier three-domain audit (`analysis/feature-docs-harness-audit.md`,
F1–F10) remains a historical input; its resolved items are revalidated below
and are not treated as open findings again.

## Scope and method

- **Domains:** implementation, features, docs, harness, E2E, security, logging,
  i18n — each mapped in §Domain coverage; a finding may span domains but
  appears once.
- **Read-only bounds:** no working-tree writes beyond this report and its GOAP
  record, no installs, migrations, builds, browser sessions, app test suites,
  live APIs, external collectors, model downloads or deployments. Load-bearing
  probes were in-process function/CLI calls (below); no production data, real
  credentials or PII were used.
- **Delegation:** one read-only i18n scout returned an audit (source-only
  chunk-load rejection handling; account date/byte formatting omissions).
  Three other scouts failed before returning evidence — no partial success is
  claimed — so the parent covered the product/docs, harness/E2E and
  security/logging slices inline. The rejected scout claims (a guaranteed
  painted English frame; blanket RTL panel mirroring) are not published as
  findings.
- **Evidence levels:** **observed** = probe executed on this tree at
  `2026-09-30T18:31:49Z` with the shown result; **source-only** = read from
  current source/config; **inference** = reasoned consequence, no runtime
  proof collected.
- **Version/guidance lookup date:** 2026-09-30 (see §Official guidance and
  versions). Manifest ranges, lockfile resolutions, installed versions and
  publisher-latest tags are reported separately and never conflated.
- **Priorities** are corrective urgency, not vulnerability severity ratings.
  Findings with security relevance are classified by what is actually proven:
  A6/A7 are privacy-control gaps (observed at function level, no demonstrated
  exposure), A12 is an inference/pending-proof acceptance gap.

## Domain coverage

- **Implementation** — traced creator grounded input/dispatch (closed F1),
  ordinary annotation creation and offline queue/replay (`annotation-sync.ts`,
  `queueSync` call sites), local reading-insights computation, D1 telemetry
  persistence and the missing retention owner (A8), and the unchanged Worker
  export surface. Findings: A1 (creation not offline-first), A8 (retention
  unimplemented), A12 (CSP deployment acceptance).
- **Features** — re-read PRODUCT.md promises against shipped flows: offline
  annotations (A1 is the gap; the queue/replay machinery exists but serves
  feedback and status mutations, not ordinary creation), login (A2 drift),
  insights, admin books/grants/audit. Optional insight displays remain
  opportunities (§Optional), not missing PRODUCT requirements. No whole-book
  rewrite, cloud fallback, new schema or permission expansion is selected.
- **Docs** — PRODUCT/README/local setup/telemetry/runbooks/security posture
  read. D1 is the runtime (F4 closed in GOAP-292), but PRODUCT.md:20 still
  describes magic-link ordinary login (A2) and the telemetry retention claim
  has no delivered enforcement behind it (A8). The runbook's CSP checklist is
  guidance until executed (A12).
- **Harness** — installed `do-harness` 0.1.2 CLI re-observed:
  `explain --set verification` selects typecheck, lint, test-unit, skills, loc
  and web-ui-tests; `list --sets` still has no release set (existing GOAP-276
  backlog, not re-filed); `status --set verification` exits 1 with missing
  `insufficient_coverage` (freshness unavailable — no sensor suite was run to
  turn it green). The six route sensors remain opt-in by design; absence from
  the default set is not itself a defect. The i18n sensor/app integration
  mismatch is A3; declared/locked/installed tool divergence is A13. A14
  (documented `pnpm test` runs no unit suites) was rejected during
  revalidation — the Turbo `test` task depends on `test:unit`; see
  §Verification evidence.
- **E2E** — mapped the dev/preview mock projects, the service-worker-enabled
  `pwa-chromium` lane, the scheduled cross-browser lane and the manual
  live-Cloudflare lane (which intentionally requires deployment secrets and is
  not a required PR check). Existing ZIP/CFI fixes from GOAP-297 are present.
  Remaining weak assertions that cannot fail are A4; the body-only offline
  reload is A5; RTL/locale proof concentration on login is A11.
- **Security** — source-reviewed current controls: bearer sessions hashed at
  rest and atomic grant+session revocation (`auth/session.ts`,
  `routes/admin/grants.ts`), fresh per-request grant/capability resolution
  (`auth/middleware.ts`), signed HMAC/expiry/resource-bound file URLs
  (`storage/signed-url.ts`, `routes/files.ts`), archive budgets/timeouts
  (`archive-validator.ts`), parser worker timeout/crash paths
  (`epub-parser-worker.ts`), strict `_headers` CSP. These are source-reviewed
  controls, not a security certification: no live auth, adversarial parser
  corpus or penetration test was run. New security-relevant findings are A7
  (client telemetry has no privacy scrub boundary) and A6 (log correlation
  erased by blanket redaction), plus A12's deployment acceptance gap.
  Retained localStorage bearer transport and the documented Pages rate-limiter
  limitation are intentional compensating-control decisions, not re-filed.
- **Logging** — bounded inbound trace/span IDs, structured Worker log sink,
  client console/buffer/external sinks and D1 persistence examined. Worker logs
  are enabled; native traces are a separate opt-in not selected here. Findings:
  A6 (correlation erased), A7 (no client scrub boundary), A8 (retention
  unimplemented).
- **I18n** — 13 catalogs (English + 12), async English fallback, persisted
  switcher and a document-locale hook exist; key/plural parity is guarded by
  `i18n-parity.test.ts` and must not be called unimplemented. Findings: A3
  (sensor cannot select or verify this app's locale), A9 (locale chunk
  rejection has no handled state), A10 (dates/bytes ignore the selected UI
  locale), A11 (RTL/locale proof concentrated on login).

## Prior findings revalidation

Re-read this session against the current tree. "Function probe" means the
read-only probes recorded in §Verification evidence; the original runtime
results remain attributed to GOAP-291–297 and are not re-claimed here.

| ID  | Prior claim                                | Status in current tree                                                                                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Creator assistance app integration missing | **Closed** (GOAP-293): `AssistancePanel` derives engines from `transformersPlugin`/`languageToolPlugin` (:57-78), dispatches grounded chapters via `useEditorialReview`/`runCheck` (:124-125), and `dispatchEditorialReview` forwards text/hashes/references/style to real engines. GOAP-999 AI-01 row is DONE; only its paragraph-5 narrative still describes the old state (A2). |
| F2  | Configured runners unreachable             | **Closed** (GOAP-291): shared `@playwright/test`-first resolver. Fresh function probe: `loadChromium()` → `chromium`.                                                                                                                                                                                                                                                              |
| F3  | Advertised evidence absent                 | **Closed** (GOAP-291/294): `web-ui-tests` is in the `verification` set (fresh `explain` output) and CI runs the identical suite command in its `Web UI Audit Suite` job (`.github/workflows/ci.yml:163-179`). Promotion to a required check remains an ADR-286 decision.                                                                                                           |
| F4  | Quick-start DB command mismatch            | **Closed** (GOAP-292): D1 migration/check scripts; Turso CLI tooling and `docs/setup-turso.md` deleted. Only historical test env-var fixtures mention Turso.                                                                                                                                                                                                                       |
| F5  | I18n direction judged before navigation    | **Closed** (GOAP-291): the direction check runs after `runProbe(locale)` navigates. Fresh seam probe: correct en/ltr→ar/rtl → zero findings; ar rendered ltr → one `i18n-direction` finding.                                                                                                                                                                                       |
| F6  | Missing metrics can look clean             | **Closed** (GOAP-291): `missingMetrics` exists. Fresh probe: `{}` → four missing keys; complete metrics → none; slow metrics → four budget findings.                                                                                                                                                                                                                               |
| F7  | Viewport matrices diverged                 | **Closed** (GOAP-291): both matrices now cover the same 13 sizes (320×568 … 812×375); labels stay lane-local.                                                                                                                                                                                                                                                                      |
| F8  | Progress/qualification claims drift        | **Partially closed**; remaining documentation drift is re-filed as **A2**. AI-03 remains `PARTIAL` (human creator style review, `plans/999…:87`), not a failed engine implementation.                                                                                                                                                                                              |
| F9  | Vacuous insights assertion                 | **Closed** (GOAP-296): the `insightsVisible \|\| true` check is gone; the remaining constant-true assertions are in different specs and are A4.                                                                                                                                                                                                                                    |
| F10 | Deployed CSP/model-origin acceptance       | **Open as an acceptance gap**, re-filed as **A12** (inference/pending proof; no CSP change was made by GOAP-296, and none is authorized here).                                                                                                                                                                                                                                     |

## Current findings

Each finding lists priority, domain(s), classification, anchors, evidence
level, consumer impact, recommendation (backlog specification — not authorized
code) and observable acceptance. A14 is retained as a revalidation-rejected
entry (the claim failed against the current tree); every other entry is an
open finding.

### A1 — P1: ordinary annotation creation is not offline-first

- **Priority / domains:** P1 · implementation, features
- **Classification:** incomplete product integration (source-only)
- **Anchors:** `PRODUCT.md:5,21,24`; `apps/web/src/features/reader/hooks/useAnnotationHandlers.ts:36-79` (highlight create), `:144-190` (comment create), `:193-207` (resolve is the only offline-persisted path); `apps/web/src/lib/api/annotations.ts:11-28,62-80`; `apps/web/src/lib/offline/annotation-sync.ts:18-71`
- **Evidence level:** source-only
- **Consumer impact:** `PRODUCT.md` core flow 5 promises "queue annotations, sync when online", but creating a highlight or a shared comment when offline surfaces the network error and rolls back the optimistic entry — nothing is queued, so reopening the reader loses the annotation. Existing replay support for these types does not establish creation integration. Private editorial feedback's durable offline flow is a distinct, already-delivered surface and must not be substituted for ordinary shared comments.
- **Recommendation:** integrate the two existing creation paths with the existing encrypted annotation storage and replay, preserving capability checks and real server failures rather than queuing forbidden writes.
- **Observable acceptance:** authorized reader offline creates a highlight and a shared comment from a fixture passage → reload preserves both and their chapter/CFI/text anchors → reconnect produces the server items and settles pending local state. A rejected write stays an intelligible error, never a claimed successful annotation.

### A2 — P2: documentation still contradicts shipped behavior

- **Priority / domains:** P2 · docs
- **Classification:** documentation drift (source-only)
- **Anchors:** `PRODUCT.md:20`; `apps/web/src/features/auth/LoginPage.tsx:51-83` (posts email/password/bookSlug to `/api/access/request`; separate `/api/access/recovery-request` and `/api/access/verify-recovery` flows); `plans/999-goap-codebase-improvements-uiux-e2e-audit.md:85` (AI-01 DONE) and `:282` (acceptance paragraph 5 still asserts, in the current tense, that the panel "still dispatches only the engine-less plugin with empty input"); current sources `apps/web/src/features/creator/AssistancePanel.tsx:57-78,124-125`, `apps/web/src/features/creator/lib/editorial-dispatch.ts:40-90`, `apps/web/src/features/creator/lib/book-chapters.ts:96-145`
- **Evidence level:** source-only
- **Consumer impact:** a reader following the documented core flow expects a magic-link email and meets a password form instead; anyone reading the AI-01 narrative believes the F1 gap is still open when GOAP-293 closed it.
- **Recommendation:** make the current contracts describe password-based ordinary login with separate recovery/invitation flows, and date/label the older assistance observation as superseded by GOAP-293. Record these corrections; do not apply them in this analysis-only change.
- **Observable acceptance:** a reader following the core-flow description encounters the described form; the AI-01 narrative and status agree without marking AI-03's outstanding human review complete.

### A3 — P1: locale sensor cannot select or verify this app's locale

- **Priority / domains:** P1 · harness, i18n
- **Classification:** harness integration mismatch (source-only) plus observed function-level blind spot
- **Anchors:** `scripts/i18n-audit.mjs:27-30` (`WEB_AUDIT_LOCALE_COOKIE` or `?lang=` param); `scripts/web-ui/lib/i18n-audit.mjs:80-95` (only those switch mechanisms), `:105-120` (reads `lang` but validates only `dir`); `apps/web/src/stores/locale.ts:22-38` (navigator language + persisted `do-epub-locale`, no query/cookie consumer found in `apps/web/src`)
- **Evidence level:** observed (function-level) + source-only integration reading
- **Consumer impact:** a configured `/login` audit for en/de can report zero findings while the document is still English, because the sensor can neither activate the app's locale nor fail on a language mismatch. This is distinct from the closed F5 sequencing fix.
- **Recommendation:** an app-specific adapter that activates the existing persisted locale or the actual switcher and confirms the target document language after locale loading. Do not add a second product-wide query/cookie precedence convention solely for the generic sensor.
- **Observable acceptance:** configured `/login` audit for en/de/ar observes en/ltr, de/ltr, ar/rtl and translated text; an intentionally English document during the de probe reports a locale-activation/language failure instead of OK.

### A4 — P1: E2E checks still pass when their claimed behavior is absent

- **Priority / domain:** P1 · E2E
- **Classification:** vacuous assertion (source-only)
- **Anchors:** `apps/tests/in-book-search.spec.ts:68-82` (`expect(hasNoResults || true).toBe(true)`); `apps/tests/login-and-book-load.spec.ts:126-158` (`expect(spinnerVisible || loadingVisible || true).toBe(true)`); `apps/tests/reader-annotations-and-admin.spec.ts:137-158` (expired session accepts login **or** reader route)
- **Evidence level:** source-only (a repo-wide sweep confirms these are the only remaining constant-true assertions in `apps/tests`)
- **Consumer impact:** absent search-empty state, absent loading state and a reader that ignores session expiry all pass CI. The tests certify nothing about the behaviors they name. Unrelated to F9's removed insights tautology.
- **Recommendation:** delete the constant-true and incidental implementation assertions, then assert consumer-visible states with existing Playwright fixtures and retrying locators.
- **Observable acceptance:** absent search-empty state fails; a held file-URL response visibly shows the loading state and the released response renders fixture content; a server 401 causes a login/logout transition rather than accepting the stale reader route. Do not replace the tautologies with class-name or source-text tests.

### A5 — P1: the offline reload test does not prove offline reading

- **Priority / domain:** P1 · E2E
- **Classification:** insufficient proof (source-only)
- **Anchors:** `apps/tests/offline-reader.spec.ts:70-100`; `playwright.config.ts:116-123` (`pwa-chromium` with `serviceWorkers: 'allow'`); `.github/workflows/ci.yml:557-558` (invokes the PWA lane)
- **Evidence level:** source-only
- **Consumer impact:** the scenario aborts API/EPUB requests, reloads and asserts only that `body` is visible. An error page or blank shell satisfies it, so offline reading — the PRODUCT promise behind the enabled SW lane — is unproven even though other PWA tests and the real offline feedback replay exist.
- **Recommendation:** convert this scenario to actual offline context plus visible fixture chapter content and reader navigation after reload, using `createMinimalEpub` and current fixture helpers.
- **Observable acceptance:** online load of the fixture → SW/cache ready → offline reload → `OFFLINE TEST CONTENT` remains readable, reader controls work, and reconnect does not lose state. A body-only error document fails.

### A6 — P1: redaction destroys request-log correlation

- **Priority / domain:** P1 · logging
- **Classification:** privacy-control gap — observed at the scrub boundary; no credential exposure demonstrated
- **Anchors:** `packages/shared/src/telemetry.ts:42-45` (UUID trace IDs); `apps/worker/src/lib/observability.ts:87-97` (`JSON.stringify(scrub(payload))`); `apps/worker/src/lib/redact.ts:34,59-65` (`LONG_TOKEN_PATTERN` erases 32+ char identifier-shaped runs); `apps/worker/src/__tests__/observability.test.ts:86-105` (pins the erased correlation with short-ID fixtures)
- **Evidence level:** observed (function probe) + source-to-sink reading
- **Consumer impact:** a real-format UUID trace ID is replaced by `[REDACTED]` in Worker logs, so request/error correlation — a stated observability control — does not work end-to-end for real traffic, while the regression test enforces the broken behavior.
- **Recommendation:** preserve only validated structural correlation IDs (trace/span) at the log boundary while continuing to scrub arbitrary metadata and error text; replace the regression-pinning expectation, not merely its short fixture.
- **Observable acceptance:** a real-format request trace ID equals the response header and the request/error log IDs; synthetic secret fields remain redacted, including when secret strings resemble identifiers. General secret redaction must not be removed.

### A7 — P1: client telemetry has no privacy scrub boundary

- **Priority / domains:** P1 · security, logging
- **Classification:** privacy-control gap (observed at the synthetic console boundary; external-collector consequence is source-only — no exfiltration demonstrated)
- **Anchors:** `apps/web/src/lib/client-logger.ts:37-61` (raw buffer posted to `VITE_TELEMETRY_ENDPOINT`), `:82-102` (entry serialized unchanged to console and buffer); `docs/observability-telemetry.md:24-34,65-78` (external collectors permitted; secrets/PII/manuscript content prohibited); `apps/worker/src/routes/telemetry.ts:55-67,117-118` (Worker-side scrub cannot protect data already sent to a different collector); `apps/worker/src/lib/redact.ts:72-89` (key normalization strips `[-_]` while the sensitive set contains the hyphenated `set-cookie` entry, so `isSensitiveKey('Set-Cookie')` is false — observed)
- **Evidence level:** observed (client logger probe with synthetic markers) + source-only collector path
- **Consumer impact:** any caller that follows the existing logger API can emit secrets or personal data to the console, the in-memory buffer and (when configured) an external collector; the documented prohibition has no enforcing boundary on the client. The Worker scrub cannot retroactively protect a third-party sink.
- **Recommendation:** one bounded client log sanitizer before every console/buffer/network sink, following existing Worker redaction semantics without erasing validated trace IDs; normalize sensitive key definitions and lookups consistently.
- **Observable acceptance:** synthetic secret and personal-data markers are absent/redacted in captured console, queued payload and external-endpoint request, while trace/event/error classification stays usable. No real credentials or external service are needed. Any later-discovered genuine vulnerability follows private `SECURITY.md` disclosure before publication.

### A8 — P1: advertised telemetry retention has no implementation

- **Priority / domains:** P1 · implementation, docs, logging
- **Classification:** unimplemented operational control (source-only)
- **Anchors:** `docs/observability-telemetry.md:59-63` ("kept for 90 days by default"); `docs/runbooks/telemetry-retention.md:24-49` (cron example that says "Add the `scheduled` handler to the existing Worker entry before deploy"); `apps/worker/src/index.ts:29-43` (default export has `fetch` only); `apps/worker/wrangler.jsonc` (no `crons`/`triggers`; grep empty); `wrangler.toml` configures the separate Pages deployment
- **Evidence level:** source-only (repo-wide search finds `DELETE FROM telemetry_events` only inside the runbook)
- **Consumer impact:** the documented 90-day retention does not execute anywhere; telemetry rows accumulate indefinitely in D1 against the stated policy. A Worker cron example is not proof of retention for the Pages deployment either.
- **Recommendation:** deliver and document a deployable cleanup owner for the actual D1 deployment instead of representing the runbook example as installed enforcement. Retention policy (90 days) and cadence are unchanged by this audit.
- **Observable acceptance:** isolated D1 contains rows older/newer than the cutoff; one real cleanup invocation deletes old rows and preserves recent rows, with scheduled configuration and execution evidence for the deployed owner. Do not run cleanup/migrations against user data during analysis.

### A9 — P2: locale chunk rejection has no handled load-error state

- **Priority / domain:** P2 · i18n
- **Classification:** unhandled failure path (source-only)
- **Anchors:** `apps/web/src/i18n/index.ts:16-22` (`ensureLocale` propagates dynamic-import rejection), `:23-50` (per-locale dynamic imports); `apps/web/src/hooks/useTranslation.ts:21-35` (`.then` without rejection handler; `loadedLocale` stays null), `:37-41` (English fallback for the mounted locale); `apps/web/src/hooks/useDocumentLocale.ts:17-22` (advertises the selected language/direction independently of load success)
- **Evidence level:** source-only
- **Consumer impact:** a failed Arabic chunk request can leave a mounted view silently showing English fallback strings while the document claims `lang="ar" dir="rtl"`, with an unhandled rejection and no user-visible recovery — the intentional dictionary-key fallback policy becomes indistinguishable from a load failure.
- **Recommendation:** explicitly handle locale-load failure and provide an honest, recoverable state without changing the intentional English dictionary-key fallback policy. No blanket retry subsystem is specified or required.
- **Observable acceptance:** abort the selected Arabic chunk during navigation → no unhandled rejection and no silent claim of fully Arabic content → after an explicit user retry/reselection succeeds, translated controls and document language/direction agree.

### A10 — P2: dates and byte numbers ignore the selected UI locale

- **Priority / domain:** P2 · i18n
- **Classification:** formatting-locale omission (source-only dates; observed bytes)
- **Anchors:** `apps/web/src/features/admin/AccountSettingsPage.tsx:24-28` (browser-default `date.toLocaleString()`); `apps/web/src/lib/i18n-format.ts:13-23` (store-aware `formatDate`/`formatDateTime` exist and are unused here); `apps/web/src/lib/formatBytes.ts:4-8` (`toFixed`)
- **Evidence level:** observed (function probe) + source-only call sites
- **Consumer impact:** a user with browser locale en-US and app locale fr sees English-formatted session dates; a user selecting de sees `1.5 MB` where German numeric formatting is `1,5` — the UI locale selector does not fully govern the UI.
- **Recommendation:** reuse the existing store-aware date helper and locale-aware numeric formatting at byte-size consumers while retaining the current binary magnitude semantics. No new formatter abstraction, unit-policy change or incidental date-string repinning is necessary.
- **Observable acceptance:** browser en-US, app fr → account-session dates follow fr; selected de → the same 1.5-megabyte magnitude uses the German decimal separator; en restores English formatting.

### A11 — P2: RTL/locale proof is concentrated on login

- **Priority / domains:** P2 · i18n, E2E
- **Classification:** coverage limitation (source-only) — not a blanket claim of broken RTL
- **Anchors:** `apps/tests/reader-annotations-and-admin.spec.ts:263-300` (login switching de/fr + persistence); `apps/tests/login-responsive-controls.spec.ts:280-295` (correctly drives the real Arabic selection and asserts the app applied `dir=rtl`); `apps/tests/viewport-regression.spec.ts:93-113` (manually forces `lang`/`dir`); `apps/web/src/features/reader/components/info/InfoPanel.tsx:80` (physical `right-0` placement — review target, not proof a given panel must mirror); `apps/web/src/__tests__/i18n-parity.test.ts:49-129` (key/value-shape parity; placeholder-token parity is a missing future guard, not evidence of a currently mistranslated token)
- **Evidence level:** source-only
- **Consumer impact:** reader and admin RTL behavior under the real switcher (document metadata, translated controls, focus/read order, overflow) is not exercised; a regression confined to those routes would pass the suite.
- **Recommendation:** extend real-switcher journeys to reader and admin and prove lang/dir, translated controls, focus/read order and no horizontal overflow. No blind panel-side mirroring is specified.
- **Observable acceptance:** en→ar→de on login and a seeded reader/admin route → expected translated controls and document metadata after each switch/reload, usable panels with all bounds within the viewport, no attribute injection.

### A12 — P2: enforced-CSP assistance remains a deployment acceptance gap

- **Priority / domains:** P2 · security, implementation, E2E
- **Classification:** inference/pending proof — previously F10; not a newly proven CSP vulnerability
- **Anchors:** `apps/web/public/_headers:2` (`connect-src 'self' https://*.cloudflare.com`); `docs/runbooks/infrastructure-setup.md:208-217` (deployed-origin checklist); `plans/296-goap-insights-proof-and-csp-acceptance.md:40-49` (no CSP/hosting change made); `apps/web/src/features/creator/AssistancePanel.tsx:98-107` (preparation errors are caught and surfaced, so no fabrication claim is made)
- **Evidence level:** inference (runbook acceptance uncollected)
- **Consumer impact:** the labelled on-device engine preparation may be unable to complete its model/ORT fetches on the CSP-enforced production origin; until the deployed browser/network proof runs, deployed assistance completion is unknown.
- **Recommendation:** collect the already-specified browser/network proof under the deployed CSP before declaring deployed assistance complete. Admitted origins require their own reviewed security/hosting decision. No CSP weakening, remote model download or production probe is authorized by this audit.
- **Observable acceptance:** authorized creator's labelled engine preparation either completes real model/ORT downloads under the enforced policy or reports failure honestly.

### A13 — P2: declared, locked and installed tool versions diverge

- **Priority / domains:** P2 · harness, reproducibility
- **Classification:** environment divergence (observed installed metadata; source-only lock)
- **Anchors:** root `package.json` (`wrangler: ^4.137.0`); `pnpm-lock.yaml:117-119` (wrangler 4.142.0); installed probe output (wrangler resolves 4.135.0)
- **Evidence level:** observed + source-only lock reading
- **Consumer impact:** this working tree runs a Wrangler older than both its manifest range floor's intent and the frozen lock resolution — any local runtime-sensitive conclusion (D1 behavior, compat flags) can diverge from CI. This records local state; it is not a CI installation defect.
- **Recommendation:** reconcile the toolchain before any runtime-sensitive implementation; execution of this report installs nothing. Installed do-harness 0.1.2 is current (the older recommendation to upgrade from 0.1.1 is obsolete).
- **Observable acceptance:** for a later slice, exact project-resolved tool versions match the frozen lock under a clean installation, and the Cloudflare worker test-pool compatibility is proven before considering Vitest 5. Older versions alone are not a security finding.

### A14 — Rejected during revalidation: root test command claim (was P1)

- **Status:** rejected — the claimed defect does not exist in the current tree
- **Domains:** docs, harness, tests (originally listed P1)
- **Classification:** false positive from the planning session, corrected by
  observed evidence
- **Anchors:** `README.md:76`; root `package.json:13-14`; `turbo.json:63-78`;
  `apps/web/package.json:16-18`; `apps/worker/package.json:14-16`; the five
  `packages/*/package.json` manifests
- **Evidence level:** observed (non-executing `turbo run test --dry=json`
  task-graph inspection) + source-only reading
- **What the revalidation showed:** `turbo.json:77-78` defines
  `"test": { "dependsOn": ["test:unit"] }`. The dry graph schedules 16 tasks:
  `web#test` (echo) depends on `web#test:unit`
  (`cross-env NODE_OPTIONS=… vitest run`), `worker#test` (echo) depends on
  `worker#test:unit` (`vitest --run`), and `reader-core#test:unit`,
  `shared#test:unit`, `schema#test:unit`, `ui#test:unit` and
  `testkit#test:unit` are all scheduled dependency nodes even though those
  packages define no `test` script. The root `pnpm test` therefore executes
  real unit suites for web, worker and all five library packages; the echo
  scripts are only leaf no-ops layered on top. The planning-session premise
  (echo scripts ⇒ no suites run; library and Worker tests skipped) was wrong.
- **Consumer impact:** none. The published command behaves as documented ("run
  all unit tests").
- **Recommendation:** none. The narrower observation that `pnpm test` and
  `pnpm test:unit` cover the same suites is cosmetic, not a defect; no docs or
  script change is warranted by this item.
- **Observable acceptance (already met):** the advertised command resolves
  real Vitest commands for every unit package — observed via the dry graph;
  `pnpm test:unit` remains available for explicit all-unit runs.

## Optional feature opportunities

Recommendations only — no UI, API, schema, retention or permission policy is
selected or changed. **Prioritize corrective A1/A3/A4/A5/A6/A7/A8 before
expanding either surface.**

1. **Cross-device reading-insights display.** `apps/worker/src/routes/reader/insights.ts:26-67` already serves history; the current reader panel computes local history (`InfoPanel.tsx:52-65`) and targeted searches found no app consumer of the GET surface. Success: a fresh authenticated device shows the server history.
2. **Authorized admin aggregate display.** `apps/worker/src/routes/admin/insights.ts:32-65` serves book-level aggregates with no web consumer. Success: an authorized admin sees the server aggregate for the authorized scope without individual reader timelines.

Neither opportunity invents merging, retention or permission policy; both
require separate authorization and a UI decision.

## Official guidance and versions

Lookup date: **2026-09-30** (execution environment). Publisher-latest tags are
not proof of compatibility, manifest ranges are never labelled installed, and
no upgrade is part of this deliverable.

| Tool              | Declared / locked / installed                                                 | Latest publisher lookup                                                                                              | Source                                              |
| ----------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| do-harness        | Installed 0.1.2 (8f91225, not a pnpm dependency)                              | v0.1.2, GitHub `prerelease:false`, published 2026-09-22                                                              | GitHub releases API / tag page                      |
| Playwright        | ^1.63.0 / 1.63.0 / 1.63.0                                                     | 1.63.0                                                                                                               | registry.npmjs.org/@playwright/test/latest          |
| Vitest            | 4.1.11 / 4.1.11 / 4.1.11                                                      | 5.0.3                                                                                                                | registry.npmjs.org/vitest/latest                    |
| Wrangler          | ^4.137.0 / 4.142.0 / root-resolved 4.135.0                                    | 4.145.0 — metadata also carries `workers-sdk.prerelease:true`: disclose the channel caveat, assume no upgrade safety | registry.npmjs.org/wrangler/latest                  |
| Transformers.js   | ^4.3.0 / 4.3.0 / unverified (package exports block the package.json subpath)  | 4.3.0                                                                                                                | registry.npmjs.org/@huggingface/transformers/latest |
| Hono              | ^4.13.8 / 4.13.8 / unverified (same restriction)                              | 4.13.12                                                                                                              | registry.npmjs.org/hono/latest                      |
| DOMPurify         | ^3.4.16 (workspace override ^3.4.13) / 3.4.16 / unverified (same restriction) | 3.4.16                                                                                                               | registry.npmjs.org/dompurify/latest                 |
| Vite              | 8.3.0 / 8.3.0 / not probed                                                    | 8.3.1                                                                                                                | registry.npmjs.org/vite/latest                      |
| React             | ^19 / 19.3.0 / not probed                                                     | 19.3.0                                                                                                               | registry.npmjs.org/react/latest                     |
| Zod               | ^4.6.5 / 4.6.5 / not probed                                                   | 4.6.5                                                                                                                | registry.npmjs.org/zod/latest                       |
| Sentry Cloudflare | ^11.0.0 / 11.0.0 / not probed                                                 | 11.1.0                                                                                                               | registry.npmjs.org/@sentry/cloudflare/latest        |
| Workers types     | ^5.20260923.1 / 5.20260928.1 / not probed                                     | 5.20260930.2                                                                                                         | registry.npmjs.org/@cloudflare/workers-types/latest |

Relevant current practices (each row states the practice it relies on):

- **Playwright:** user-visible assertions, independent browser state and controlled data — <https://playwright.dev/docs/best-practices>. Search surfaced `/next` docs; unreleased APIs are not cited as stable requirements.
- **Vitest 5 migration:** breaking; requires Node >= 22.12.0 and Vite >= 6.4.0 — <https://vitest.dev/guide/migration/>. Current Node 22.23.2 meets the runtime minimum, but the locked Cloudflare worker-pool peer compatibility is not a verified major-upgrade path. Recommend a separate compatibility-qualified migration, never a blind bump.
- **OWASP ASVS:** current stable is 5.0.0 — <https://owasp.org/www-project-application-security-verification-standard/>. Use versioned requirement IDs only after reading the exact requirement; do not copy older cheat-sheet numbering blindly. Structured correlation, event coverage and sensitive-data exclusions: <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>.
- **Workers configuration/observability:** <https://developers.cloudflare.com/workers/best-practices/workers-best-practices/> and <https://developers.cloudflare.com/workers/observability/logs/workers-logs/> (both re-read 2026-09-30). Native traces require separate configuration at this compatibility boundary — <https://developers.cloudflare.com/workers/observability/traces/>; logs enabled does not imply tracing. Any opt-in export/sampling choice has retention/cost implications; no new integration is selected.
- **D1 and scheduled handlers:** local/remote isolation — <https://developers.cloudflare.com/d1/best-practices/local-development/>; a schedule needs an actual handler and deployment trigger — <https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/>. Do not copy Worker cron guidance into the Pages deployment and call retention deployed.
- **Language and direction:** `<html lang>` and `dir` are distinct metadata and should be exercised through the app — <https://www.w3.org/International/questions/qa-html-language-declarations>, <https://www.w3.org/International/questions/qa-html-dir>. Logical CSS helps RTL, but not every panel must change sides. <https://www.w3.org/TR/string-meta/> is a July 2026 First Public Working Draft, not a mandatory new localized-string schema.
- **do-harness adoption/evidence loop:** pinned v0.1.2 guidance — <https://raw.githubusercontent.com/d-o-hub/do-harness/v0.1.2/docs/adoption.md>. Repository hook ownership under ADR-246 overrides generic advice to run `init` or install hooks.

## Verification evidence

Observed read-only probes, executed 2026-09-30 at `2026-09-30T18:31:49Z`
(planning observations were re-run, not replayed):

| Probe                                          | Observed result                                                                                                                                                                                                      | Limit                                                                                             |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `do-harness --version`                         | 0.1.2 (8f91225 2026-09-22)                                                                                                                                                                                           | Installed CLI, not refreshed evidence                                                             |
| `do-harness explain --set verification`        | typecheck, lint, test-unit, skills, loc, web-ui-tests selected                                                                                                                                                       | Selection only — six selected does not mean they passed                                           |
| `do-harness list --sets`                       | feedback, verification, web-ui                                                                                                                                                                                       | Release-set absence is existing GOAP-276 backlog                                                  |
| `do-harness status --set verification`         | exit 1, missing `insufficient_coverage`                                                                                                                                                                              | Freshness unavailable; no sensor suite was run                                                    |
| Installed-package `createRequire` probe        | Node 22.23.2; `@playwright/test` 1.63.0; vitest 4.1.11; wrangler 4.135.0; hono/dompurify MODULE_NOT_FOUND from root; Transformers blocked by exports                                                                 | Not proof those packages are absent; installed versions of the unverified three remain unverified |
| `loadChromium()` (real resolver)               | `chromium`                                                                                                                                                                                                           | Resolver-level, not a browser session                                                             |
| `auditLocales` stateful seam                   | correct en→ar: 0 findings; ar rendered ltr: 1 `i18n-direction`; en/de with document always en: **0 findings** (language blind spot)                                                                                  | In-memory seam, no rendered-page proof                                                            |
| `missingMetrics` / `evaluateBudgets`           | `{}` → 4 missing keys; complete finite metrics → none; slow metrics → 4 budget findings                                                                                                                              | Function-level; no Lighthouse run                                                                 |
| Worker `scrub` with synthetic UUID             | `{"traceId":"[REDACTED]","spanId":"abc123",...}`; minted trace ID is UUID-shaped                                                                                                                                     | Correlation boundary only; no real secret used                                                    |
| `isSensitiveKey` / header scrub                | `Set-Cookie` → false, `set-cookie` → false, `Authorization` → true; header object leaves the synthetic `Set-Cookie` value while `email`/UUID are redacted                                                            | Boolean/function-level                                                                            |
| Client `logClientEvent` with synthetic markers | captured console entry carries `Set-Cookie: do_session=SYNTHETIC-SECRET` and `email: reader@example.test` unchanged                                                                                                  | External endpoint unset; no transmission exercised                                                |
| `formatBytes(1572864)`                         | `1.5 MB`; Intl de reference `1,5`                                                                                                                                                                                    | Function-level, not a UI screenshot                                                               |
| `turbo run test --dry=json`                    | exit 0; 16-task graph — `web#test:unit` (`vitest run`) and `worker#test:unit` (`vitest --run`) are scheduled deps of the echo `test` scripts, and `reader-core/shared/schema/ui/testkit#test:unit` are all scheduled | Non-executing graph inspection; no suite was run                                                  |
| Registry `/latest` lookups (11 packages)       | matches the version table above; do-harness GitHub latest v0.1.2, `prerelease:false`                                                                                                                                 | Publisher tags, not compatibility proof                                                           |

Reproduction (all read-only, no files retained): import `auditLocales` from
`scripts/web-ui/lib/i18n-audit.mjs`, `missingMetrics`/`evaluateBudgets` from
`perf-audit.mjs`, and `loadChromium` from `playwright.mjs` in ordinary
`node --input-type=module` seams. For `scrub`/`formatBytes`/client logger use
`node --experimental-strip-types` with their exact source imports; capture
`console.error` in-process, call the real logger with synthetic markers and
restore it in `finally` (`VITE_TELEMETRY_ENDPOINT` unset). Never create
source-text assertions, permanent mock-echo tests or files for these audit
probes.

**Publication verification:** `node scripts/check-adr-index.mjs` and a
throwaway read-only artifact smoke (section headings, A1–A14 uniqueness, eight
domain entries, links, scoped DONE status) are recorded in
`plans/298-goap-comprehensive-gap-audit.md`. That smoke proves report
integrity, not product correctness.

No browser, application test suite, build, formatter, migration, installation,
live API, external collector or remote model run was performed for this audit,
and no runtime fix is delivered — there is no remediation smoke to claim.
A1–A13 acceptance scenarios belong to separately authorized corrective work.

## Prioritized next work

Highest-priority corrective items first (each needs its own executable spec and
authorization; this audit authorizes none of them):

1. **A1** — ordinary annotation creation offline-first (product promise).
2. **A3** — locale sensor that can actually select and verify this app's locale.
3. **A4** — remove the three remaining non-failing E2E assertions.
4. **A5** — offline reload must prove offline reading, not body presence.
5. **A6** — preserve real trace IDs at the log boundary.
6. **A7** — bounded client-side log sanitizer; fix sensitive-key normalization.
7. **A8** — deliverable telemetry retention owner for the deployed D1.
8. **A2**, **A9**, **A10**, **A11**, **A12**, **A13** — P2 drift/failure-path/
   formatting/coverage/CSP-acceptance/toolchain items, in that order.
9. **Optional opportunities** — cross-device insights display and admin
   aggregate display, only after the corrective set above.

A14 was rejected during revalidation — the Turbo `test` task graph runs the
unit suites — so no corrective work is specified for it.

**Corrective follow-up (same day):** GOAP-299
(`plans/299-goap-logging-privacy-slice.md`) implemented **A6** and **A7** with
their published acceptance criteria: `packages/shared/src/redact.ts` is now
the single sanitizer (sensitive-key normalization fixed; closed
correlation-field contract), the Worker log boundary and the client
console/buffer/endpoint sinks use `scrubLogEntry`, and the test that pinned
erased correlation was replaced by the acceptance-level proof (shared
151/151, worker 528/528, web 1433/1433, typechecks + eslint clean,
real-function probe). All other findings remain open as listed above.

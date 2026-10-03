# GOAP-298: Comprehensive gap audit — eight-domain analysis

**Status:** DONE (analysis only; corrective implementation not started)
**Date:** 2026-09-30

**Type:** Read-only eight-domain audit (documentation only)
**ADRs referenced:** ADR-214 (audit recommendation governance — classify before
implementing, evidence before claims), ADR-246 (do-harness completion contract)
**Canonical report:** `analysis/comprehensive-gap-audit.md` (finding inventory
A1–A13; A14 was rejected during revalidation and is retained in the report for
traceability)

> **Reconciled 2026-10-03 — corrective slices have since been authorized and
> delivered.** A1 _**Closed**_ (GOAP-302), A3 _**Closed**_ (GOAP-304), A4
> _**Closed**_ (GOAP-303), A5 _**Closed**_ (GOAP-300), A6 and A7
> _**Closed**_ (GOAP-299), A8 _**implemented, deployment acceptance open**_
> (GOAP-305), A9 _**Closed**_ (GOAP-306), A10 _**Closed**_ (GOAP-307). Still
> open: A2, A11–A13.
> The finding inventory below is left as filed (a dated evidence record);
> per-finding status lives in `analysis/comprehensive-gap-audit.md`.

## Purpose

Publish a grounded eight-domain audit — implementation, features,
documentation truth, harness, E2E, security, logging and internationalization —
against current official guidance and observed versions, without implementing
corrective work, changing security policy, upgrading dependencies, installing
tools, regenerating evidence or generating build/test/browser artifacts. This
expands GOAP-290's three-domain audit; resolved F1–F10 items are revalidated
there and are not re-filed as open.

## Completed analysis checklist

- [x] **Implementation** — traced creator grounded input/dispatch, ordinary
      annotation creation vs the existing offline queue/replay, local
      insights, D1 telemetry persistence, and the Worker export surface.
- [x] **Features** — re-read PRODUCT.md promises against shipped flows;
      offline ordinary annotations confirmed as the gap (A1) while optional
      insights displays stay labeled opportunities.
- [x] **Docs** — PRODUCT/README/local setup/telemetry/runbooks read; the
      magic-link contradiction (A2) and retention claim (A8) recorded with
      anchors; the planning session's `pnpm test` suspicion (A14) was
      disproven by a non-executing Turbo task-graph probe and is published as
      rejected.
- [x] **Harness** — installed do-harness CLI re-probed (version, verification
      set membership, set list, freshness exit); i18n sensor/app integration
      mismatch found (A3); declared/locked/installed divergence recorded (A13).
- [x] **E2E** — dev/preview mock lanes, enabled-SW PWA lane, scheduled
      cross-browser lane and manual live lane mapped; remaining non-failing
      assertions (A4), body-only offline reload (A5) and login-concentrated
      RTL proof (A11) recorded.
- [x] **Security** — source-reviewed sessions/grants/file-URL/parser controls
      (read-only, no certification claimed); client telemetry privacy boundary
      gap (A7) and deployed CSP acceptance gap (A12) classified honestly.
- [x] **Logging** — Worker structured sink, client console/buffer/external
      sinks and D1 persistence examined; correlation-erasing redaction (A6)
      and missing retention owner (A8) recorded.
- [x] **I18n** — 13 catalogs, async English fallback, persisted switcher and
      document-locale hook verified present; sensor blindness (A3), chunk
      rejection handling (A9), locale-insensitive dates/bytes (A10) and
      coverage concentration (A11) recorded.

Current official-source research (lookup date 2026-09-30):

- [x] Playwright best practices; Vitest 5 migration guide (Node >= 22.12.0,
      Vite >= 6.4.0); OWASP ASVS 5.0.0 page; OWASP Logging Cheat Sheet.
- [x] Cloudflare Workers best practices + Workers Logs + native traces +
      D1 local development + scheduled handler guidance.
- [x] W3C language/direction Q&A; W3C string-meta draft status verified
      (First Public Working Draft — not a mandatory schema).
- [x] Registry `/latest` re-lookups for 11 packages plus the do-harness
      GitHub release (`v0.1.2`, `prerelease:false`), with the Wrangler
      `workers-sdk.prerelease:true` channel caveat disclosed.

Read-only probe checklist (executed on this tree; no files retained):

- [x] `do-harness --version`, `explain --set verification`, `list --sets`,
      `status --set verification` (exit 1, missing `insufficient_coverage`).
- [x] `turbo run test --dry=json` (non-executing): 16-task graph showing
      `test:unit` scheduled for web, worker, reader-core, shared, schema, ui
      and testkit beneath the echo `test` scripts — A14 rejected.
- [x] Installed-package resolution probe (Node 22.23.2; Playwright 1.63.0;
      Vitest 4.1.11; Wrangler 4.135.0; the three export-blocked
      package.json subpaths recorded as unverified).
- [x] Function probes: `loadChromium` → `chromium`; `auditLocales` stateful
      seams (correct en/ar, ar-rendered-ltr, en/de language blind spot);
      `missingMetrics`/`evaluateBudgets`; Worker `scrub` with a synthetic
      UUID; `isSensitiveKey('Set-Cookie')`; client `logClientEvent` with
      synthetic markers under a captured console; `formatBytes(1572864)` vs
      German numeric formatting.

## Findings pointer (no backlog duplicated here)

The finding inventory lives in the canonical report. Priority order:

- **P1:** A1 (annotation creation not offline-first), A3 (locale sensor cannot
  select or verify the app locale), A4 (non-failing E2E assertions), A5
  (offline reload proves only body presence), A6 (redaction erases real trace
  correlation), A7 (no client telemetry privacy boundary), A8 (advertised
  retention unimplemented).
- **Rejected during revalidation:** A14 (documented `pnpm test` runs no unit
  suites) — the Turbo `test` task depends on `test:unit`, so the root command
  runs every unit suite; retained in the report for traceability only.
- **P2:** A2 (docs vs shipped login/assistance narrative), A9 (locale chunk
  rejection unhandled), A10 (dates/bytes ignore UI locale), A11 (RTL proof
  concentrated on login), A12 (deployed-CSP acceptance pending, inherited
  from F10), A13 (declared/locked/installed tool divergence).
- **Optional:** cross-device and admin aggregate insights displays.

Each corrective item requires its own executable spec; executing this record
authorizes none of them.

## Verification

- `node scripts/check-adr-index.mjs` → **exit 0**:
  `✓ ADR index validation passed (ADR-083). Numbers tracked: 97`, with only
  the two pre-existing warnings (archived ADR-063b / ADR-111 `Proposed` plan
  headers under finished index rows). No new numbering/file/status error
  (re-run after the final index-row edit: identical result).
- `turbo run test --dry=json` (non-executing) → exit 0; the graph schedules
  `test:unit` for web, worker, reader-core, shared, schema, ui and testkit —
  A14 was rejected on this evidence and the report/GOAP/pointer text was
  corrected before delivery.
- Throwaway read-only Node assertion over the published files → **PASS**:
  all eight exact report section headings present; all fourteen finding
  headings A1–A14 unique; each of the eight domain-coverage entries present;
  official-source links present; scoped analysis-only DONE status present;
  A14 published as rejected consistently in report/GOAP/index (no stale P1
  claim); the three connecting links (successor ↔ report ↔ GOAP record)
  present; no placeholders remain. The assertion script was not retained.
- No app tests, builds, migrations, browser sessions or model downloads were
  run: the change surface is markdown only, and every probe above is an
  in-process function/CLI call or a non-executing task-graph inspection.

## Deliberate non-actions

- `do-harness status --set verification` was left stale
  (`insufficient_coverage`, exit 1) rather than refreshed to make this audit
  look green.
- No scout failure was papered over: one scout returned an audit, three
  failed before returning evidence, and the parent covered those slices
  inline.
- No production code, test, workflow, dependency version, security policy or
  existing implementation status was changed; resolved F1–F10 items were not
  reopened, and AI-03 remains the open human review.

## Corrective follow-up

**A6/A7 implemented (same day):** GOAP-299
(`plans/299-goap-logging-privacy-slice.md`) moved the log scrubber to
`packages/shared/src/redact.ts`, added the correlation-preserving
`scrubLogEntry` contract at the Worker and client log boundaries, fixed the
`set-cookie` key normalization, and replaced the regression-pinning test with
the acceptance-level proof. Evidence: shared 151/151, worker 528/528, web
1433/1433, typechecks + eslint clean, real-function probe (correlation equals
the response headers; synthetic secrets redacted in console and flushed
payload). The remaining A1–A5, A8–A13 findings and the optional opportunities
stay open.

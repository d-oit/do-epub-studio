# GOAP-1000: Implementation, security, E2E and feature audit

**Status:** DONE (analysis only; corrective implementation not authorized)
**Date:** 2026-10-04
**Type:** Read-only four-domain audit (documentation only)
**Governance:** `plans/1000-adr-audit-evidence-and-scope.md` (ADR-1000,
Accepted 2026-10-04)
**ADRs referenced:** ADR-214 (audit recommendation governance), ADR-052 (Gap
Closure Policy)
**Prior report:** `analysis/comprehensive-gap-audit.md` (GOAP-298, 2026-09-30) —
cited as historical evidence, not re-executed here. _Note 2026-10-05:_ upstream
`main` (`7e0cbd6c`) later removed that report and plans 298–308 from the tree;
this audit's own inventory below is the surviving record.
**Owned follow-ups:**

- `plans/1001-goap-reader-integration-gaps.md` — GOAP-1001 (M1–M3)
- `plans/1002-goap-security-control-validation.md` — GOAP-1002 (S1–S4)
- `plans/1003-goap-e2e-behavior-proof-gaps.md` — GOAP-1003 (E1–E4)
- `plans/1004-goap-reading-insights-feature-roadmap.md` — GOAP-1004 (N1–N3)

## Purpose

Audit four requested domains — missing implementation, security, E2E tests and
new features — against the current tree and publish an owned, prioritized
inventory with concrete acceptance. This deliverable changes planning documents
only: application code, tests, dependencies, infrastructure and security policy
are unchanged. `analysis/` and ordinary product documentation are deliberately
unchanged.

Evidence class is stated per row. Source-confirmed control-flow omissions are
`source-only`; runtime consequences and deployment questions are `[INFERENCE]`.
No percentage-complete claims, no severity ratings and no security
certification appear anywhere in this record.

## Missing implementation

<!-- prettier-ignore -->
| ID | Priority and evidence class | Impact and exact source anchor | Owning plan and concrete acceptance |
| - | - | - | - |
| M1 | P1, source-only | Online bookmark create/delete mutate Zustand only, so the server list reload overwrites acknowledged state. `apps/web/src/features/reader/hooks/useBookmarkHandlers.ts:27–90`; `useReaderDataLoader.ts:107–112,159–163,273–277`; server routes exist at `apps/worker/src/routes/reader/bookmarks.ts:63–125`. | [GOAP-1001](1001-goap-reader-integration-gaps.md) — create online → create a highlight → reload → bookmark survives; delete → reload → absent; offline create/reload/reconnect yields one durable bookmark and a 403 leaves no successful state. |
| M2 | P1, source-only | Notification badge/panel have test-only consumers, so unread comment-reply state is unreachable in the reader. `apps/web/src/features/reader/components/notifications/NotificationBadge.tsx`, `NotificationPanel.tsx`; producer routes `apps/worker/src/routes/notifications.ts`, `routes/comments.ts:177–181`. | [GOAP-1001](1001-goap-reader-integration-gaps.md) — reader B replies → A sees an unread notification → opens the referenced comment → marks read → count decreases; empty state and failed fetch are distinguishable. |
| M3 | P2, source-only lifecycle gap | Server FTS reads `book_search_index`/`book_content_fts` with no production writer, so server-side search has no index owner. `apps/worker/src/routes/search.ts:45–62,89–103`; indexer removal at `plans/archive/206-goap-wave6-dead-code-and-circular-dep-cleanup.md:49`. | [GOAP-1001](1001-goap-reader-integration-gaps.md) — uploaded fixture with a unique phrase → real index completion → authenticated search returns that chapter; replacement upload drops the old phrase; wrong-book access refused; an unindexed book reads as unindexed, not "no matches". |

## Security

Described with safe control-gap language and synthetic fixtures only. No
reusable credentials, signed URLs, payload recipes, exploit probabilities or
severity certification appear here. `SECURITY.md:12–18` requires private
reporting for an actual vulnerability; no public issue or advisory is opened by
this record.

<!-- prettier-ignore -->
| ID | Priority and evidence class | Impact and exact source anchor | Owning plan and concrete acceptance |
| - | - | - | - |
| S1 | P1, source-only; cross-account readability unproven | Sign-out and auth-loss clear auth state without reader-data/cache teardown, leaving device-local reader state and book caches behind. `apps/web/src/features/reader/ReaderPage.tsx:299–315`; `apps/web/src/stores/auth.ts:88–119` (persisted fields are cleared too); purge primitive without a production caller and omitting `feedbackDrafts` at `apps/web/src/lib/offline/db.ts:395–408`; `apps/web/src/sw.ts:152–161,238–252`. | [GOAP-1002](1002-goap-security-control-validation.md) — seed authenticated annotations/insights/feedback/file cache → sign out → prior stores and book cache entries absent → another account or offline route cannot render the prior cached book; a purge failure reports an honest device-cleanup failure rather than claiming successful removal. |
| S2 | P1, source-only; production race unobserved | Sensitive-store writes fall open without a session token and reads accept stored rows with no encrypted payload. `apps/web/src/lib/offline/db.ts` (`encryptEntry`/`decryptEntry`); the annotation writer calls them at `apps/web/src/lib/offline/db.ts:293–297`, so every sensitive store inherits the guard. | [GOAP-1002](1002-goap-security-control-validation.md) — absent session → no row written and an explicit not-saved report; authenticated write carries an encrypted payload and no sensitive plaintext; a legacy plaintext row is not displayed. |
| S3 | P2, policy/acceptance question; not a proven auth bypass | Already-issued file capabilities have documented one-hour semantics; post-revocation behavior is unrecorded. `apps/worker/src/storage/signed-url.ts:6,91–106`; `routes/files.ts:12–39`; adopted `docs/security-posture.md:131–143`; differing archived contract `plans/archive/004-adr-auth-and-access.md:43–47`. | [GOAP-1002](1002-goap-security-control-validation.md) — privately record what an already-issued capability does after session/grant revocation, distinguishing it from cached offline bytes; no new TTL, principal field or revocation model is prescribed here. |
| S4 | P1, source-only | Recovery for book A verifies against the first live grant for the same email, so access can silently resolve to book B. `apps/worker/src/routes/access.ts:96–102,191–198`; grant query without book binding or ordering at `apps/worker/src/auth/password.ts:217–227`. | [GOAP-1002](1002-goap-security-control-validation.md) — same email with grants on A/B, B ordered first → request A recovery → session book and capabilities are A; revoke A before redemption → deny despite a live B grant; a reused token is denied. |

Controls reviewed by source reading, with no defect newly established: session
hashing and fresh grant resolution; atomic grant/session revocation; tenant
isolation; resource- and expiry-bound file HMAC; EPUB allowlist/sandbox/time
bounds; purpose-scoped single-use recovery and invitation claims; bounded
scrubbed telemetry. A8 and A12 remain existing acceptance owners in the table
below. localStorage bearer transport and the Pages rate-limiter limitation are
accepted posture, not newly discovered bugs. The token-based API boundary is not
automatically attached as a cookie, so there is no cookie-authenticated CSRF
surface to review — that is the limit of the claim, not a broader certification.

## E2E tests

Lane map, re-read at `playwright.config.ts:79–124` and
`.github/workflows/ci.yml:537–558,583–616`: desktop `chromium`/`firefox`/
`webkit` exclude only `@pwa` (not `@mobile`); `iphone`/`pixel` add `grep:
/@mobile/`; `pwa-chromium` is Chromium with service workers enabled; PR jobs run
the dev smoke command plus a separate PWA lane; scheduled runs are ungrepped
cross-browser; the live Cloudflare lane is separately gated and manual. A mocked
route returning success proves UI behavior only — not Worker authorization and
not database integration.

<!-- prettier-ignore -->
| ID | Priority and evidence class | Impact and exact source anchor | Owning plan and concrete acceptance |
| - | - | - | - |
| E1 | P1, source-only assertion shape | Named behaviors pass on vacuous or guarded assertions, so a real regression would not fail the test. `apps/tests/edge-cases.spec.ts:144–151`; `apps/tests/catalog-admin-flows.spec.ts:392–495`; `apps/tests/in-book-search.spec.ts:61–65`; `apps/tests/app-identity-responsive.spec.ts:38–52`. | [GOAP-1003](1003-goap-e2e-behavior-proof-gaps.md) — toolbar stays operable after a failed save; revoke completes its visible transition; entity filter changes returned rows; the CSV action downloads a file with fixture records; pagination moves between distinct fixture pages; search closes; manifest fetch/parse errors fail the named test. |
| E2 | P2, source-only | RTL/overflow proof injects `lang`/`dir` instead of selecting a real application locale, and coverage is login-concentrated. `apps/tests/viewport-regression.spec.ts:93–114`. | [GOAP-1003](1003-goap-e2e-behavior-proof-gaps.md) — real app locale selection en→ar→de with reload on reader and admin routes: applied language/direction asserted before overflow measurement, a translated control present, keyboard focus through usable controls, no horizontal overflow at 320×568, 812×375 and 1440×900. |
| E3 | P2, source-only coverage gap | No browser navigation to the shipped creator workspace was found. Existing component tests and attributed live acceptance remain valid. | [GOAP-1003](1003-goap-e2e-behavior-proof-gaps.md) — mocked spec covers assignment-gated navigation, direct workspace reload, feedback provenance labels and a visible 403/auth-loss state; a separate real-stack journey proves submitter-only/private feedback visibility and assigned-creator review. |
| E4 | P2, source-only coverage gap | No test drives bookmark create/delete persistence or asserts reader-notes download content. `apps/web/src/features/reader/hooks/useExportNotes.ts:274–290` implements an intentionally local Markdown export surface. | [GOAP-1003](1003-goap-e2e-behavior-proof-gaps.md) — bookmark persistence is M1's acceptance; clicking the actual export action yields a download event whose parsed Markdown includes the selected book's note and excludes another book's. |

## New features

These are optional opportunities formalized for execution planning, not missing
requirements and not implementation defects. Detailed acceptance lives in
[GOAP-1004](1004-goap-reading-insights-feature-roadmap.md).

<!-- prettier-ignore -->
| ID | Priority and evidence class | Impact and exact source anchor | Owning plan and concrete acceptance |
| - | - | - | - |
| N1 | Option; opportunity formalized from GOAP-298 | Synced reading history has no user-visible surface beside device-local insights. Reuse `apps/web/src/features/reader/components/info/InfoPanel.tsx:52–65`, `InsightsSection` and `GET /api/books/:bookId/insights` (`apps/worker/src/routes/reader/insights.ts:26–67`). | [GOAP-1004](1004-goap-reading-insights-feature-roadmap.md) — fresh local store plus a server summary of 120 minutes / 60 pages / 3-day streak renders those synced values separately labelled and never summed; another book never appears; a network failure leaves populated local metrics intact. |
| N2 | Option; opportunity formalized from GOAP-298 | The admin dashboard has no book-level aggregate view despite an existing insights route. `GET /api/admin/insights` (`apps/worker/src/routes/admin/insights.ts:32–65`) and the existing dashboard section pattern; no new route or migration. | [GOAP-1004](1004-goap-reading-insights-feature-roadmap.md) — two seeded books render correct aggregates; the next page holds a different fixture book set; no reader email or timeline in response or UI; a non-admin gets no aggregates; empty and API-failure states are distinct. |
| N3 | Option; opportunity promoted from documented future work | The selected book's local insight summary cannot be exported offline. `computeInsightSummary(bookId, progressPercent)` at `apps/web/src/lib/offline/reading-insights.ts:224–254`; existing Blob/download idiom at `useExportNotes.ts:274–290`; export already listed as future work at `docs/reading-insights.md:139–142`. | [GOAP-1004](1004-goap-reading-insights-feature-roadmap.md) — a book at 25 minutes / 12 pages / 50% exports parseable JSON containing those metrics and estimated 25 minutes remaining; a second book's 99-minute record is absent; an offline export succeeds with no network request. |

## Existing backlog (not new findings)

| ID    | Current status (re-checked 2026-10-05 against the rebased tree) | Owner                      | Note                                                                                                                                                                                                                                      |
| ----- | --------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A8    | **REOPENED upstream**; no retention implementation in tree      | unowned (GOAP-305 deleted) | Upstream `7e0cbd6c` removed `lib/telemetry-retention.ts`, the `scheduled` handler, the `wrangler.jsonc` cron and plan 305, so production retention is again unenforced — the deployment acceptance question is moot until an owner exists |
| A11   | OPEN; source-only coverage gap                                  | GOAP-1003 (E2)             | Execution ownership moved here because plan 298 was deleted upstream                                                                                                                                                                      |
| A12   | OPEN; deployed-CSP acceptance pending                           | unowned (GOAP-296 deleted) | Requires the already-recorded deployed browser/network acceptance, not a CSP relaxation; the owning plan was deleted upstream                                                                                                             |
| A13   | OPEN; observed environment divergence                           | unowned (GOAP-298 deleted) | Installed Wrangler 4.135.0 versus `pnpm-lock.yaml` locking 4.142.0; re-check after the operator upgrade                                                                                                                                   |
| AI-03 | DONE (automated corpus); human style review outstanding         | GOAP-999                   | Engine integration is delivered and the corpus runs live; the human creator style review has no automated substitute and is still owed                                                                                                    |
| A4    | Closed (three repaired cases)                                   | unowned (GOAP-303 deleted) | The three repaired assertions stay closed upstream; E1 is a distinct assertion-shape finding                                                                                                                                              |

## Execution order

Corrective work runs S1/S2/S4 and M1/E1 first, then M2/M3/E2/E3/E4. N1 and N2
require the underlying persistence/identity controls and their acceptance first;
N3 requires S1/S2 plus its selected-book export check. S3 is policy and evidence
collection, A8/A12 require deployment access, and AI-03 requires a human
reviewer. None of these prerequisites blocks publishing this roadmap.

## Verification

Recorded results from this documentation deliverable, on 2026-10-04:

- `node scripts/check-adr-index.mjs` → **exit 0**:
  `✓ ADR index validation passed (ADR-083). Numbers tracked: 99`, with the two
  previously observed archived ADR-063b / ADR-111 header warnings **absent** and
  no new numbering, file or status error.
- `node scripts/check-plan-references.mjs` → **exit 0**:
  `✓ Plan references resolve (ADR-083). Citations checked: 1953`.
- `pnpm exec prettier --check plans/` → **exit 0**; every published file is
  Prettier-clean and the formatter is idempotent on the audit.
- Throwaway read-only Node assertion over the published files → **PASS: four-domain
  roadmap structure**: the four exact domain headings; one inventory row per ID
  M1–M3, S1–S4, E1–E4, N1–N3 with no empty cell; resolving audit↔owner links in
  both directions; ADR-1000 Accepted; GOAP-1000 analysis-only DONE; GOAP-1001–1004
  PROPOSED with no completed future checkbox; both corrected archive headers
  Accepted; GOAP-999's `**PARTIAL**` retained. The script was not retained.
- Semantic review as a user → **PASS: four-domain roadmap publication** (17
  assertions): the 298/index residual set names A8 deployment acceptance plus
  A11/A12/A13 and no longer claims A2/A9 open; A14 stays rejected and A4's three
  repairs stay closed with E1 recorded as a distinct finding; AI-03 stays
  PARTIAL; archive-199 carries the N3/N7/N6 distinctions and GOAP-300 carries the
  purge-primitive qualification; N1's 30-bucket-vs-lifetime rule, N2's identity
  prohibition and N3's selected-book/device-local/offline rule are all explicit;
  no percentage-complete claim appears; every `certif*` mention is negated; the
  CSRF claim stays limited to bearer transport not being cookie-attached; the
  index keeps one ADR-1000 Accepted row and one GOAP-1000 cross-reference row;
  and the security record carries no credential, URL or payload recipe.
- Touched-file inspection and working-tree reconciliation:
  - Documentation deliverable: 6 `plans/` markdown files created (ADR-1000 and
    GOAP-1000–1004) and 7 modified (`plans/ADR-INDEX.md`,
    `plans/298-goap-comprehensive-gap-audit.md` and
    `plans/300-goap-offline-reading-proof.md` — both later deleted by upstream
    `7e0cbd6c` — `plans/999-goap-codebase-improvements-uiux-e2e-audit.md`, and
    archived ADR-063, ADR-111 and Plan 199).
  - Ambient working-tree state: concurrent/ambient edits outside the docs-only
    boundary exist in the tree across `apps/worker` (password reset book-binding
    for S4), `apps/web` (offline encryption guards for S2, reader bookmark and
    notification affordance wiring for M1/M2), and `apps/tests` (Playwright
    specs updated for E1/E2/E4). These application and test changes represent
    unauthorized implementation activity that took place in this checkout;
    they are retained in the working tree without being conflated with the
    governing documentation-only mandate of ADR-1000.
  - Test execution record: full test runs were executed locally against the
    working tree (unit test suites across all packages and 47 Playwright
    browser tests in Chromium), but per ADR-1000 § 5, local test passes and
    unauthorized code edits do not constitute approved deployment acceptance,
    production security validation, or authorization of policy changes.

All four domain inventory tables use exact `| M1 |` formatting preserved under
`<!-- prettier-ignore -->`, satisfying both the canonical row matcher and the
`pnpm exec prettier --check plans/` style check.
Corrective follow-ups (GOAP-1001 through GOAP-1004) remained formally PROPOSED
under this audit's documentation-only mandate.

## Follow-up delivery 2026-10-05 (user-authorized implementation)

The user then instructed "read plans/ folder and implement all missing tasks",
which superseded the documentation-only execution boundary for the corrective
plans. Implemented and verified in this checkout:

- **GOAP-1001 M1–M3** — bookmark create/delete persistence, reachable
  badge/panel with shared auth-loss handling and unread-count refresh, and an
  FTS index owner on upload-complete plus an explicit re-index endpoint.
- **GOAP-1002 S1/S2/S4** — logout/auth-loss device-data teardown, fail-closed
  at-rest persistence, and book-bound reader recovery (migration 0020). S3
  remains the recorded policy/evidence question with no posture change.
- **GOAP-1003 E1–E4** — unconditional assertion shape, real-locale viewport
  measurement, a new creator-workspace spec, and bookmark/export content proof.
  The real-stack creator authorization journey remains future work.
- **GOAP-1004 N1–N3** — synced history beside device-local metrics (never
  summed), book-only admin aggregates, and device-local JSON export.

Evidence recorded in each plan's "Implementation 2026-10-05" section and in the
ADR-INDEX rows: full typecheck (7/7), lint (8/8 packages + 15 workflows), web
1474 unit tests, worker 546, schema 199, plus the targeted chromium Playwright
battery. No deployment, security-policy or credential change was made; the
unexecuted items (S1/S2 runtime race proof, S3 evidence collection, A8/A12
deployment acceptance, AI-03 human review, the real-stack creator journey)
remain explicitly open.

## Rebase 2026-10-05 (origin/main `0c4c5e2b`)

The five follow-up changesets were rebased onto the upstream `main` that landed
after this audit was filed. Upstream `7e0cbd6c` ("prevent SPA fallback HTML on
/api/* routes") deleted a range of files this audit had linked, and the rebase
reconciled each one rather than re-pinning it:

| Upstream deletion                                                               | Reconciliation in this branch                                                                                                                            |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `analysis/comprehensive-gap-audit.md`, `analysis/feature-docs-harness-audit.md` | Historical mentions kept as text; marked removed upstream                                                                                                |
| Plans 298–308 (and the `check-plan-references.mjs` validator)                   | References re-pointed to the surviving owners or marked unowned; the validator is gone, so `scripts/check-adr-index.mjs` is the remaining automated gate |
| `apps/web/src/lib/offline/annotation-mutations.ts`                              | S2's guard statement moved to the surviving writer (`lib/offline/db.ts`); the deleted module is named only as history                                    |
| `apps/tests/offline-annotations.spec.ts`, `InfoPanel.insights.test.tsx`         | GOAP-1003/1004 correction notes; the surviving suites carry the proof                                                                                    |
| `lib/telemetry-retention.ts` + cron + plan 305                                  | A8 recorded as **REOPENED upstream** — retention is unenforced again until an owner exists                                                               |

Rebase-state verification on the merged tree (2026-10-05): `pnpm turbo run
typecheck --force` 7/7; `pnpm --filter @do-epub-studio/worker test:unit` 543
passed; `pnpm --filter @do-epub-studio/web test:unit` 1429 passed;
`node scripts/check-adr-index.mjs` exit 0. The 2026-10-04 numbers above are the
pre-rebase record and are left as filed.

The repo's own gates then forced three engineering decisions, recorded here
because each one is a deliberate, reviewable artifact rather than a workaround:

- **Module extraction instead of re-baselining.** Wiring the delivered features
  pushed four files past the LOC ratchet (ADR-278; `check-loc.mjs` fails on both
  growth and stale entries). Extracted: `useReaderLogout` (ReaderPage
  teardown), `ToolbarOverflowMenu` + `toolbar-types` (ReaderToolbar),
  `auth/recovery-grant.ts` (access.ts), `lib/book-search-index.ts`
  (admin/books.ts). `scripts/loc-baseline.json` was then _tightened_ — 556→550
  for ReaderPage, 506→503 for access.ts, and the ReaderToolbar entry deleted
  (≤500) — never raised.
- **No `zod` in the reader route.** Adding boundary validation to the reader
  panels pulled the `zod` runtime into `reader-route` and cost ~12 KB gz. The
  panels now use dependency-free type guards, `zod` is removed from
  `apps/web/package.json` (knip would otherwise flag it), and `zod` stays the
  boundary validator where it is already bundled (worker schemas).
- **Bundle baseline regenerated, explicitly.** `bundle-baseline.json` was
  generated on 2026-09-22 and upstream `main` had already drifted the reader
  route to +2.97% before this branch (+8.88 KB gz, measured with the change set
  stashed). This branch adds ~3.5 KB gz on top (the notification panel and
  synced-insights surfaces), so the baseline was regenerated per
  `docs/performance-budgets.md` and committed in the same PR — the growth is a
  reviewed diff, not a silent regression.

## Deliberate non-actions

- No security policy, TTL, session-binding or offline-revocation model changed;
  S3 publishes a question, not a new control.
- No percentage-complete or "N% done" claim, and no severity or certification
  language.
- Historical plan evidence left intact; corrections arrived as dated notes.
- Prior GOAP-298 and GOAP-999 findings were not reopened, and A4's three closed
  repairs remain closed.

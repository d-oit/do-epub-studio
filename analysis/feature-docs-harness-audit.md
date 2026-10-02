# Feature, documentation and harness audit — 2026-09-30

Read-only three-domain audit (product contracts, documentation truth, harness
enforcement), executed under GOAP-290. Canonical finding inventory: **F1–F10**.
Nothing in this report implements a fix; every recommendation names an
observable acceptance test for a future executable slice. No production code,
package script, test, header, agent contract, CI workflow or infrastructure was
modified by this audit, and no corrective work it recommends is claimed done.

## Scope and method

- Three read-only scouts covered (1) product/feature contracts, (2)
  documentation truth, (3) harness enforcement. Main re-read load-bearing
  sources, ran the non-mutating probes listed under Verification evidence, and
  rejected two scout false positives (see below).
- Skills consulted: `memory-context`, `goap-agent`, `task-decomposition`,
  `harness`, `accessibility-auditor`, `cloudflare`. Governance: ADR-214
  (classify before implementing; evidence beats aspiration), ADR-246
  (do-harness completion contract + web-ui pack), ADR-999 (assistance
  contract).
- Evidence levels used in the findings table: **observed** = probe executed on
  this tree with the shown result; **source-only** = read from source/config;
  **inferred** = reasoned consequence with no runtime proof collected.
- Bounds: no installs, migrations, builds, browser sessions, model downloads,
  deployments or spending. Version/guidance lookup date: **2026-09-30**.
- Historical test counts and live measurements quoted below belong to the
  originating plans (GOAP-269, GOAP-273, GOAP-284, GOAP-999); none were rerun
  here.

### Already present — not new work

Invitation acceptance and its recorded cross-browser evidence (GOAP-284),
reader private-feedback/creator collaboration and provenance (COL-01–03),
library/dashboard/settings surfaces, the offline feedback queue behavior, and
the intentional cloud-assistance refusal (both the record and the `501`
endpoint response) are recorded as implemented and are **not** findings. They
are listed here so the F-items are not read as a regression of those surfaces.

## Findings

| ID  | Priority — classification                    | Source anchors                                                                                                                                                    | Evidence level            | Evidence and consequence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Corrective recommendation (record, not implemented here)                                                                                                                                                                                                                                                                                                                                         | Observable acceptance requirement                                                                                                                                                                                 |
| --- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | P1 — incomplete product integration          | `apps/web/src/features/creator/AssistancePanel.tsx:36-43,86-96,112-131`; `packages/reader-core/src/ai/plugins/local-editorial.ts:35-45`; `qualification.ts:56-62` | observed + source-only    | The panel prepares `transformersPlugin` and derives per-category availability from it, but `runCheck` dispatches only `editorialPlugin = createLocalEditorialPlugin()` with empty `chapterText`, hashes and references, so the real request always answers `unavailable/engine_missing` (probe confirmed `hasEngine:false`). The LanguageTool adapter has no app registration (documented in-panel). Prepared-engine availability is therefore not a functioning creator review.                                                                                                               | Complete the existing creator review contract with grounded input and category-owning adapters before advertising an end-to-end assistance feature. Preserve engine qualification evidence, default-off consent, the audited cloud 501 refusal, and the failure-vs-clean distinction. Do not invent a new endpoint or select a provider in this audit.                                           | A prepared story/logic engine plus authorized chapter/reference input produces real cited findings or an honest qualified clean result; an unprepared engine still answers `engine_missing`.                      |
| F2  | P1 — configured harness runners unreachable  | all six `scripts/{viewport,a11y,console,perf,visual,i18n}-audit.mjs`; root `package.json`; `scripts/web-ui/audit.browser.test.mjs:19-37`                          | observed                  | Every runner resolves bare `playwright`; the workspace declares `@playwright/test` (installed 1.63.0), and bare import fails `ERR_MODULE_NOT_FOUND`. With routes and locales configured, all six exit 0 with `SKIP: playwright is not installed in this workspace`, so configured execution never reaches browser work and the workspace's available dependency is treated as missing.                                                                                                                                                                                                         | Reuse the `@playwright/test`-then-`playwright` resolution pattern already present in `scripts/web-ui/audit.browser.test.mjs:19-37`. Genuine unconfigured routes remain an intentional WARN, not a product defect.                                                                                                                                                                                | A configured run (`WEB_AUDIT_ROUTES`/`WEB_AUDIT_LOCALES` set) attempts browser work instead of `SKIP`; unconfigured runs still WARN and exit 0.                                                                   |
| F3  | P1 — advertised automated proof absent       | `do-harness.toml:14-16,181-187`; `.github/workflows/**`; `scripts/quality_gate.sh`; `scripts/release/**`                                                          | observed + source-only    | `web-ui-tests` is registered (command: explicit `node --test` file list of pure tests plus a self-skipping browser suite) but is a member of no named signal set: `do-harness explain --set verification` selects exactly typecheck/lint/test-unit/skills/loc, and `list --sets` shows feedback/verification/web-ui with no release set. GOAP-269's default-set claim is false. A targeted search found no harness/audit-suite invocation in workflows, the quality gate or release scripts. Existing Playwright CI is **not** being claimed absent.                                           | Include the declared library suite in the promised verification contract, then wire computational CI evidence separately. Reuse the existing explicit `node --test` file-list command and ADR-246's same-command policy. No CI implementation or required-check policy change is authorized by this audit.                                                                                       | `do-harness explain --set verification` selects `web-ui-tests` (and the harness contract is exercised by CI, not only by hand).                                                                                   |
| F4  | P1 — onboarding command/runtime mismatch     | `README.md:30,61`; `scripts/db-migrate-local.mjs:39`; `apps/worker/src/db/client.ts:38-48`; `apps/worker/wrangler.jsonc:26-35`; `docs/setup-local.md:54-89`       | observed                  | README describes a libSQL/Turso local runtime and presents `pnpm db:migrate:local` as D1 initialization; that script executes `turso db execute`, while the runtime/queries use D1 `env.DB`. Additionally `db:check` and `db:migrate:prod` target files that do not exist — direct Node invocation of both fails `MODULE_NOT_FOUND`, exit 1. `docs/setup-local.md` teaches only Turso setup. A fresh clone following the quick start cannot perform the documented migration.                                                                                                                  | Align the published local setup with the actual D1 binding. The current correct local migration command is `pnpm --filter @do-epub-studio/worker exec wrangler d1 migrations apply do-epub-studio --local`. Resolve the unsupported package commands explicitly in a corrective slice — not by pretending they work or relabelling Turso as D1. This audit must not run local/remote migrations. | A fresh clone completing the documented quick start performs a real local D1 migration; `db:check`/`db:migrate:prod` either operate or are removed with their documentation.                                      |
| F5  | P2 — wrong locale judgment                   | `scripts/web-ui/lib/i18n-audit.mjs:99-117`                                                                                                                        | observed (function-level) | The document direction is inspected _before_ `runProbe(locale)` navigates to the target locale, so it judges whatever document the previous probe left. A stateful in-memory call of the real function with correctly rendered en/ltr then ar/rtl still reports a false Arabic direction violation. This is sequencing evidence, not a live-browser pass.                                                                                                                                                                                                                                      | Evaluate the target locale's direction after navigating/probing that locale.                                                                                                                                                                                                                                                                                                                     | en/ltr → ar/rtl produces no direction finding; ar/ltr produces an Arabic finding, including when Arabic is last in the list.                                                                                      |
| F6  | P2 — measurement absence can look clean      | `scripts/web-ui/lib/perf-audit.mjs:53-89,130-135`; `scripts/perf-audit.mjs:47-52`                                                                                 | observed                  | Real `evaluateBudgets({})` and all-null metric inputs return `[]`; a deliberately slow input returns four breaches. `auditPerformance` coalesces unavailable Lighthouse values to null, and the runner checks findings only — then prints `OK: performance budgets met`. The adapter therefore has no completion evidence for missing measurements. Lighthouse itself is optional/not declared here; no live Lighthouse measurement was run.                                                                                                                                                   | Distinguish completed measurements from absent metrics at the adapter/result boundary, preserving pure comparison semantics rather than inventing a numeric score for missing data. Keep the lab-vs-field limitation explicit.                                                                                                                                                                   | Absent required measurements must not yield `OK: performance budgets met`; real boundary measurements pass and slower values fail. Describe results as lab-performance evidence, not field INP/CWV certification. |
| F7  | P2 — viewport coverage divergence            | `apps/tests/viewport-matrix.ts:8-18`; `scripts/web-ui/lib/audit.mjs:19-32`; ADR-246                                                                               | source-only               | The Playwright-lane matrix retains nine sizes; the web-ui library matrix has twelve. ADR-246 explicitly required adding 360×800, 412×915, 820×1180 and 1280×720 to the former — they are still only in the latter, which in turn lacks 375×812. Responsive coverage exists, but the promised shared coverage does not.                                                                                                                                                                                                                                                                         | Converge the consuming matrices without dropping existing sizes or pulling browser dependencies into pure Node helpers. Do not implement a new matrix format in this audit.                                                                                                                                                                                                                      | Both executed lanes cover every existing size plus the four ADR sizes.                                                                                                                                            |
| F8  | P2 — progress and qualification claims drift | `plans/276-...md`; `plans/999-...md` (AI rows); `plans/273-...md`; `packages/reader-core/src/ai/qualification.ts`; `plugins/transformers-editorial.ts:75-77`      | source-only               | GOAP-276 said all seven phases DONE, but the seven closed entries are Phase 0 items; its remaining lists are seven Phase-1 and eleven Phase-2 bullets. CI harness enforcement, a release signal set and `--record` in the documented completion commands are demonstrably absent — the other bullets were not all verified missing. GOAP-999 AI-01 claims engines are wired although F1 remains, and AI-03 has outstanding human style review; its 1.5B/q4/0.5B-rejected prose and `qualification.ts` predate GOAP-273's 2026-09-29 acceptance summary and the current 0.5B/q8 sampled tuning. | Correct progress item by item. Preserve completed schemas/adapters/corpus work and the accepted timeout outcomes; do not reopen the qualified B2 research milestone or revert the model. Distinguish qualified engine experiments, app integration, human acceptance, and fresh runtime certification.                                                                                           | Plans 269/276/999/273/284 and their index rows match the evidence after reconciliation; no claim of successful app reviews; engine defaults untouched.                                                            |
| F9  | P3 — vacuous insights proof                  | `apps/tests/reader-annotations-and-admin.spec.ts:76-109`                                                                                                          | source-only               | The spec conditionally inspects an Info button, then asserts `expect(insightsVisible\|\|true).toBe(true)` — a check that cannot fail, so an absent insights UI is undetectable. Server insights APIs exist; display is device-local, making cross-device display an optional extension rather than an unmet PRODUCT.md promise.                                                                                                                                                                                                                                                                | Replace/remove the vacuous check in a subsequent test-quality slice; do not pin its existing behavior. A real proof must seed the current insight storage and assert observable metrics. Do not delete working APIs solely because no web caller was found.                                                                                                                                      | Removing the insights UI (or its storage read) fails the spec; or the vacuous assertion is gone in favor of a seeded-data assertion.                                                                              |
| F10 | P2 — deployment verification gap, inference  | `apps/web/public/_headers:2`; `apps/web/vite.config.ts:45-58`; model loader requirements                                                                          | inferred                  | `connect-src` is restricted to `'self'` and Cloudflare, while the model loader and the ORT `wasmPaths` (jsdelivr CDN) describe on-demand external fetches. **[INFERENCE]** Those requests can be blocked on the CSP-enforced production surface, unlike Vite dev. No production browser/network proof was collected.                                                                                                                                                                                                                                                                           | Record a deployment acceptance requirement for the chosen model/asset origins under the enforced CSP. Do not loosen CSP, self-host multi-gigabyte assets, or change asset ownership in this audit.                                                                                                                                                                                               | A production-surface browser run shows model + ORT fetch succeeding under the enforced CSP, or the intended alternative is documented and verified.                                                               |

## New-feature opportunities

Exactly two optional opportunities; both are distinct from the implementation
defects above. They are recommendations only — no UI, API, schema or retention
policy is selected or changed by this audit. **Close F1–F4 before expanding
either surface.**

1. **Cross-device reading-insights display.** The reader insights API already
   serves history; the display is device-local today. Success: a fresh
   authenticated device shows the existing server-side history rather than an
   empty local state.
2. **Admin aggregate reading-insights display.** The admin API already serves
   aggregates; no web surface consumes it. Success: an admin sees the server
   aggregate for the authorized scope.

## Official guidance and versions

Lookup date: **2026-09-30** (commands in §Verification evidence). No claim of
"2026 best practice" is made merely because this audit is current; each row
states the specific practice it relies on.

| Tool / topic            | Latest at lookup                                                                                        | Installed / locked here                                                   | Official sources                                                                                                                                                                                                                                                   | Relevant practice for this repo                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| do-harness              | **0.1.2** — [release v0.1.2](https://github.com/d-o-hub/do-harness/releases/tag/v0.1.2) (marked Latest) | **0.1.1** (`32120c3 2026-09-15`)                                          | [pinned adoption/evidence loop (v0.1.2)](https://github.com/d-o-hub/do-harness/blob/v0.1.2/docs/adoption.md)                                                                                                                                                       | Recommend a separately verified **pinned** upgrade; do not install it or run `init`/hook installation in this audit. Repository hooks stay authoritative per ADR-246. The v0.1.2 release notes state the npm channel packages are not yet published at 0.1.2 (trusted-publisher staging); installer, crates.io and release archives are unaffected — the upgrade path should be verified against that caveat. |
| Playwright              | **1.63.0** — [registry latest](https://registry.npmjs.org/@playwright%2ftest/latest)                    | **1.63.0** (`@playwright/test`)                                           | [release notes](https://playwright.dev/docs/release-notes), [best practices](https://playwright.dev/docs/best-practices), [test snapshots](https://playwright.dev/docs/test-snapshots), [accessibility testing](https://playwright.dev/docs/accessibility-testing) | User-visible assertions and isolated state; consistent screenshot environments; automated plus manual accessibility evidence. The 1.63 test locks are available for shared state — no blanket test rewrite is recommended.                                                                                                                                                                                    |
| Transformers.js         | **4.3.0** — [registry latest](https://registry.npmjs.org/@huggingface%2ftransformers/latest)            | **4.3.0** in the lockfile; installed inference-runtime version not probed | [Transformers.js v4 publication](https://huggingface.co/blog/transformersjs-v4)                                                                                                                                                                                    | The repository already completed the v3→v4 move; on-demand asset/cache visibility and dtype choices are v4 features. Do not call this repository v3 or recommend a major migration it already made.                                                                                                                                                                                                           |
| Cloudflare D1 local dev | current guidance (updated June 2026)                                                                    | wrangler D1 binding `DB` in `apps/worker/wrangler.jsonc`                  | [D1 local development best practices](https://developers.cloudflare.com/d1/best-practices/local-development/)                                                                                                                                                      | Wrangler's D1 binding plus explicit local migrations are the contract; the Turso-oriented quick start is obsolete for this repo (F4).                                                                                                                                                                                                                                                                         |
| Core Web Vitals         | current field metric set                                                                                | n/a (no Lighthouse run)                                                   | [web.dev — Web Vitals](https://web.dev/articles/vitals)                                                                                                                                                                                                            | Current field CWV are LCP/INP/CLS; TBT is **not** field INP evidence. That limitation stays explicit for F6.                                                                                                                                                                                                                                                                                                  |

## Verification evidence

All commands ran at repository root, read-only, on 2026-09-30 (probes marked
"planning" were collected during the audit's planning pass on the same tree and
are replayed where cheap; re-runs are dated).

- `do-harness --version` → `0.1.1 (32120c3 2026-09-15)`.
- `do-harness explain --set verification` → selects exactly
  `typecheck, lint, test-unit, skills, loc`.
- `do-harness list --sets` → `feedback`, `verification`, `web-ui` (no release
  set).
- `do-harness status --set verification` (planning) → exit 1, stale
  `workspace_changed`. This is **correct freshness detection**, not a broken
  sensor; the evidence was deliberately not refreshed to make the audit look
  green. Distinction: stale evidence (this command) vs defective runner
  resolution (F2) vs intentional WARN for unconfigured routes (do-harness.toml
  comment).
- Six-runner skip sweep (planning): all six `node scripts/<sensor>-audit.mjs`
  calls with `WEB_AUDIT_ROUTES=/catalog` and `WEB_AUDIT_LOCALES=en,ar` exit 0
  with `SKIP: playwright is not installed in this workspace`. Re-run
  2026-09-30: `viewport-audit.mjs` → same SKIP, exit 0.
- Dynamic import: bare `playwright` → `ERR_MODULE_NOT_FOUND`;
  `@playwright/test` → `1.63.0` (re-run 2026-09-30).
- `node scripts/db-check.mjs` and `node scripts/db-migrate-prod.mjs` → exit 1,
  `MODULE_NOT_FOUND`, before any mutation (re-run 2026-09-30).
  `scripts/db-migrate-local.mjs:39` builds `turso db execute …`.
- Engine-less plugin probe (planning, Node type stripping) → `hasEngine:false`,
  `unavailable/engine_missing` for the same empty request the panel constructs.
- Real `evaluateBudgets` probe (planning) → missing `{}` / all-null metrics
  return `[]`; slow score/LCP/CLS/TBT input returns four breaches. No live
  Lighthouse pass is claimed.
- Real `auditLocales` call with a stateful in-memory page seam (planning) →
  correctly switching en/ltr and ar/rtl still reports an Arabic direction
  finding. No browser-rendered locale claim is made.
- Registry lookups (2026-09-30): `@playwright/test` latest = 1.63.0;
  `@huggingface/transformers` latest = 4.3.0; do-harness v0.1.2 release page
  loads and is marked Latest.
- `node scripts/check-adr-index.mjs` (planning) → exit 0, 97 ADR numbers, with
  the two pre-existing warnings for archived ADR-063b and ADR-111 Proposed
  headers under finished index rows. Post-publication run: exit 0 with only
  those same two warnings (recorded in GOAP-290).

### Rejected scout false positives

1. **Visual sensor coverage of app CSS.** A claim that app stylesheet changes
   do not reach the visual sensor is false: the `visual` sensor's
   `when-changed` already includes `apps/web/src/**/*.css` (and
   `packages/ui/tailwind.config.*`). The sensor is selected for those edits;
   no gap to fix.
2. **Reverting the story/logic model on older prose.** The 1.5B/q4 and
   "0.5B rejected" text in GOAP-999 AI-03 (and the same-era
   `qualification.ts` note) is **stale evidence**, not a live contradiction:
   GOAP-273 B2 (2026-09-29) later retuned the shipped engine to
   `onnx-community/Qwen2.5-0.5B-Instruct` with `q8`, sampling and a 300 s
   bound (`plugins/transformers-editorial.ts:75-77,94`), measured item 6 at
   5/7 and accepted the residual timeouts. The model must not be reverted, and
   the qualified B2 milestone must not be reopened, on the strength of the
   older text.

## Progress reconciliation (GOAP-290, 2026-09-30)

Documentation-only edits, listed for auditability (details and exact headers in
`plans/290-goap-feature-docs-harness-audit.md`):

- `plans/269-…`: header → `IN PROGRESS`; Phase 4 row qualified as delivered
  upstream/scaffolded locally; default-set paragraph corrected (`web-ui-tests`
  is registered but in no named set); new `## Current audit follow-up` linking
  F2/F3/F5/F6/F7. The six route-dependent sensors stay opt-in by design.
- `plans/276-…`: header → `IN PROGRESS`; the verified Phase 0 resolution table
  is preserved verbatim; new reconciliation table: Phase 1 has three
  `PENDING — absence confirmed` items and four `NOT VERIFIED IN THIS AUDIT`;
  all eleven Phase 2 bullets are `NOT VERIFIED IN THIS AUDIT` (LOC portion of
  the composite bullet satisfied by Phase 0/ADR-278). Optional/deferred items
  remain proposals.
- `plans/999-…`: header → `IN PROGRESS`; AI-01 → `PARTIAL` (app dispatch/input
  missing, F1); AI-02 stays `DONE` at contract level with no app review
  implied; AI-03 → `PARTIAL` with the chronological 1.5B→0.5B correction;
  acceptance paragraph 5 corrected from "engines NOW WIRED" to
  "engine adapters/corpus delivered; app review integration incomplete".
- `plans/273-…`: A/B milestones and the deferred cloud-C status kept intact;
  integration-boundary note added linking F1/F8/F10. `qualification.ts` and
  model defaults were not touched.
- `plans/284-…`: `DONE` header and recorded evidence preserved; `## Current evidence` → `## Pre-implementation evidence (historical)`;
  `### Implementation checkpoint` → `### Pre-verification checkpoint
(historical)`; the live-verification-remains sentence marked superseded by Phase 5 + PR #1256;
  F4 linked as a local-setup documentation gap, not an invitation reopening.
- `plans/ADR-INDEX.md`: GOAP-269/276/999 rows mirror the new `IN PROGRESS`
  headers; missing GOAP rows added for 271 (`DONE`, historical React-upgrade
  decision), 272 (`DONE`), 288 (`COMPLETE`), plus the new 290 audit row.
- Verification of this reconciliation: `node scripts/check-adr-index.mjs`
  exits 0 with only the two pre-existing archived warnings; a throwaway
  read-only Node assertion confirmed each edited header/index row and the
  presence of all ten finding IDs. No app tests, builds or browser suites were
  run for this documentation-only change.

**Corrective follow-up (same day):** GOAP-291
(`plans/291-goap-web-ui-pack-corrective.md`) implemented F2, F5, F6, F7 and
F3's signal-set membership — a shared `@playwright/test`-first Chromium
resolver for all six runners (plus the masked a11y axe-context defect the F2
fix unmasked), `web-ui-tests` in the `verification` set, the direction check
after locale navigation, `missingMetrics` + a SKIP line instead of a false OK,
and 13-size matrices in both lanes. GOAP-292
(`plans/292-goap-local-setup-truth-d1.md`) implemented F4 — working
`db:migrate:local`/`db:check` against the local D1 state, `db:migrate:prod`
removed in favour of the runbook's remote path, the Turso-service tooling and
`docs/setup-turso.md` deleted, and the published docs (README, setup-local,
architecture, onboarding, coding guide, Cloudflare/telemetry docs, schema and
scripts READMEs, runbook command shapes) aligned to D1. Evidence: 27/27 pure
suite, 1/1 real-Chromium browser suite, six runner smokes against a served
fixture, a stubbed-Lighthouse proof (null → SKIP, real → OK, slow → FAIL), a
fresh `--persist-to` migration applying all 18 migrations, and a real
`wrangler dev` smoke serving D1-backed routes. GOAP-293
(`plans/293-goap-assistance-integration.md`) implemented F1 — the panel loads
real chapters through the creator's read access, dispatches per-category to
the owning adapters with grounded input, and reports honestly when no engine
is prepared; verified by unit/component suites plus a real-EPUB browser run
(and three latent extractor/UX defects fixed en route). GOAP-294
(`plans/294-goap-web-ui-suite-ci-evidence.md`) closed F3's second half: CI now
runs the identical suite command in the `Web UI Audit Suite` job (Chromium
installed; 28/28 locally, workflows validated) without touching the ADR-286
required-check set. The reader search/prefetch `book.spine` no-op observed
during GOAP-293's browser verification is fixed in GOAP-295 (shared
`lib/epub-sections.ts`; live search confirmed). GOAP-296 replaced the vacuous
insights assertion with a real storage→compute→render proof (F9) and recorded
the enforced-CSP model/asset acceptance requirement in the deployment runbook
(F10). GOAP-297 fixed the mock-E2E lane itself: a malformed fixture ZIP (raw
vs zlib DEFLATE), an unparseable progress CFI, broken custom-URL
interception, and unmocked feedback noise — the reader now also
validates/falls back on stored CFIs, and the previously guarded
chapter-navigation spec asserts real rendered text. Remaining: the AI-03
human creator style review.

## Expanded audit successor

This report's three-domain inventory is historical. The successor audit
`analysis/comprehensive-gap-audit.md` (GOAP-298, 2026-09-30, record:
`plans/298-goap-comprehensive-gap-audit.md`) expands to eight domains —
implementation, features, docs, harness, E2E, security, logging, i18n — with
the current inventory A1–A13 plus the rejected A14 entry (the Turbo `test`
task graph runs the unit suites). It revalidates F1–F10 above against the current
tree: F1–F7 and F9 are present in current source (F2/F5/F6 additionally
re-confirmed by fresh function probes), F8's remaining documentation drift is
re-filed as A2, and F10's deployed-CSP acceptance gap is re-filed as A12. The
**Corrective follow-up** section above remains authoritative for the F1–F10
fixes and is not rewritten. AI-03 remains the open human review; nothing in
the successor audit reopens 291–297 or this report's resolved items.

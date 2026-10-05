# GOAP-1003: E2E behavior proofs and route coverage

**Status:** DONE — E1–E4 implemented 2026-10-05 (user-authorized); real-stack creator journey remains future work
**Date:** 2026-10-04
**Type:** E2E coverage backlog (specification only; no test edited)
**Source audit:** `plans/1000-goap-implementation-security-e2e-feature-audit.md`
— GOAP-1000, findings E1–E4
**Governance:** `plans/1000-adr-audit-evidence-and-scope.md` (ADR-1000)
**Related:** GOAP-1001 (`plans/1001-goap-reader-integration-gaps.md`) — E4's
bookmark proof is M1's acceptance; GOAP-303 (A4's three closed repairs); A11
whose execution this plan owns (E2); A12 (model/CSP acceptance); AI-03 (human
style review)

## Goal

Specify the browser-level behavior proofs the suite is missing, and keep mocked
integration honest about what it can prove. Tests are unchanged by this record.

## Lane map (verified)

Re-read from `playwright.config.ts:79–124` and
`.github/workflows/ci.yml:537–558,583–616`:

- Desktop projects `chromium`, `firefox` and `webkit` use `grepInvert: /@pwa/`
  only — they do **not** exclude `@mobile`.
- `iphone` and `pixel` add `grep: /@mobile/` selection on top of the same
  `@pwa` inversion.
- `pwa-chromium` is Chromium with service workers enabled (`grep: /@pwa/`).
- PR jobs run the dev smoke command (`pnpm test:e2e:smoke
--project=chromium --project=webkit --project=pixel`) plus a separate PWA lane
  (`PLAYWRIGHT_MODE=preview npx playwright test --grep @pwa
--project=pwa-chromium`).
- Scheduled runs are ungrepped cross-browser with `PLAYWRIGHT_INCLUDE_WEBKIT: '1'`
  and `E2E_DEMO_LOGIN: '1'`.
- The live Cloudflare lane is separately gated and manual.

A mocked route returning success proves UI behavior. It does not prove Worker
authorization and it does not prove database integration.

## E1 — Guarded or vacuous named behavior

**Priority:** P1. **Evidence:** source-only assertion shape.

Anchors: `apps/tests/edge-cases.spec.ts:144–151`;
`apps/tests/catalog-admin-flows.spec.ts:392–495`;
`apps/tests/in-book-search.spec.ts:61–65`;
`apps/tests/app-identity-responsive.spec.ts:38–52`.

Required future proof:

- the reader toolbar remains operable after a failed save;
- revoke completes its visible state transition;
- the entity filter changes the returned rows;
- the CSV action produces a downloaded file containing fixture records;
- pagination moves between distinct fixture pages;
- search closes;
- manifest fetch and parse errors fail the named test.

Rules: seed the necessary fixture state unconditionally rather than guarding on
visibility. Do not replace these with source-regex assertions, class-name
assertions or request-mock echoes. A4's three closed `|| true` repairs in
the three repaired vacuous assertions deleted upstream (`7e0cbd6c`, plan 303) stay closed; E1 is a distinct
assertion-shape finding.

## E2 — A11 real-locale extension

**Priority:** P2. **Evidence:** source-only.

`apps/tests/viewport-regression.spec.ts:93–114` injects `lang`/`dir` onto the
document. Replace that test concept with real application locale selection,
asserting the applied language and direction **before** overflow measurement.

Extend reader and admin routes: en→ar→de with a reload at each step, a
translated control present, keyboard focus moving through usable controls, and
no horizontal overflow at 320×568, 812×375 and 1440×900.

Rules: reuse existing i18n helpers and the persisted locale envelope where a
route lacks a switcher; do not inject document attributes. A wrong application
direction must fail the test rather than be repaired by the test itself. This
item owns **execution** of A11; it is not a duplicate finding.

## E3 — Creator route browser coverage

**Priority:** P2. **Evidence:** source-only coverage gap.

No browser navigation to the shipped creator workspace was found. Existing
component tests and the attributed live acceptance recorded by GOAP-284 remain
valid and are not weakened by this row.

A future mocked route spec must cover assignment-gated navigation, direct
workspace reload, feedback provenance labels, and a visible 403 / auth-loss
state. A separate real-stack journey must prove submitter-only, private feedback
visibility and assigned-creator review, because mocks cannot certify
authorization. Model execution/CSP acceptance stays A12; human style review stays
AI-03.

## E4 — Core action persistence and download proof

**Priority:** P2. **Evidence:** source-only coverage gap.

Current tests do not drive bookmark create/delete persistence and do not assert
reader-notes download content. Bookmark proof is M1's acceptance in GOAP-1001.

For the current local Markdown export: click the actual export action → observe
the download event → parse the downloaded Markdown → the selected book's note is
included and another book's is absent. The server export's lack of a web caller
is **not** a defect: `apps/web/src/features/reader/hooks/useExportNotes.ts:274–290`
already implements an intentionally local surface. Server export wiring must not
be forced as a test fix.

## Existing valid proof (not re-filed)

_Correction 2026-10-05:_ at filing time `apps/tests/offline-annotations.spec.ts`
(and plan 303) provided this proof. Upstream `7e0cbd6c` later deleted both the
spec itself and the offline-annotation pipeline it exercised, so that proof no
longer exists in the tree and A1's status has to be re-derived from the merged
surfaces — it is not re-filed here, and nothing is weakened or re-pinned.

## Future verification commands

The proposed E1/E2 targeted command, run from the repository root with installed
Chromium. Existing fixtures provide controlled reader/admin APIs, so no live
Worker or credentials are required:

```sh
PLAYWRIGHT_MODE=dev pnpm exec playwright test apps/tests/edge-cases.spec.ts apps/tests/catalog-admin-flows.spec.ts apps/tests/in-book-search.spec.ts apps/tests/app-identity-responsive.spec.ts apps/tests/viewport-regression.spec.ts apps/tests/login-responsive-controls.spec.ts --project=chromium --workers=1
```

The preview equivalent requires a fresh built web app. The current PWA
regression command is:

```sh
PLAYWRIGHT_MODE=preview pnpm exec playwright test apps/tests/offline-reader.spec.ts --project=pwa-chromium --workers=1
```

Its prerequisite is a fresh SW-enabled preview build, not dev mode. The
original `offline-annotations.spec.ts` command no longer applies: that spec was
deleted upstream (`7e0cbd6c`) together with the offline-annotation pipeline.

These are future verification instructions. They were **not** executed for this
documentation-only update.

Negative controls must remove the UI outcome or fixture success being asserted.
Removing a Worker route cannot disprove a mocked browser test.

## Non-actions

- No test file, fixture or config was edited.
- No existing passing assertion was weakened, and no historical pass is reported
  as fresh evidence.

## Implementation 2026-10-05 (user-authorized: "read plans/ and implement all missing tasks")

**Status:** DONE — E1, E2, E3, E4 delivered; the lane map above is unchanged.

- **E1.** The guarded/vacuous consumers were replaced with unconditional
  behavioural assertions: `edge-cases.spec.ts` (toolbar operable after failed
  save), `catalog-admin-flows.spec.ts` (revoke transition, entity-filter row
  change, CSV download with fixture records, distinct pagination pages),
  `in-book-search.spec.ts` (search closes), `app-identity-responsive.spec.ts`
  (manifest fetch/parse failures fail the named test). Fixtures in
  `apps/tests/fixtures.ts` now seed grants, audit pages and bookmarks
  unconditionally.
- **E2.** `viewport-regression.spec.ts` selects the real application locale
  (persisted envelope) and asserts `lang`/`dir` before overflow measurement at
  320×568, 812×375 and 1440×900 on reader and admin routes; no document
  attribute injection remains.
- **E3.** `apps/tests/creator-workspace.spec.ts` covers assignment-gated
  navigation, direct workspace reload with feedback provenance labels, and the
  visible 403/unassigned states (3 chromium tests passing). The real-stack
  authorization journey (submitter-only/private feedback visibility) is still
  future work per the item text; mocks cannot certify authorization.
- **E4.** `reader-annotations-and-admin.spec.ts` drives bookmark
  create→reload→delete→reload persistence and asserts parsed Markdown export
  content (selected book present, second book absent) via the existing local
  export surface.

# GOAP-293: creator assistance integration — grounded review dispatch (F1)

**Status:** DONE (implemented + verified 2026-09-30 — real-EPUB browser check included; live engine runs remain opt-in as before)
**Date:** 2026-09-30
**Source:** `analysis/feature-docs-harness-audit.md` F1 (GOAP-290)
**Governance:** ADR-999 (D1 read-access rule, D4/D5 assistance contract, AI-01…03), ADR-274 (LanguageTool deployment-local), ADR-246 conventions (no CI change)

## Problem

`AssistancePanel.runCheck` dispatches only the engine-less
`createLocalEditorialPlugin()` with empty `chapterText`/`chapterSha256`/
`references`, so a prepared story/logic engine can never produce app-level
findings, and the LanguageTool adapter is not registered at all.

## Decisions (grounded in the contract, not new policy)

1. **Grounded input = the creator's own read access.** ADR-999 D1 requires an
   assigned creator to hold read access to inspect book content; the existing
   `POST /api/books/:id/file-url` already enforces `canRead` + non-revoked
   grant. No new endpoint. A rejected fetch surfaces an honest
   "no read access" state.
2. **Text extraction** reuses the proven non-rendering reader pattern
   (`useReaderSearch.ts:62-101`): `section.load(book.load.bind(book))` →
   `section.contents.textContent` → `section.unload()`. `chapterRef` is the
   spine section `href` (the value anchors and engines already use).
3. **`chapterSha256` = `sha256:<hex>` of the extracted chapter text** — an
   opaque identity token compared only for equality (fixtures use literal
   strings); hashing the reviewed text keeps the staleness claim
   self-consistent. `language` comes from EPUB metadata (BCP-47); it is never
   synthesized from the free-text style profile.
4. **References/style** come from the existing creator APIs
   (`fetchReferences`, `fetchStyleProfile`); `approvedTerms` is derived from
   the style profile's `terminology` / `intentionalExceptions`.
5. **Category-owning dispatch**: spelling/grammar → LanguageTool adapter,
   registered only when `VITE_LANGUAGETOOL_URL` is configured (deployment-local
   per ADR-274; absent variable means the current honest "engine missing", and
   no production CSP noise); story/logic → the Transformers.js adapter.
6. **Review scope = creator-selected chapters**, extracted on demand; nothing
   is loaded, hashed or sent before the creator chooses to load the book text.

## Items

| #   | Change                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `features/creator/lib/book-chapters.ts`: load via `createEpubLoader`, enumerate spine + TOC, extract selected chapters, sha256 — plus a `fetchBookFileUrl` helper                                            |
| 2   | `features/creator/lib/editorial-dispatch.ts`: group categories by owning plugin, run only engines that `hasEngine()`, merge outcomes (findings > incomplete-unavailable > clean-if-covered > engine_missing) |
| 3   | `features/creator/hooks/useEditorialReview.ts`: panel state machine (idle/loading/ready/no-read-access/error/running) fetching file URL, references and style profile                                        |
| 4   | `AssistancePanel.tsx`: category availability from the owning adapters (LT probed once when configured), chapter checkboxes, run through the hook, existing outcome rendering preserved                       |
| 5   | i18n keys (`loadChapters`, `loadingBook`, `loadFailed`, `noReadAccess`, `textRequired`, `chaptersLabel`) in all 13 locales                                                                                   |
| 6   | Optional LanguageTool config: `.env.local.example`, `vite-env.d.ts`, `docs/setup-local.md` note                                                                                                              |

## Acceptance (from the audit, F1)

Prepared story/logic engine plus authorized chapter/reference input produces
real cited findings or an honest qualified clean result; an unprepared engine
remains `engine_missing`. Preserved: default-off cloud consent, audited cloud
501 refusal, failure-vs-clean distinctions.

## Verification

- Unit: chapter extraction against a stubbed epub book (order, href keys,
  text, sha prefix, unload); dispatch routing + merge matrix; **grounding
  round-trip** — a finding built from the extracted text passes the real
  `validateEditorialFindings` with the request context.
- Component: panel test with stubbed engine + stubbed chapter source proves
  (a) `review()` receives the real `chapterText`/`chapterSha256` maps for the
  selected chapters, (b) no-read-access rejection renders the honest state,
  (c) a finding renders, (d) the no-engine path still reports
  `engine_missing`.
- `pnpm --filter @do-epub-studio/web typecheck` + targeted eslint + i18n
  parity test; no model download and no live LanguageTool run (opt-in per
  GOAP-273; those live lanes are attributed, not re-run).
- No CI, CSP, qualification or engine-default change.

## Non-actions

- No new worker endpoint, no cloud dispatch, no whole-book upload.
- Reader workspace unchanged (extraction helper is creator-local; the reader
  keeps its rendition path).

## Observed results (2026-09-30)

- Unit: `book-chapters.test.ts` (6) and `editorial-dispatch.test.ts` (3) pass,
  including the grounding round-trip (a finding built from the dispatched
  request passes the real `validateEditorialFindings`; a fabricated quote is
  rejected with `quote_not_found`).
- Component: `AssistancePanel.test.tsx` now covers grounded dispatch (asserts
  `review()` receives the extracted `chapterText`/`chapterSha256`, references
  and `styleRevision`), no-read-access, load-failure retry, and text-required
  paths — creator suite 25/25; i18n parity 6/6 (13 locales).
- Real browser (Chromium against `pnpm dev` + local D1, demo reader added to
  `book_creators` in local state only): "Load book text" fetched the signed
  file URL through the real Worker (POST 200) and rendered the real EPUB's
  chapters ("Chapter One", "Chapter Two", first preselected); `Run check`
  with no prepared engine reported
  `No local engine available — assistance is not enabled on this device.`
  (honest `engine_missing`, never "no findings"). In-page isolation confirmed
  extraction: 321-char chapter text and `sha256:` hash from the demo EPUB.
- Three real defects were found and fixed during that browser pass:
  (1) `book.sections` — not `book.spine` — is the ESM build's collection
  (Map-like iterable, no `.each`), so the extractor now accepts either shape
  (dist build keeps `.each`);
  (2) `book.ready` must be awaited where a build exposes it (dist);
  (3) a load failure left the panel without a retry affordance — it now
  re-offers "Load book text".
- Surfaced observation (fixed in GOAP-295): the reader's search/prefetch read
  `book.spine`, which the Vite-resolved ESM build does not expose
  (`book.sections` instead), so those paths no-opped under their guards. The
  shared `lib/epub-sections.ts` normalizer now serves search, prefetch and the
  creator chapter extractor; live search is confirmed working.
- No model download, no LanguageTool run, no cloud dispatch; `pnpm dev` and
  both dev servers were stopped after the check.

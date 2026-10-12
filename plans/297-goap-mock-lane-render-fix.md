# GOAP-297: mock-E2E lane actually renders EPUBs — fixture ZIP, CFIs, guards

**Status:** DONE (implemented + verified 2026-09-30)
**Date:** 2026-09-30
**Source:** observation recorded in `plans/296-goap-insights-proof-and-csp-acceptance.md` (surfaced by F9/GOAP-296)
**Governance:** ADR-214 (evidence beats aspiration); no policy change.

## Problem

The mocked Playwright lane never rendered a single book; every
content-dependent spec silently no-opped. Four stacked fixture/environment
defects were found by tracing `book.opened` and bisecting in-page:

1. **Malformed fixture ZIP** — `createMinimalEpub` compressed entries with
   `deflateSync` (zlib-wrapped, RFC 1950), but ZIP method 8 requires **raw
   DEFLATE** (RFC 1951). JSZip rejected the archive with
   `uncompressed data size mismatch`; epub.js surfaced it as a _pending_
   `opened` promise, and the reader timed out after 30 s. This was the root
   cause — the fixture EPUB was never openable.
2. **Unparseable progress CFI** — `PROGRESS_RESPONSE` carried
   `epubcfi(/6/4)`, a spine-only form that throws inside
   `@intity/epub-js` 0.3.96's `EpubCFI` parser (needs a step, e.g. `/6/4!/4`).
3. **Custom EPUB URLs never intercepted** — `mockReaderApi` ignored a custom
   absolute `epubUrl` when routing the buffer (fell back to
   `**/<bookSlug>.epub`), so `reader-migration-smoke` fetched
   `http://127.0.0.1:0/test/epub` — a Chromium-blocked port — into the
   network.
4. **Feedback composer unmocked** — `/api/books/*/feedback` retried four times
   against the absent Worker in every spec, burying real failures in noise.

## Changes

| #   | Change                                                                                                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `apps/tests/fixtures.ts`: `deflateRawSync`; `MOCK_EPUB` back to two chapters; `PROGRESS_RESPONSE.cfi` → `epubcfi(/6/4!/4/2)`; custom-`epubUrl` route matches the actual fetch path; default benign `feedback` mock (`includeFeedback: false` to opt out)                                    |
| 2   | Reader hardening (product): `parseableCfi()` validates the stored CFI before `rendition.display` (an unparseable CFI throws inside epub.js's display queue as an _unhandled_ error), and the display call now falls back to the first section on async rejection — both logged, tests added |
| 3   | `reader-migration-smoke.spec.ts`: the `if (initialText !== null)` guard is gone; the test pins progress to 0, asserts CHAPTER ONE → ArrowRight → CHAPTER TWO → ArrowLeft → CHAPTER ONE via `expect.poll`                                                                                    |
| 4   | `edge-cases.spec.ts` + `offline-reader.spec.ts`: stored CFIs use the parseable form (same spine positions)                                                                                                                                                                                  |

## Acceptance

- The mocked lane opens fixture books: `book.opened` resolves, iframes render,
  extracts match the fixture text.
- Content-dependent assertions are real (no `if (text !== null)` tolerance in
  the converted spec).
- No product regression: invalid stored CFI never blanks the reader; a
  parseable-but-dangling CFI falls back with a recorded warning.

## Verification

- Open-chain trace after fix: `open → openEpub → openContainer →
openPackaging → loadNavigation → unpack` all resolve.
- `reader-migration-smoke` 2/2; battery `in-book-search` + `a11y-advanced`
  12/12; broader battery (`edge-cases`, `offline-reader`,
  `login-and-book-load`, `reader-progress`, `reader-panel-mutual-exclusivity`,
  `demo-login`) 27 passed / 7 skipped / 0 failed.
- Hook unit suite 11/11 including the new invalid/dangling CFI cases; eslint,
  prettier, typecheck clean.

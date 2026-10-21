# GOAP-303: E2E assertions that can fail (A4)

**Status:** DONE
**Date:** 2026-10-02
**Type:** Corrective implementation slice (authorized from the GOAP-298 audit,
finding A4)
**ADRs referenced:** ADR-214 (audit recommendation governance), ADR-286
(required status checks must run for every PR shape — see the lane note below)
**Source findings:** A4 — "E2E checks still pass when their claimed behavior is
absent" in `analysis/comprehensive-gap-audit.md`

## Goal

Remove the last three vacuous E2E assertions — checks whose claimed behaviour
could be entirely absent and the test still passed — and assert the
consumer-visible state instead.

## Changes

All three anchors the audit named were replaced with behavioural assertions
(landed in `1d60254f`, PR #1264). Each replacement carries a comment naming the
removed tautology, so the reason cannot be lost:

| Spec                                                  | Before                                                            | After                                                                                                                                               |
| :---------------------------------------------------- | :---------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/tests/in-book-search.spec.ts:68`                | `expect(hasNoResults \|\| true).toBe(true)`                       | asserts the rendered empty state text `'No matches'` (`reader.searchNoResults`)                                                                     |
| `apps/tests/login-and-book-load.spec.ts:134`          | `expect(spinnerVisible \|\| loadingVisible \|\| true).toBe(true)` | holds the `file-url` response and requires `#main-content [role=status]` to be visible, then releases it and requires the fixture chapter to render |
| `apps/tests/reader-annotations-and-admin.spec.ts:137` | accepted login **or** the reader route after a 401                | requires the URL to leave the reader and land on `/login` after the first 401                                                                       |

**Follow-up correction (this slice):** the loading-state test asserted
`'CHAPTER ONE CONTENT'`, but `mockReaderApi` serves `MOCK_EPUB`, whose chapter
body is `<p>Chapter 1 content.</p>` — the string it expected belongs to specs
that build their own EPUB (`reader-migration-smoke.spec.ts`). The test failed
with `Expected substring: "CHAPTER ONE CONTENT" / Received string: "Chapter 1
content."`; it now asserts the fixture's actual text, with a comment explaining
which fixture owns which string.

## Evidence

- `PLAYWRIGHT_MODE=preview npx playwright test apps/tests/login-and-book-load.spec.ts
--project=chromium --workers=1` → **14 passed** (2026-10-02), which includes
  the loading-state anchor at `:134` — the file alone is the decisive run for it.
- All three A4 anchors in one command:
  `PLAYWRIGHT_MODE=preview npx playwright test apps/tests/in-book-search.spec.ts
apps/tests/login-and-book-load.spec.ts apps/tests/reader-annotations-and-admin.spec.ts
--project=chromium --workers=1` → **34 passed**.
- Which half failed matters for the record: the failure was the _post-release_
  assertion (`:165`, `.poll(() => getChapterText(page)).toContain('CHAPTER ONE
CONTENT')` — `Expected substring: "CHAPTER ONE CONTENT" / Received string:
"Chapter 1 content."`), **not** the held-route spinner check at `:156`.
  Playwright reports the first failing assertion, so the `#main-content
[role=status]` visibility check had already passed when the poll failed: the
  loading state exists and was proven, and no anchor of A4 is left failing.
- `grep -rn "\|\| true)" apps/tests/*.spec.ts` → no matches: the constant-true
  family is gone from the suite.

## Lane coverage follow-up (closed 2026-10-20)

The three corrected A4 assertions are now tagged `@smoke`. The new reader
TOC/reload regression is also tagged. The existing PR dev and preview smoke
commands filter for `@smoke`, so these behavioral checks are selected without
adding a separate job or changing required-check policy.

Local verification (2026-10-20): the targeted `@smoke` command passed 9 tests
on Chromium in dev mode. This proves selection and behavior in that lane only;
WebKit, Pixel, and preview results remain CI evidence and are not claimed here.

## PWA lane flake: the selection toolbar race (closed 2026-10-21)

The PWA E2E lane failed intermittently on `main` (CI runs 39585020306 and
39473294405, both "Run PWA E2E tests (service workers enabled)"), and it was
observed locally at a 1-in-5 rate — so it is a pre-existing defect, not a
regression from the reader changes on this branch. Two distinct races sat
behind it:

- **The service worker may not be activated when the page reloads.**
  `registerType: 'prompt'` means only pages loaded _after_ activation are
  controlled, and activation is asynchronous. A reload issued while the worker
  is still installing lands on an uncontrolled client, and the "Service
  Worker must control the page" assertion fails. The spec now waits for
  `registration.active` before the reload, so the reload necessarily produces
  a controlled client.
- **The selection helper returned before the app had seen the selection.**
  `selectReaderPassage` builds a DOM Range inside the book frame and
  dispatches a `mouseup` there, but the annotation toolbar is rendered by the
  app in the _top_ document after React processes that event. The helper
  returned as soon as the range was selected, so a caller could look for the
  "Comment" control before it was mounted; the failure then looked like a
  missing toolbar rather than a race in the helper. The helper now waits for
  the toolbar to appear, which is the app's own acknowledgement that it saw
  the selection.

Local verification (2026-10-21): eight consecutive `--grep @pwa
--project=pwa-chromium --retries=0` runs passed 16/16. The `--retries=0`
matters — the flake previously hid behind Playwright's automatic retry, which
is exactly how it reached `main` unnoticed.

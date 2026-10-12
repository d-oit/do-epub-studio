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

## Lane note (open, not fixed here)

The three specs are tagged `@mobile`, and the PR-side lane runs
`pnpm test:e2e:smoke` (`--grep @smoke`), so **no PR check executes them** — only
the scheduled cross-browser job does. The mirror-image gap is therefore explicit:
the A4 truthfulness fix itself **shipped untested in #1264**, and the
wrong-fixture assertion only surfaced when these files were run by hand. Promoting
a mock-lane PR job (or tagging these specs `@smoke`) is a CI policy decision that
belongs in its own slice; recorded here so the observation is not lost with the
fix.

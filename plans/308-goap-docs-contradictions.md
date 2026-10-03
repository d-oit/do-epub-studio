# GOAP-308: The current contracts describe the shipped login and assistance flows (A2)

**Status:** DONE
**Date:** 2026-10-03
**Type:** Corrective documentation slice (authorized from the GOAP-298 audit,
finding A2)
**ADRs referenced:** ADR-214 (audit recommendation governance), ADR-284
(invitation/account lifecycle), ADR-999 (reader–creator editorial contract)
**Source findings:** A2 — "documentation still contradicts shipped behavior" in
`analysis/comprehensive-gap-audit.md`

## Goal

A reader who follows the documented core flow must meet the form the app
actually renders, and the older assistance narrative must agree with the
delivered state without claiming AI-03's human review is complete.

## Changes

- **`PRODUCT.md`** core flow 1 was _"Login (magic-link email) → catalog → open
  book → read"_; ordinary login has been book-scoped **email + password** since
  ADR-232. The flow now reads _"Login (book-scoped email + password) → open book
  → read"_, and a short paragraph names the two supporting flows that _are_
  link-based — account recovery (`/api/access/recovery-request` →
  `/api/access/verify-recovery`) and book invitations (one-time accept link,
  ADR-284) — so "magic link" stops being the description of ordinary login
  without disappearing where it is true.
  Verified against the implementation: `LoginPage.tsx:59` posts
  `{ email, password, bookSlug }` to `/api/access/request`, `:84` requests
  recovery, `:99` verifies the recovery token. `grep -rn "magic-link"` over
  `*.md` finds no other ordinary-login claim (the remaining hits are ADR-081's
  email transport, the invitation/recovery surfaces and the audit itself).
- **`plans/999-goap-…` acceptance paragraph 5** still asserted, in the present
  tense, that "the creator panel still dispatches only the engine-less plugin
  with empty input (F1)". That was true on 2026-09-20 and was closed by
  GOAP-293 on 2026-09-30 — the same plan's AI-01 row already says so. Following
  the repo's dated-annotation convention, the paragraph keeps its text and gains
  a `_Superseded (2026-10-03, A2/GOAP-308)_` note; **AI-03 remains PARTIAL** and
  the note says so.

## Evidence

| Anchor                    | Before                                                                     | After                                                                                         |
| :------------------------ | :------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------- |
| `PRODUCT.md:20`           | "Login (magic-link email) → catalog → open book → read"                    | "Login (book-scoped email + password) → open book → read" + the recovery/invitation paragraph |
| Login form (read)         | `LoginPage.tsx` posts email + password + bookSlug to `/api/access/request` | matches the description                                                                       |
| `plans/999-…` paragraph 5 | F1 gap asserted as current                                                 | dated supersession note pointing at GOAP-293 and the AI-01 row                                |
| `plans/999-…` AI-03 row   | `PARTIAL` (human style review outstanding)                                 | untouched                                                                                     |

`check-plan-references` and the ADR index validate; prettier clean. No code
changed.

## Out of scope

The audit's third A2 anchor (`plans/999-…:85`, the AI-01 row) needed no edit: it
already records the 2026-09-30 integration. AI-03's human review is a person's
task and is not claimed or closed here.

# GOAP-242: Export Sanitization Hardening + Review Comment Closure

**Date:** 2026-08-14
**Status:** ✅ COMPLETED (merged as PR #987, commit a6d4c0f; supersedes PR #985)
**Baseline:** `main` @ `dac462c` (post GOAP-241, PR #986)
**Related:** plans/241; ADR-024 (warning management); PR #985 (superseded prior
Jules attempt at the same export hardening)

## Goal

Land the book-export hardening that was carried in unmerged PR #985 —
single-quote escaping in HTML exports and Markdown-syntax injection prevention
in Markdown exports — **and** close that PR's outstanding review comment
(OwlWatch LOW: repetitive rendering logic in `generateMarkdownExport`) before
opening a clean PR. Also fix the one bit of documentation drift surfaced by the
swarm plan-scan (stale closure record in GOAP-230).

## Analysis

`plans/` was scanned swarm-wide (GOAP orchestration): every non-archive plan is
`✅ COMPLETED` (merged #958–#984) or `Accepted` — **no implementable plan gap
remains**. No open GitHub issues. The only open PR (#985) carries verified
export-hardening work plus one addressable review comment. A separate scout
swarm (TODO/stub marker scan, unsafe-cast/non-null scan, plan-status scan)
confirmed the production source is clean of leftover markers and that the only
code-review-worthy duplication is the one flagged on #985.

## Changes

| Slice | Change | Files |
| --- | --- | --- |
| Export sanitization | HTML `esc()` now also escapes single quotes (`'` → `&#39;`) to close single-quote attribute/HTML-context XSS; Markdown renderer escapes Markdown syntax characters (`escMd`) on title, selected text, notes, comment bodies/replies, chapter refs, and bookmark labels so user content cannot inject headings, lists, or links. | `apps/worker/src/routes/export.ts` |
| Review-comment closure | Refactored the export generators: shared `prepareExport()` (called once in the route handler) threads comments into parent/reply groups, and shared `mdSection`/`chapterLocMd`/`chapterLocHtml`/`today()`/`mdBookmarkLines` helpers remove the duplicated section scaffolding and chapter-location building. Escaping intentionally changes output vs. main; the refactor itself preserves layout. | `apps/worker/src/routes/export.ts` |
| Tests | Added HTML single-quote/script-escape, Markdown-format-character-escape, and a nested comment-threading (parent/reply ordering) regression test. | `apps/worker/src/__tests__/routes.export.test.ts` |
| Docs drift | Fixed stale GOAP-230 closure record ("item 7 remains open") to reflect GOAP-237 shipped it. | `plans/230-goap-account-auth-2026-roadmap.md` |

## Verification (run)

- `pnpm --filter @do-epub-studio/worker exec vitest run src/__tests__/routes.export.test.ts` — 8/8 pass.
- `pnpm --filter @do-epub-studio/worker exec vitest run` — 54 files / 422 tests pass.
- `pnpm --filter @do-epub-studio/worker lint` — clean.
- `pnpm --filter @do-epub-studio/worker exec tsc --noEmit` — clean.
- `pnpm --filter @do-epub-studio/worker build` — clean (no warnings).
- `pnpm verify:fast` (CI `fast-check` equivalent, lint+typecheck+test:unit on
  affected) — green.

## Acceptance

- [x] New PR (#987) opened with the export hardening + refactor + tests; supersedes #985.
- [x] Review comment from #985 (duplication) addressed.
- [x] All CI gates green on the new PR (fast-check, worker build, full quality gate, pre-commit, Codacy, CodeQL, Repowise, Lighthouse, Cloudflare Pages).
- [x] Plans/ADR-INDEX and CHANGELOG updated to reflect this work.

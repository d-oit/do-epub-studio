# GOAP-1432 — EPUB Annotation Re-export

**Status:** Completed 2026-11-11

**Goal:** Export authorized highlights, comments, and bookmarks as a readable, bounded, EPUBCheck-validated copy of the original EPUB while preserving existing Markdown/HTML contracts.

## Scope

- Add `epub` to the shared export format contract and reader format selector.
- Transform the latest authorized source revision additively; preserve source resource bytes and package metadata values.
- Include all non-deleted user annotations, navigate only to safely resolved internal source locations, and mark unresolved records.
- Enforce explicit compressed, expanded, entry-count, annotation, and output limits.
- Run source/result archive-safety validation and synchronous EPUBCheck before success.
- Keep Markdown/HTML behavior and EPUB Annotations JSON interchange separate.

No database migration, persistent generated file, remote annotation-resource fetch, or change to asynchronous upload validation.

## Decomposition and dependencies

1. **T1 — shared contract and format UI.** Add export format/response types; add accessible localized selector. Preserve local Markdown path. Depends on existing export API.
2. **T2 — bounded reader-core package transformation.** Safely parse source package/navigation, add the XHTML appendix and package references, resolve trusted internal links, and enforce limits. Independent of UI; requires package structure tests.
3. **T3 — Worker EPUB route.** Reuse access checks and rate limiting; preflight and read latest R2 revision plus user-scoped annotations; call T2; run bounded archive checks and authenticated EPUBCheck before binary response. Depends on T2 and T4 contract.
4. **T4 — behavioral tests.** Cover package fidelity/security/bounds, route format/auth/tenant/R2/runner behavior, and UI selector/download/error behavior. Runs alongside T1/T2 implementation where contracts are stable.
5. **T5 — runtime verification and delivery docs.** Exercise a real export, validate exact bytes with EPUBCheck, open the result in the application reader, run focused suites and quality checks, then update changelog and scoped learnings.

## Acceptance gates

- EPUB retains original chapters/resources and metadata and includes highlights, comments/replies, and bookmarks.
- Safe internal source links are emitted only for resolved locators; stale/malformed/ambiguous records remain visibly unresolved with chapter/context.
- XHTML text is escaped; no annotation URI is dereferenced and no remote resource is fetched.
- Oversize source/annotations/output fail clearly before unbounded buffering.
- Archive safety and EPUBCheck validate the exact response bytes; runner outage, safety rejection, or EPUBCheck errors never return success.
- Markdown and HTML JSON behavior remains unchanged; JSON interchange remains separate.
- Existing auth, private-book/tenant isolation, and global rate limits apply.

## Verification commands

- `pnpm --filter @do-epub-studio/reader-core exec vitest run src/__tests__/annotation-export.test.ts`
- `pnpm --filter @do-epub-studio/worker exec vitest run src/__tests__/routes.export.test.ts src/__tests__/routes.export-epub.test.ts`
- `pnpm --filter @do-epub-studio/web exec vitest run src/features/reader/components/toolbar/ReaderToolbar.test.tsx`
- Repository `pnpm lint` and `pnpm typecheck` passed; full `pnpm test:unit` suite was not run.
- Real export smoke: exercise the worker route, run the generated artifact through EPUBCheck, and load it with the application reader.

**Architecture rationale:** `analysis/triz-core-1432.md`, `analysis/triz-resolution-1432.md`, and `plans/1432-adr-epub-annotation-reexport.md`.

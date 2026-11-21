# AGENTS.md — epub-authoring-export

Repo-specific invariants for this skill:

- The packager must stay deterministic: never add timestamps, random ordering, or compression-level variation to `zip.ts`. `packager.test.ts` locks byte-for-byte determinism.
- Content HTML is constrained by ADR-1020; sanitize with the reader sanitizer before persistence AND before packaging — persistence alone is not enough.
- Publishing is one-way and immutable. "Publish" always means: compile → `validateArchive` → R2 write under SHA-256 → new `book_files` row → enqueue EPUBCheck. Never mutate an existing revision.
- Draft races must surface as `409 Conflict` with the latest server draft; never silently overwrite.
- Run verification under `flock -w 900 /tmp/vitest.global.lock` — only one vitest in the repo at a time.
- If the conformance baseline (EPUB 3.3, ADR-1017) changes, update `scripts/check-epub-fixtures.mjs` and the capability matrix in the same change.

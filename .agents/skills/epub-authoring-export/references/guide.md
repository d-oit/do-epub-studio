# epub-authoring-export — Repo Guide

## Where authoring lives

- **Packager**: `packages/reader-core/src/packager/` — `packager.ts` (compile manuscript → package), `zip.ts` (streaming deterministic ZIP writer), `serializer.ts` (OPF/nav XML serialization), `index.ts`.
- **Manuscript model**: `AuthorPublication` (metadata + ordered `{ id, title, order, contentHtml }` chapters), constrained semantic tag vocabulary; validated by Zod at API boundary and sanitized with DOMPurify before persistence/package.
- **Draft storage**: D1 `book_manuscript_drafts` keyed by `book_id`, with integer `draft_version` optimistic locking; save races return `409 Conflict`.
- **Publish**: one-way — compile → `validateArchive` → R2 content-addressed write under SHA-256 (immutable) → new `book_files` row → enqueue EPUBCheck via `epub-validation-queue.ts`.
- **Authorization**: `/api/author/*` endpoints require book-scoped `authoringAllowed` grant.

## Packager invariants (tested in `packager.test.ts`)

1. `mimetype` is the first entry, uncompressed (Store method), at offset 0, containing exactly `application/epub+zip`.
2. Output bytes are deterministic for identical input (fixed order, timestamps, compression level) — required for content-addressing and caching.
3. `META-INF/container.xml` points to `OEBPS/content.opf`.
4. OPF contains metadata, unique identifier, manifest covering every emitted file (nav, chapters, styles, local assets), ordered spine, `nav.xhtml`.
5. No active content: no scripts, `<style>` in content docs, `on*` handlers, or arbitrary external resource URLs.
6. Round-trip: packaged output loads via `createEpubLoader` without sanitizer violations or missing resources.

## Verification

```bash
flock -w 900 /tmp/vitest.global.lock pnpm --filter @do-epub-studio/reader-core exec vitest run src/__tests__/packager.test.ts
node scripts/check-epub-fixtures.mjs   # corpus conformance vs pinned EPUBCheck 5.4.0
```

## Authority hierarchy

`plans/1020-adr-epub-authoring-and-packager.md` > `plans/1017-adr-epub-conformance-and-evidence.md` > packager code > tests. If a requirement conflicts, the ADR wins; raise it with the maintainer rather than silently deviating.

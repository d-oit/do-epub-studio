# ADR-1020: Structured EPUB Authoring Workspace and Deterministic EPUB 3 Packaging Pipeline

**Date:** 2026-11-05
**Status:** Accepted for implementation under GOAP-1020
**Deciders:** Project maintainer
**Issues:** #1431
**Related:** ADR-006, ADR-083, ADR-1014, ADR-1017, GOAP-1020

## Context

The platform provides comprehensive catalog, grant management, and reading experiences for pre-existing EPUB files, but lacks an internal manuscript authoring and EPUB 3 package-generation workflow. The admin creation and revision modals currently require an uploaded prebuilt `.epub` binary. The Creator workspace provides editorial annotation and feedback capabilities on existing books rather than manuscript composition.

Users need to compose publications directly within the application: create and reorder chapters, edit structured content with semantic formatting (headings, paragraphs, lists, links, images, tables), preview chapters with the real reading engine, and package conforming, deterministic EPUB 3 publications without uploading a pre-existing binary or installing third-party tooling.

## Decision

1. **Structured authoring model:** Manuscripts are modeled as structured JSON documents (`AuthorPublication`) containing publication metadata (title, creators, language, identifier, description, rights, cover asset reference) and an ordered list of chapters (`{ id, title, order, contentHtml }`). Content HTML is constrained to a strict semantic tag vocabulary (`h1`-`h6`, `p`, `blockquote`, `ul`, `ol`, `li`, `a`, `img`, `table`, `thead`, `tbody`, `tr`, `th`, `td`, `code`, `pre`, `em`, `strong`). Active content, scripts, `<style>` elements, inline `on*` event handlers, and arbitrary external resource URLs are forbidden by schema and sanitized with `DOMPurify` before persistence or packaging.
2. **Draft persistence with optimistic locking:** Active drafts are stored in a dedicated D1 table (`book_manuscript_drafts`) keyed by `book_id`. To prevent concurrent edit loss without heavyweight distributed locking, each draft carries an integer `draft_version` incremented on each save. Save operations verify the expected `draft_version` and return `409 Conflict` with the latest server draft if a race occurs. Autosaves operate exclusively on drafts and never mutate or replace published revisions.
3. **Deterministic EPUB 3 packager in `reader-core`:** A deterministic packager in `packages/reader-core/src/packager/` compiles structured manuscripts into valid EPUB 3 packages. It writes:
   - `mimetype`: Uncompressed `application/epub+zip` at offset 0 (ZIP Store method).
   - `META-INF/container.xml`: Points to `OEBPS/content.opf`.
   - `OEBPS/content.opf`: Complete package document with metadata, unique identifier, manifest items (`nav.xhtml`, chapters, styles, local assets), and ordered spine.
   - `OEBPS/nav.xhtml`: EPUB 3 Navigation Document (`<nav epub:type="toc">`).
   - `OEBPS/chapters/chX.xhtml`: Sanitized, well-formed XHTML Content Documents with XML-escaped entities.
   - `OEBPS/assets/*`: Bundled local images/stylesheets under strict size and MIME boundaries.
     The packaging implementation produces identical output across Node.js, Web Browsers, and Cloudflare Workers using standard streaming ZIP structures and Node/Web buffer interfaces.
4. **Publishing as immutable book revisions:** Publishing is an explicit, one-way action that compiles the current draft, runs synchronous archive-safety checks, writes the content-addressed bytes to R2 under its SHA-256 digest, creates a new row in `book_files` linked to the book, and enqueues asynchronous EPUBCheck validation via `epub-validation-queue.ts`. Existing published revisions are permanently immutable and are never overwritten.
5. **Production reader preview:** The authoring workspace integrates the production `ReaderViewer` and typography settings frame to render active chapter drafts. Authors see exact font, line-height, and theme rendering without requiring a full ZIP compile and iframe re-mount on every keystroke. Full-book preview compiles and loads the packaged EPUB through `createEpubLoader`.
6. **Authoring authorization boundary:** Book authoring is gated by an explicit `author` role and book-level `author` permission (`/api/author/*`). Global administrators and users with an active `author` permission grant for the specified `book_id` may create, update, and publish manuscripts. Standard reader grants (`permissions: ['read']`) and creator feedback tokens cannot access authoring endpoints.

## Alternatives considered

- **Accepting arbitrary HTML or Markdown only:** Raw HTML risks script injection and invalid XML in the EPUB package; Markdown alone lacks fine-grained metadata, table structures, and semantic markup necessary for professional publications. Constrained semantic XHTML provides the ideal balance of author usability and syntactic safety.
- **Overwriting existing EPUB files in R2 on draft save:** Rejected; published revisions are content-addressed and immutable to prevent race conditions, cache inconsistency for active readers, and audit log corruption.
- **Client-side only packaging with client upload:** A client-only packager cannot support headless Worker API creation or server-side automated publication pipelines. Placing the packager in `packages/reader-core` allows reuse across both frontend and backend.
- **Real-time collaborative editing via WebSockets / CRDT:** Unnecessary complexity for the MVP authoring workflow. Optimistic locking with explicit conflict detection resolves concurrent author collisions safely and predictably.

## Consequences

- Introduces a new D1 schema migration for `book_manuscript_drafts`.
- Expands `packages/reader-core` to export `packageEpub3(publication, assets)` alongside existing reader and sanitizer modules.
- Adds dedicated `/api/author/books/:id/manuscript` and `/api/author/books/:id/publish` endpoints with explicit role-based access control.
- Enables end-to-end authoring and EPUB 3 publication from templates or blank manuscripts directly within the web application.

## References

- [W3C EPUB 3.3 Recommendation](https://www.w3.org/TR/epub-33/)
- [W3C EPUB Packages 3.3](https://www.w3.org/TR/epub-33/#sec-package-doc)
- [W3C EPUB Content Documents 3.3](https://www.w3.org/TR/epub-33/#sec-content-docs)
- [ADR-1017: Isolated EPUB Conformance and Evidence](1017-adr-epub-conformance-and-evidence.md)

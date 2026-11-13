# System design — session-bound offline teardown

**Scope:** GOAP-1002 S1 local logout persistence and sync replay. This design does not change server authorization, signed-file policy, or deployed behavior.

## Component contracts

- **Auth store:** The current session token is the authority for local sensitive writes. Clearing or replacing it ends the previous session locally.
- **API client:** Track authenticated request _handles_ (never bearer-token strings) and abort them when the session token changes. Aborting a browser request does not prove the server did not already process it.
- **Offline writers:** Capture the owning token before asynchronous work and re-check it immediately before starting each IndexedDB write transaction, through the shared `captureSessionToken()` / `assertSessionToken()` helpers in `lib/offline/db.ts`. A stale operation rejects with `Session expired` instead of persisting after purge. A missing session keeps the pre-existing `Authentication required for sensitive offline storage` message.
- **Reader logout:** Cancel scheduled sync retries, clear auth state, then purge encrypted IndexedDB stores and the `book-content` cache. Auth-loss teardown already clears auth before its asynchronous purge.
- **Verification:** A deterministic local test delays encryption, performs auth loss and purge, releases encryption, and asserts the late write cannot recreate a row. API tests cover aborting in-flight authenticated requests on session change. A browser spec drives the visible sign-out control and asserts the seeded rows and the `book-content` cache are gone.

## Resolution and limits

This uses time separation for logout ordering and condition separation at each write boundary. Active-session writes remain available; work from a replaced session cannot commit locally. Existing sync session checks remain in place. An already accepted server mutation is outside the browser cancellation guarantee. No claim is made about cross-account ciphertext readability or production deployment.

## Implementation status (2026-10-20)

Implemented and locally proved. `analysis/triz-core-2026-10-20.md` records the two contradictions and their resolution; `plans/1002-goap-security-control-validation.md` records the proof commands and results.

## GOAP-1017 — EPUB Conformance, Annotation Interchange, and Accessibility Evidence

### Resolved architecture

- **EPUBCheck** runs only in a separately deployable Node/Java validation runner. The Worker enforces the shared archive-safety boundary, persists a revision-scoped pending report, and enqueues only the immutable revision/file identity. A durable Queue consumer streams the R2 object to the runner, writes the typed report, retries transient failures, and moves exhausted jobs to operator-visible recovery; admin retry re-enqueues. Persisted `(book file revision, SHA-256, validator version)` identity makes retries idempotent. The upload response never waits for EPUBCheck.
- **Publication accessibility** is a distinct, revision-scoped report: expose detected and missing EPUB Accessibility 1.1 (W3C Recommendation) metadata with OPF provenance, structural advisories, EPUBCheck 5.4.0 findings, and unresolved manual checks (EPUB Accessibility 1.2 Candidate Recommendation Draft, 12 September 2026, is tracked as forward-looking only). Automated results never assert certification. Reader-shell accessibility remains a separate WCAG 2.2 evidence stream.
- **EPUB capability support** is an explicit feature matrix with source-generated synthetic fixtures and observable tests. Unsupported/security-blocked capabilities receive a controlled explanation; evolving EPUB 3.4 material (W3C Candidate Recommendation Draft, 2 November 2026) is marked by its exact W3C status rather than treated as normative EPUB 3.3, and validator passes are kept distinct from reader rendering.
- **Annotation interchange** is a versioned EPUB Annotations 1.0 draft-profile adapter layered over the unchanged private annotation store/API. Strict schemas bound imports and extension data; CFI, quote context, stable publication identity, body, motivation, and creator/timestamp provenance are mapped without network dereferencing or HTML execution.
- **Fixture and accessibility testing** are segmented by trust boundary: EPUBCheck validates generated publication bytes in CI; axe scans app-owned reader/creator/admin DOM and the named EPUB iframe element; keyboard and assistive-technology procedures cover publication content without injecting scripts into its sandbox.

### TRIZ resolution

1. **Time/system separation:** the upload durably persists its revision and compact Queue job, then returns without running Java. A queue consumer invokes the isolated validator after the response; Cloudflare Queue retry/dead-letter behavior, plus admin retry, makes interruption recoverable. This preserves Worker latency and archive-safety rejection without spawning Java in the Worker.
2. **Segmentation/local quality:** the interchange adapter is draft-versioned and separate from internal DTOs; publication checks, manual review, and reader-UI checks are separately labeled evidence classes. No one class is represented as a full accessibility audit.
3. **Extraction/partial action:** deterministic metadata and structure checks report only what they can verify; semantic alternatives, reading order, and assistive-technology behavior remain explicit manual checks.
4. **Segmentation:** each synthetic EPUB fixture targets one or more named capabilities; fixture bytes and provenance are generated from committed source, never copyrighted books or personal data.

**New contradictions:** NONE unresolved. The external runner and production/preview Queue resources introduce operator configuration dependencies; bindings are declared and fail-closed preflighted, while missing runner configuration or processing failures remain visible and retryable rather than being treated as validation success.

## GOAP-1020 — Structured EPUB Authoring Workspace and EPUB 3 Export Pipeline

### Architecture contract (acceptance-gap follow-up, 2026-11-08)

The original feature section recorded intended behavior, not verified implementation. This contract resolves the gaps in `analysis/triz-core-2026-11-08.md`; the design resolutions are detailed in `analysis/triz-resolution-2026-11-08.md`. Required implementation and repository verification have passed; external screen-reader validation remains pending.

### Component contracts

- **Manuscript schema:** `AuthorPublication` stores title, ordered creators, language, stable identifier, description, publisher/rights, optional cover asset ID, ordered stylesheet asset IDs, and structured chapters. Chapter content remains an allowlisted semantic HTML fragment. `expectedVersion` is required on every draft write.
- **Draft lifecycle:** D1 `book_manuscript_drafts` remains the mutable draft store. A conditional versioned `UPDATE ... RETURNING` is the only save boundary; a stale version returns the latest draft with HTTP 409. The persisted `updated_at` is passed to packaging.
- **Authorization:** An independent `authoring_allowed` capability is stored on a book access grant and an explicit `author` invitation role sets only that capability. Reader/comment/offline rights and creator membership do not imply authoring. Each author request checks the active capability against the exact route `book_id`; global admins retain access. Book creation remains admin-only.
- **Assets:** A book-scoped D1 metadata row points to immutable R2 bytes under a generated asset ID. Raw uploads are bounded and MIME/signature-checked; accepted raster formats exclude SVG. CSS parsing rejects imports, at-rules, URLs, and unsafe declarations. Draft references use `asset:<uuid>` and can resolve only to assets owned by that same book. Cover and stylesheet selections are explicit metadata.
- **Packager:** `packageEpub3` is a pure browser/Worker/Node-safe function of publication, validated asset bytes, stable identifier, and persisted `modifiedAt`. It has no clock-derived fallback. ZIP output uses a fixed entry timestamp, an uncompressed first `mimetype`, a complete EPUB 3 manifest/spine/nav, cover-image metadata, stylesheet references, and generated local asset paths.
- **Publish:** Capture one saved draft version and its referenced asset bytes; package and synchronously run archive-safety validation; SHA-256 the exact bytes; store the immutable object at a digest-addressed R2 key; create a deterministic book-scoped revision ID; enqueue EPUBCheck asynchronously only for a new revision. Old revisions never depend on mutable draft assets.
- **Preview:** The safe AST renderer remains the immediate chapter-edit preview. An explicit “Preview book” action flushes pending autosave, dynamically loads the packager, builds an in-memory EPUB, and loads it through `createEpubLoader` with production sanitization and blocked external resource policy. The rendition exists only while the preview is mounted; no packaging occurs on keystrokes.
- **Web interface:** Admins and explicit book authors use the same workspace. Metadata fields, asset management, chapter actions, preview frames, and errors have accessible names/states. New user-facing controls use the app's translation catalogs. Asset object URLs are revoked on replacement/unmount.

### Interfaces and trust boundaries

1. `AuthorPublicationSchema` validates the draft shape; the Worker additionally verifies that cover, stylesheet, and `asset:<uuid>` references belong to the current book before save/publish.
2. The author asset API accepts bounded raw bytes and returns metadata. Browser retrieval uses the authenticated, book-scoped endpoint; R2 keys are never accepted from the client.
3. The packager receives validated `{ id, mediaType, data }` assets and required `{ identifier, modifiedAt }` options. It resolves asset IDs to generated archive paths; author strings cannot choose ZIP entry names.
4. Publish snapshots the package bytes before archive validation/storage. The revision digest, R2 object key, DB identity, and async validator job all refer to those exact bytes.
5. Admin grant/invitation changes revoke existing sessions; author middleware still rechecks the active grant on each operation.

### Required verification

- Schema and package tests cover required versioning, metadata boundaries, asset reference/path resolution, hostile HTML/CSS rejection, deterministic ZIP bytes, stored first `mimetype`, and package metadata.
- Worker tests cover atomic save races/stale conflicts, admin/author/read-only/creator/cross-book access, grant revocation, MIME/signature/size failures, and content-addressed immutable publish with async validation queue behavior.
- Reader-core integration loads the generated EPUB with `createEpubLoader` and asserts metadata, ordered TOC/spine, and local image/stylesheet entries.
- Chromium and WebKit E2E passed for metadata, asset, chapter, full-reader-preview, conflict, and publish flows; axe plus keyboard checks passed on the author surface.
- Full monorepo quality gate passed (lint, typecheck, coverage tests, build, and smoke E2E); PR merge remains subject to human approval.

### Status

Implementation and repository verification complete (2026-11-13). External screen-reader verification remains pending: NVDA is unavailable in the current WSL2 environment and VoiceOver requires macOS. No merge performed without human approval.

## GOAP-1432 — EPUB Annotation Re-export

### Component contracts

- **Export contract:** `ExportQuerySchema` accepts `markdown`, `html`, and `epub`; Markdown remains the default. Markdown/HTML JSON responses stay unchanged. EPUB is a bounded `application/epub+zip` attachment with a static safe filename.
- **Package transformation:** A reader-core helper preserves original chapter/resource bytes and package metadata values; adds one escaped XHTML appendix, OPF manifest/spine references, and EPUB 3 TOC navigation (or EPUB 2 NCX navigation). It performs no network access.
- **Locator handling:** A link is generated only from a normalized exact manifest/spine target and a supported CFI that agrees with that target. Stale-revision, orphaned, needs-review, malformed, missing, or ambiguous locations remain visibly unresolved with available chapter/quote context.
- **Bounds:** Source compressed ≤8 MiB, source expanded ≤16 MiB, generated compressed ≤10 MiB, generated expanded ≤24 MiB, ≤2,000 entries, ≤500 annotations, and ≤1 MiB aggregate annotation text. Reject rather than truncate. ZIP output is bounded during generation.
- **Worker validation:** Reuse reader authentication, `assertBookAccess`, global rate limiting, and user-scoped annotation queries. Select the latest `book_files` revision as the reader does; verify R2 size against D1; run strict archive checks and the existing token-authenticated EPUBCheck runner synchronously. Missing runner, unsafe archive, runner/schema/SHA mismatch, or EPUBCheck error never returns success.
- **Reader UI:** Add a localized accessible format selector. Keep the existing local Markdown path. HTML/EPUB use the authenticated export route; EPUB Annotations JSON interchange remains separate.
- **Verification:** Package tests cover source fidelity, navigation/locators, unresolved records, escaping, malformed packages, and caps. Worker tests cover formats, permissions, R2 and validator failures. Integration loads generated output with the production reader and validates the exact bytes with EPUBCheck.

### TRIZ resolution

`analysis/triz-core-1432.md` identifies the fidelity/memory, locator/safety, validator availability, and offline/API contradictions. `analysis/triz-resolution-1432.md` resolves them through explicit caps, additive packaging, verified internal navigation with unresolved fallback, fail-closed synchronous validation, and separate local/server paths. See `plans/1432-adr-epub-annotation-reexport.md` for accepted limits and tradeoffs.

**Status:** Architecture resolved; implementation and verification in progress.

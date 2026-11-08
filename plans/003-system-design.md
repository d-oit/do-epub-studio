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
- **Publication accessibility** is a distinct, revision-scoped report: expose detected and missing EPUB Accessibility 1.1 metadata with OPF provenance, structural advisories, EPUBCheck findings, and unresolved manual checks. Automated results never assert certification. Reader-shell accessibility remains a separate WCAG 2.2 evidence stream.
- **EPUB capability support** is an explicit feature matrix with source-generated synthetic fixtures and observable tests. Unsupported/security-blocked capabilities receive a controlled explanation; evolving EPUB 3.4 material is marked by the exact W3C status rather than treated as normative EPUB 3.3.
- **Annotation interchange** is a versioned EPUB Annotations 1.0 draft-profile adapter layered over the unchanged private annotation store/API. Strict schemas bound imports and extension data; CFI, quote context, stable publication identity, body, motivation, and creator/timestamp provenance are mapped without network dereferencing or HTML execution.
- **Fixture and accessibility testing** are segmented by trust boundary: EPUBCheck validates generated publication bytes in CI; axe scans app-owned reader/creator/admin DOM and the named EPUB iframe element; keyboard and assistive-technology procedures cover publication content without injecting scripts into its sandbox.

### TRIZ resolution

1. **Time/system separation:** the upload durably persists its revision and compact Queue job, then returns without running Java. A queue consumer invokes the isolated validator after the response; Cloudflare Queue retry/dead-letter behavior, plus admin retry, makes interruption recoverable. This preserves Worker latency and archive-safety rejection without spawning Java in the Worker.
2. **Segmentation/local quality:** the interchange adapter is draft-versioned and separate from internal DTOs; publication checks, manual review, and reader-UI checks are separately labeled evidence classes. No one class is represented as a full accessibility audit.
3. **Extraction/partial action:** deterministic metadata and structure checks report only what they can verify; semantic alternatives, reading order, and assistive-technology behavior remain explicit manual checks.
4. **Segmentation:** each synthetic EPUB fixture targets one or more named capabilities; fixture bytes and provenance are generated from committed source, never copyrighted books or personal data.

**New contradictions:** NONE unresolved. The external runner and production/preview Queue resources introduce operator configuration dependencies; bindings are declared and fail-closed preflighted, while missing runner configuration or processing failures remain visible and retryable rather than being treated as validation success.

## GOAP-1020 — Structured EPUB Authoring Workspace and EPUB 3 Export Pipeline

### Resolved architecture

- **Structured manuscript representation:** The authoring workspace stores publications as structured JSON documents (`AuthorPublication`: title, creators, language, identifier, description, rights, chapters: `{ id, title, order, contentHtml }`, and local asset references). Content HTML is restricted to semantic markup (`h1`-`h6`, `p`, `blockquote`, `ul`, `ol`, `li`, `a`, `img`, `table`, `code`, `em`, `strong`); all scripts, inline event handlers, and external URLs are forbidden by schema and sanitized with `DOMPurify` before storage and packaging.
- **Draft lifecycle & versioning:** Draft manuscripts live in a dedicated D1 table (`book_manuscript_drafts`) keyed by `book_id`, with an integer `draft_version` for optimistic concurrency locking. Autosave sends the expected `draft_version` and returns `409 Conflict` if another session incremented the version.
- **EPUB 3 packager pipeline (`packages/reader-core/src/packager/`):** A deterministic, streaming EPUB 3 packager builds conforming packages conforming to W3C EPUB 3.3. It writes uncompressed `mimetype` (`application/epub+zip`, store method 0), XML `META-INF/container.xml`, `OEBPS/content.opf` (metadata, manifest, spine), `OEBPS/nav.xhtml` (XHTML navigation document), XHTML chapter documents (`OEBPS/chapters/chX.xhtml`), and local asset files into a standard ZIP archive.
- **Publishing & revision creation:** Publishing a draft compiles the manuscript to an EPUB 3 package, executes synchronous archive-safety validation, uploads the bytes to R2 under a content-addressed SHA-256 key, creates an immutable `book_files` revision row via the existing upload-complete flow, and enqueues EPUBCheck validation. Previous revisions and their R2 files are never overwritten.
- **Reader preview:** The authoring workspace renders draft chapters in a preview tab using the production `ReaderViewer` container and sanitizer, giving 100% engine parity without re-packaging a full ZIP on every keystroke.
- **Authorization:** Authoring routes (`/api/author/*`) require authentication with either `admin` role or an explicit book-level grant carrying `author` permission (`permissions: ['read', 'author']`). Readers with standard read-only grants cannot access authoring endpoints.

### TRIZ resolution

1. **Resolved: Contradiction 1 (Authoring expressiveness vs EPUB 3 conformance & script security)**
   - **Problem:** Authors need rich formatting; arbitrary HTML risks XSS and malformed EPUB XML.
   - **IFR:** The authoring workspace provides full semantic chapter editing without admitting active content or malformed XML.
   - **Separation:** System-level separation & condition separation.
   - **Solution:** The workspace uses a constrained semantic schema for chapter content, sanitizes all content through `DOMPurify` using the EPUB content vocabulary, and serializes clean XML Content Documents with XML-escaped entities for packaging.
   - **Why Better:** Authors get an intuitive rich-text editing experience while the packager always produces strictly conformant XHTML.
   - **New Contradictions:** NONE.

2. **Resolved: Contradiction 2 (Continuous draft autosave vs revision immutability & concurrency)**
   - **Problem:** Active manuscripts mutate continuously; published book revisions must be immutable.
   - **IFR:** Manuscripts autosave safely with concurrency protection without mutating published revisions.
   - **Separation:** Time separation & condition separation.
   - **Solution:** Drafts are stored in mutable `book_manuscript_drafts` with optimistic version locking (`draft_version`). Publishing explicitly packages and commits a new, immutable `book_files` revision in R2.
   - **Why Better:** Readers always read immutable, hashed revisions; authors can save, revise, and discard drafts without affecting live distribution.
   - **New Contradictions:** NONE.

3. **Resolved: Contradiction 3 (Worker memory/compute limits vs EPUB 3 ZIP packaging)**
   - **Problem:** Building EPUB archives in Workers risks memory exhaustion.
   - **IFR:** Valid EPUB 3 archives are packaged deterministically within strict Worker resource budgets.
   - **Separation:** Segmentation & partial action.
   - **Solution:** `packages/reader-core` exports a lightweight, deterministic zip and package generator that formats individual XML strings and compresses entries sequentially with streaming CRC-32/deflate calculations. Unbounded manuscript sizes are capped by schema limits.
   - **Why Better:** Packager runs identically in Node, browser, and Cloudflare Workers with zero Java dependencies.
   - **New Contradictions:** NONE.

4. **Resolved: Contradiction 4 (Reader preview fidelity vs keystroke latency)**
   - **Problem:** Re-bundling and re-mounting EPUBs on keystrokes causes lag; separate preview causes engine drift.
   - **IFR:** The author sees exact reader rendering with zero keystroke delay.
   - **Separation:** Time separation.
   - **Solution:** Keystrokes update the local draft state immediately; the live editor displays the sanitized chapter content within the reader typography frame. Switching to "Preview Book" renders the full compiled book in the actual reader engine.
   - **Why Better:** Fast typing responsiveness during writing, with exact full-book fidelity when previewing.
   - **New Contradictions:** NONE.

5. **Resolved: Contradiction 5 (Authoring authorization vs broad administrative privilege)**
   - **Problem:** Non-admin authors need to manage manuscripts without gaining full tenant admin privileges.
   - **IFR:** Authors can create and edit their assigned publications without administrative access to other books or users.
   - **Separation:** Condition separation (role- and grant-based authorization).
   - **Solution:** Dedicated `/api/author/*` routes check `verifyAuthorAccess`, which permits admins or tokens with `author` permission on that specific `book_id`.
   - **Why Better:** Follows least-privilege principles and prevents privilege escalation.
   - **New Contradictions:** NONE.

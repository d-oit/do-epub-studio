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

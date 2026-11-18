# TRIZ Resolution — EPUB authoring acceptance gaps (2026-11-08)

Source analysis: `analysis/triz-core-2026-11-08.md`. Product decisions remain those already accepted in ADR-1020.

## Resolved contradictions

### Resolved: Contradiction 1 — deterministic bytes and meaningful package metadata

**Problem:** Implicit wall-clock defaults change EPUB bytes when the same draft is packaged repeatedly.

**IFR:** The same persisted manuscript snapshot and assets produce byte-identical EPUB output without consulting the build clock.

**Separation:** System-level separation. Persist stable publication identity and draft `updated_at` in D1; keep the packager a pure function of publication, asset bytes, identifier, and modified timestamp.

**Solution:** Pass the stable book/publication identifier and persisted draft timestamp explicitly to `packageEpub3`. Remove time-derived fallbacks. Keep ZIP entry timestamps fixed and deterministic. Hash the final bytes; use the digest for the revision object key and a deterministic book-scoped revision ID. A later edit advances the persisted draft timestamp, making a distinct package when its metadata changes.

**Why Better:** Repacking one saved snapshot gives the same bytes and digest. EPUB metadata remains tied to saved author work, not worker execution time. Storage identity is derived from bytes rather than a random key.

**New Contradictions:** NONE unresolved. Compression output is deterministic for the pinned `fflate` dependency version; dependency upgrades may legitimately create new byte identities and are covered by the package fixture/integration checks.

### Resolved: Contradiction 2 — autosave convenience and concurrent-draft safety

**Problem:** Optional expected versions and a read-then-upsert permit silent lost updates under concurrent saves.

**IFR:** Autosave remains automatic while every accepted write is based on the exact version the editor loaded.

**Separation:** Condition separation at the D1 mutation boundary.

**Solution:** Require `expectedVersion` on every manuscript PUT. Use one conditional `UPDATE ... WHERE book_id = ? AND draft_version = ? RETURNING ...` to atomically increment the version and set `updated_at`. If no row is returned, read and return the current draft with HTTP 409. Draft initialization uses insert-if-absent followed by a read, so concurrent first opens converge on one row. The editor retains unsaved text on conflict and offers an explicit reload of the winning draft.

**Why Better:** The database, not a client-side timing window, chooses one winner. Every save response supplies the timestamp used by deterministic packaging.

**New Contradictions:** NONE unresolved. D1 `RETURNING` support is a runtime prerequisite and is covered by the Worker route test environment; if the configured D1 runtime lacks it, deployment must fail rather than falling back to a non-atomic sequence.

### Resolved: Contradiction 3 — author capability security and access usability

**Problem:** Admin-only routes exclude legitimate non-admin authors; reusing reader or creator access would grant editing to the wrong role.

**IFR:** An invited author can edit only the assigned book without receiving administrator privileges or inheriting creator-feedback permissions.

**Separation:** Condition separation by exact book ID and an independent authoring capability.

**Solution:** Add `authoring_allowed` to book-scoped access grants and `author` to book-invitation roles. Acceptance creates/updates the ordinary book grant with only the explicit authoring capability set; it does not add the user to `book_creators` or infer capability from read/comments/offline flags. Auth context exposes `canAuthor`; author middleware permits a global administrator or an active grant whose `book_id` matches the route and whose authoring capability is enabled. Keep book creation admin-only. Grant changes revoke existing book sessions so authorization changes take effect immediately. Reader and creator roles remain unchanged.

**Why Better:** Existing login/session and invitation flows are reused, while authorization remains least-privilege and book-scoped. Authors can use the same workspace without broad admin access.

**New Contradictions:** NONE unresolved. Global administrators remain an explicit maintenance path; book-author grants cannot create books or administer grants.

### Resolved: Contradiction 4 — reader-engine fidelity and keystroke latency

**Problem:** The safe React AST preview is immediate but does not use the production EPUB reader; rebuilding on every keystroke would block editing.

**IFR:** Authors receive immediate safe editing feedback and can inspect a saved full-book package through the production reader engine without packaging during typing.

**Separation:** Time separation. Live chapter rendering remains local and immediate; full EPUB preview runs only after an explicit user action.

**Solution:** Keep the allowlisted AST renderer for the live chapter pane. On “Preview book,” finish the pending autosave, snapshot the current publication/assets, dynamically load the browser-safe packager, build one in-memory EPUB, and load it with `createEpubLoader` using the production sanitizer and network-blocking policy. Create the rendition only while the preview is mounted and destroy it on exit. Name generated iframes with the publication title; apply reader theme/preferences through the existing reader theme helper. Do not generate an EPUB on keystrokes.

**Why Better:** The production parser, sanitizer, package structure, navigation, local CSS/images, and rendition are exercised by the preview. The editor path remains independent of archive creation.

**New Contradictions:** NONE unresolved. The full-preview button has an explicit loading/error state; packaging is bounded by schema and asset limits, and the existing live AST preview remains available if the user cancels or packaging fails.

### Resolved: Contradiction 5 — local media capability and untrusted-file/resource risk

**Problem:** Authors need local images/CSS, but unrestricted upload bytes, stylesheet URLs, and package paths create security and resource risks.

**IFR:** Authors can upload and reuse bounded local images/stylesheets while no untrusted path, active markup, external asset request, or unbounded body reaches the package or browser preview.

**Separation:** Space and local-quality separation at the asset API and packager.

**Solution:** Store per-book asset records in D1 and bytes in R2 under generated asset IDs. The raw upload route has a separate hard byte cap and MIME allowlist; image formats are checked against their signatures, SVG and other active formats are excluded, and CSS is parsed and rejects at-rules/imports/URLs and unsafe declarations. Enforce per-file, per-book-total, and asset-count bounds. Draft HTML uses only `asset:<uuid>` references; save and publish validate that each reference belongs to the same book. The serializer resolves IDs to generated relative paths. Stylesheets are listed explicitly in manuscript metadata and included in the OPF manifest; the cover uses an EPUB 3 `cover-image` manifest property. Browser previews fetch bytes through the authenticated book-scoped asset endpoint and use revocable object URLs.

**Why Better:** Authors manage local assets without giving the browser or EPUB an arbitrary filesystem/network path. Upload, draft JSON, and package generation each have independent size and validation boundaries.

**New Contradictions:** NONE unresolved. R2/D1 are non-transactional: upload writes R2 first and removes the object if D1 insertion fails; asset deletion first confirms no draft reference and then deletes its object. A cleanup failure can leave only an unreachable orphan, never a draft reference to missing bytes; the operation reports failure and remains retryable.

### Resolved: Contradiction 6 — mutable drafts/assets and immutable publication revisions

**Problem:** Drafts and asset libraries must remain mutable while each published revision is immutable and reproducible.

**IFR:** Editing or deleting draft content/assets cannot alter an existing published EPUB or its validation result.

**Separation:** Time and system-level separation. Publish captures a saved version into a self-contained EPUB; revisions are addressed by package digest and never refer to live draft asset objects.

**Solution:** At publish time, read a single draft version/timestamp, resolve and validate every referenced asset, and package copies of those bytes into the EPUB. Validate the archive before storage. Write to `books/{bookId}/revisions/{sha256}.epub`, create a deterministic book-scoped revision row, and enqueue EPUBCheck only for a newly created revision. Repeated publication of identical bytes reuses the existing revision/report; a later draft or asset change yields a new digest and object key. Keep old objects and revision rows immutable.

**Why Better:** Published readers consume a self-contained snapshot. Mutable draft operations cannot rewrite old packages, and content identity is auditable through SHA-256.

**New Contradictions:** NONE unresolved. EPUBCheck remains asynchronous as already designed in ADR-1020; archive safety remains synchronous before persistence. Duplicate queue deliveries are safe because the revision identity is stable and report/queue handling is idempotent.

## System design derivation

| Component                        | Contract                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/schema`                | `AuthorPublication` carries creators, publisher/rights, language/identifier, cover asset ID, ordered stylesheet IDs, and structured chapters. `expectedVersion` is required. Asset schemas bound IDs, filenames, MIME values, byte sizes, and count.                                                                                                                                                                                                                             |
| D1 migration                     | Add per-book authoring capability and asset metadata table; permit invitation role `author`. Draft versions/timestamps remain the source of package metadata.                                                                                                                                                                                                                                                                                                                    |
| Worker author routes             | Book-scoped author auth on draft, asset, preview-data, and publish operations. `POST /books` remains admin-only. Conditional draft update is the only write path. Raw asset requests are bounded before reading.                                                                                                                                                                                                                                                                 |
| R2 asset store                   | Per-book immutable upload objects use generated keys and validated MIME/hash metadata. Draft references resolve only within the authenticated book.                                                                                                                                                                                                                                                                                                                              |
| Reader-core sanitizer/serializer | Parse author markup into an allowlisted AST, reject active/external content, map `asset:<uuid>` only through validated book assets, and serialize safe XHTML/CSS references.                                                                                                                                                                                                                                                                                                     |
| Reader-core packager             | Browser/Worker/Node-safe deterministic ZIP writer; stored first `mimetype`; explicit publication identifier and saved timestamp; manifest/spine/nav/cover/stylesheets/local assets; no wall-clock defaults.                                                                                                                                                                                                                                                                      |
| Publish pipeline                 | Snapshot draft+asset bytes, archive-safety check, digest, content-addressed R2 key, immutable `book_files` row, asynchronous EPUBCheck queue.                                                                                                                                                                                                                                                                                                                                    |
| Web author workspace             | Admin or explicit book-author users; metadata and asset manager; accessible semantic controls; live AST preview; explicit full-book preview via in-memory package and `createEpubLoader`; publish feedback.                                                                                                                                                                                                                                                                      |
| Verification                     | Unit tests cover schema boundaries, MIME/signature/CSS rejection, asset ownership, package bytes/OPF/ZIP determinism, and concurrency. Worker tests cover authorization, revocation, asset caps, and immutable/idempotent publishing. Browser E2E covers author lifecycle in Chromium/WebKit and axe/keyboard accessibility. Reader-core integration loads the generated package with the production loader and asserts metadata, ordered TOC/spine, and local asset resolution. |

## Secondary contradiction check

- Deterministic compression depends on the locked `fflate` version. Lockfile updates can change bytes, but do not mutate prior digest-addressed revisions; new builds produce new immutable identities and the integration fixture detects format regressions.
- Reader preview and publish use the same package function and sanitizer. Preview downloads only current book assets through book-scoped auth; packaged HTML/CSS has no external resource URLs.
- Asset bytes are copied into each EPUB, so later asset deletion does not affect old publications.
- Permission revocation changes the stored grant and invalidates sessions; every author request also checks the current grant, so stale client state cannot authorize a write.
- Total draft and asset budgets bound Worker/browser memory. These constraints are explicit and tested rather than silently bypassing the global request limit.

**New contradictions:** NONE unresolved.

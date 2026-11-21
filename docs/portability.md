# Data portability (v1)

This document specifies the portability envelope used for exporting and
restoring a user's library and reading state: annotations (highlights,
bookmarks, comments), per-book reading progress, and reader preferences.

**Format identifier:** `do-epub-studio.portability`
**Version:** `1`
**Profile:** `https://do-epub-studio.org/profiles/portability/v1`

## Scope and guarantees

- Export is **deterministic**: items are sorted by book id and annotation id,
  and JSON key order is fixed, so identical input produces byte-identical
  archives.
- The envelope is a **documented interchange format**, not a dump of internal
  tables. Values mirror public API DTOs or the W3C/EPUB Annotations model;
  hidden database shapes are never exported. No email addresses or internal
  keys are included.
- Import is **Zod-validated** at the boundary. Tampered, malformed, or
  unknown-version archives are rejected before any mutation.
- Import is **idempotent**: every creatable entity carries a deterministic
  v5 `mutationId` derived from the envelope id + source id, so re-importing
  the same archive replays identical ids through the worker's
  `ON CONFLICT(mutation_id) DO NOTHING` paths. Duplicates are also reported
  during the conflict preview.
- Import is **preview-first**: parsing and analysis are non-mutating. Nothing
  is written until the user confirms; confirmation applies the plan through
  the normal authenticated create endpoints (never a bulk table write).

## Envelope shape

```jsonc
{
  "format": "do-epub-studio.portability",
  "version": 1,
  "profile": "https://do-epub-studio.org/profiles/portability/v1",
  "id": "<uuid>",
  "idempotencyKey": "<uuid>",          // optional, per export
  "exportedAt": "2026-11-20T00:00:00.000Z",
  "scope": "account" | "book",
  "app": { "name": "do-epub-studio", "version": "0.1.0" },
  "items": [
    {
      "type": "publication",
      "id": "<uuid>",
      "bookId": "book-uuid",
      "slug": "my-book",
      "title": "My Book",
      "annotations": {
        // Full W3C EPUB Annotations 1.0 (Working Draft) AnnotationCollection.
        // See docs/annotation-interchange.md for the profile used.
        "format": "https://do-epub-studio.org/profiles/epub-annotations/1.0-draft",
        "version": "1.0-draft",
        "type": "AnnotationCollection",
        "id": "urn:uuid:...",
        "label": "My Book",
        "source": "urn:do-epub-studio:publication:book-uuid",
        "items": [
          {
            "id": "urn:do-epub-studio:annotation:<id>",
            "type": "Annotation",
            "motivation": "highlighting" | "bookmarking" | "commenting",
            "created": "…", "modified": "…",
            "target": { "source": "…", "selector": {
              "type": "EPUBFragmentSelector",
              "conformsTo": "http://www.idpf.org/epub/linking/cfi/epub-cfi.html",
              "value": "epubcfi(...)",
              "locator": { "cfi": "…", "chapterRef": "…", "selectedText": "…" }
            } },
            "body": { "type": "TextualBody", "value": "…",
                      "purpose": "commenting"|"describing", "format": "text/plain" },
            "extensions": {
              "https://do-epub-studio.org/extensions/v1/highlight/color": "#ffff00",
              "https://do-epub-studio.org/extensions/v1/highlight/anchorStatus": "anchored",
              "https://do-epub-studio.org/extensions/v1/highlight/confidence": 1.0,
              "https://do-epub-studio.org/extensions/v1/highlight/migrationOutcome": null,
              "https://do-epub-studio.org/extensions/v1/highlight/revisionId": null,
              "https://do-epub-studio.org/extensions/v1/highlight/originalCfi": null,
              "https://do-epub-studio.org/extensions/v1/highlight/originalChapterRef": null,
              "https://do-epub-studio.org/extensions/v1/highlight/originalSelectedText": null,
              "https://do-epub-studio.org/extensions/v1/comment/status": "open",
              "https://do-epub-studio.org/extensions/v1/comment/visibility": "internal",
              "https://do-epub-studio.org/extensions/v1/comment/resolvedAt": null,
              "https://do-epub-studio.org/extensions/v1/comment/parentCommentId": null,
              "https://do-epub-studio.org/extensions/v1/comment/anchorStatus": "anchored",
              "https://do-epub-studio.org/extensions/v1/comment/confidence": 1.0,
              "https://do-epub-studio.org/extensions/v1/comment/migrationOutcome": null,
              "https://do-epub-studio.org/extensions/v1/comment/revisionId": null,
              "https://do-epub-studio.org/extensions/v1/comment/originalCfi": null,
              "https://do-epub-studio.org/extensions/v1/comment/originalChapterRef": null,
              "https://do-epub-studio.org/extensions/v1/comment/originalSelectedText": null
            }
          }
        ]
      },
      "orphans": {   // optional; locator-less entities not representable in the W3C model
        "highlights":  [ { "id": "", "note": null, "color": "#ffff00",
                            "createdAt": "", "updatedAt": "" } ],
        "comments":    [ { "id": "", "body": "", "status": "open",
                            "visibility": "internal", "parentCommentId": null,
                            "createdAt": "", "updatedAt": "", "resolvedAt": null } ],
        "bookmarks":   [ { "id": "", "label": null, "createdAt": "" } ]
      },
      "progress": { "locator": { "cfi": "…" }, "progressPercent": 42,
                    "updatedAt": "…" } | null,
      "archive": { "included": true, "filename": "my-book.epub",
                   "sizeBytes": 123456 }   // optional, only with opt-in book files
    },
    {
      "type": "preferences",
      "id": "<uuid>",
      "preferences": {
        "theme": "system", "fontFamily": "serif", "fontSize": "medium",
        "lineHeight": 2, "pageWidth": "normal", "direction": "default",
        "writingMode": "horizontal-tb", "aiEnabled": false
      }
    }
  ]
}
```

### Extensions

Internal bookkeeping (color, comment status/visibility, anchor migration
state, original locator fallbacks) is preserved losslessly as
HTTPS-namespaced extension keys on each annotation. Consumers that do not
understand a key must ignore it; all extension values are inert JSON data
(no executable content, no remote dereferencing).

### Orphans

Entities that lack a usable locator (no CFI, chapter, or quoted text) cannot
be expressed in the EPUB Annotations target model. They travel losslessly in
`orphans` and are reported as **unanchored** in the import preview, awaiting
the reader's re-anchor flow; they are never silently dropped from the
archive.

## Backup / restore flow

### Back up

1. Open **Settings → Data portability** (account scope) or the reader's
   **More options → Data portability** (per-book scope).
2. Choose **Export**. You may opt in to bundling the book EPUB files: they
   are downloaded through the same signed, access-checked file URL used by
   the reader and packed into a ZIP alongside `portability.json`.
3. Archive the downloaded `.json` (or `.zip`) file somewhere safe. The file
   is self-contained; no account is required to read it.

### Restore

1. Open the same dialog and choose **Import**.
2. Pick the archive file. It is parsed and validated; you see a
   **non-mutating preview**: per-book counts of new items, duplicates, and
   conflicts, plus a re-anchor quality report (exact / weak / unanchored).
3. Confirm to apply. Creatable entities are written through the normal
   authenticated API with deterministic mutation ids, so re-importing the
   same archive does not duplicate anything. Entities flagged unanchored
   are not auto-created and remain reported for re-anchoring in the reader.

### Notes

- Account-scope import applies to books already in your library; books in
  the archive that you no longer have are reported as skipped.
- Preferences (theme, font, layout) are restored on account-scope import.
- The archive is not encrypted. Do not share it with people you do not want
  to read your annotations and progress; book files are included only on
  explicit opt-in.

## Limits

- ≤ 10,000 items per envelope; ≤ 50 MB serialized payload; ≤ 5 MB per
  publication item (annotations included); ≤ 1,000 annotations per
  collection (inherited from the EPUB Annotations profile); ≤ 5,000 orphan
  entities per kind.

## Sources

- [EPUB Annotations 1.0 Working Draft](https://www.w3.org/TR/2026/WD-epub-anno-10-20260920/)
- [Web Annotation Data Model](https://www.w3.org/TR/annotation-model/)
- [docs/annotation-interchange.md](./annotation-interchange.md)

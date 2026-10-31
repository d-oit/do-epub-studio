# EPUB Annotations interchange (1.0 Working Draft)

This separate interchange profile is a **draft**, based on the EPUB Annotations 1.0 Working Draft and the W3C Web Annotation Data Model. It is not an EPUBCheck result, an accessibility certification, or a claim of conformance. The format can change before publication.

## Scope and behavior

A JSON `AnnotationCollection` stores `Annotation` items with Web Annotation `motivation` values `highlighting`, `bookmarking`, or `commenting`. Text is always `TextualBody` with `format: text/plain`; consumers must treat it as inert text and must not interpret it as markup or fetch annotation/publication URIs. The profile carries a stable publication identity (`urn:do-epub-studio:publication:<encoded-book-id>`), a stable annotation identifier, created/modified timestamps when available, and no creator attribution by default. Email addresses are never exported.

Each target contains an EPUB CFI fragment selector and a multi-signal locator (`cfi`, `chapterRef`, and `selectedText`), with optional quote prefix/suffix and numeric DOM fallback signals. The CFI in the selector and locator must match. Source identity must match the reader book selected for import. Remote URI dereferencing is prohibited; URI strings are identifiers only.

Unrecognized core fields, alternate profile versions, unknown motivations, malformed JSON/locators, duplicate annotation IDs, source mismatches, and non-namespaced extensions are rejected. Extensions must be JSON data in HTTPS-namespaced keys; their aggregate representation is limited to 32 KiB per annotation. The full payload is limited to 1 MB and 1,000 annotations. Only documented extension data is retained; no executable HTML, scripts, URLs, or remote resources are loaded.

The existing private Markdown notes import/export remains a separate compatible format and is not reinterpreted as this draft profile.

## Example

```json
{
  "format": "https://do-epub-studio.org/profiles/epub-annotations/1.0-draft",
  "version": "1.0-draft",
  "type": "AnnotationCollection",
  "id": "urn:uuid:example",
  "label": "Example publication",
  "source": "urn:do-epub-studio:publication:book-identifier",
  "items": [
    {
      "id": "urn:do-epub-studio:annotation:highlight-identifier",
      "type": "Annotation",
      "motivation": "highlighting",
      "target": {
        "source": "urn:do-epub-studio:publication:book-identifier",
        "selector": {
          "type": "EPUBFragmentSelector",
          "conformsTo": "http://www.idpf.org/epub/linking/cfi/epub-cfi.html",
          "value": "epubcfi(/6/4!/4/2:3)",
          "locator": {
            "cfi": "epubcfi(/6/4!/4/2:3)",
            "chapterRef": "chapter.xhtml",
            "selectedText": "quoted text"
          }
        }
      },
      "body": {
        "type": "TextualBody",
        "value": "A note",
        "purpose": "describing",
        "format": "text/plain"
      }
    }
  ]
}
```

## Sources

- [EPUB Annotations 1.0 Working Draft](https://www.w3.org/TR/epub-annotations-10/)
- [Web Annotation Data Model](https://www.w3.org/TR/annotation-model/)
- [EPUB CFI specification](https://www.idpf.org/epub/linking/cfi/epub-cfi.html)

# Runbook: Reader Rendering Issues

## Diagnostic Steps

### 1. Check Browser Console

Open DevTools Console and look for:

- `[epub-loader][trace:...]` — reader-core loader logs
- `EPUB init error:` — error caught in `ReaderPage.tsx` init effect
- `Failed to load EPUB:` — thrown by createEpubLoader
- CORS errors — signed URL or API origin mismatch
- Network 401s — session expired or revoked

### 2. Check if iframe Loads

In `ReaderPage.tsx`, the EPUB is rendered into a `div` via `book.renderTo(viewer, {sandbox})`. The iframe is created by epub-js internally. Verify:

- `viewerRef.current` is a mounted div in the DOM
- iframe element exists inside the viewer div
- iframe has correct `sandbox` attribute (`allow-same-origin`)
- No CSP errors in console blocking inline styles

### 3. Verify Signed URL

- Network tab: find `POST /api/books/{slug}/file-url` — should return `{url: "...", expiresAt: "..."}`
- Check the returned URL: should contain `?expires={epoch}&signature={hex}`
- If 401: session expired, re-authenticate
- If 403: grant revoked
- Verify URL is not expired (1-hour TTL, `SIGNED_URL_EXPIRY_SECONDS = 3600`)
- Test URL directly in browser: should download the EPUB file

### 4. Check API Response

- `GET /api/books/{slug}` — should return book metadata (including `id`, `title`)
- `GET /api/access/validate?bookId={id}` — should return grant status

## Common Failure Modes

### Blank Reader (White Screen)

| Cause                          | Symptom                                                                      | Fix                                                                                                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Missing/expired signed URL     | `epubUrl` is null, viewer shows "not available"                              | Re-fetch file-url                                                                                                                                                                          |
| EPUB file corrupt              | `book.opened` rejects                                                        | Re-upload EPUB                                                                                                                                                                             |
| iframe sandbox too restrictive | iframe loads but content blank                                               | Ensure `allow-same-origin` in `sandbox` array                                                                                                                                              |
| CORS on R2/signed URL          | `No 'Access-Control-Allow-Origin'` in console                                | Check worker CORS config                                                                                                                                                                   |
| JS error in epub-js            | Uncaught TypeError in epub-js internals                                      | Check @intity/epub-js version compatibility                                                                                                                                                |
| Sanitizer replaced `<body>`    | Chapter measures 0×0 and the view collapses; markup looks correct in the DOM | `sanitizeEpubDocument` must splice the clone's children into the live `<head>`/`<body>`, never replace those elements — epub.js captured `document.body` in `Contents` before the hook ran |

### Missing Chapters in TOC

| Cause                                  | Fix                                           |
| -------------------------------------- | --------------------------------------------- |
| EPUB has no TOC (navigation.toc empty) | Not fixable — EPUB malformed                  |
| `book.loaded.navigation` fails         | Check EPUB structure with validator           |
| TocItem parsing error                  | Look for `nav.toc.map(...)` errors in console |

### Broken Pagination

| Cause                                | Fix                                                |
| ------------------------------------ | -------------------------------------------------- |
| rendition `spread` config misaligned | Check `spread: 'auto'` in renderTo options         |
| Viewer div has zero height           | Verify viewerRef container has CSS height          |
| Locator CFI navigation fails         | `rendition.display(cfi)` throws — CFI may be stale |

### Author preview iframe collapses after a viewport change

The EPUB.js default manager reuses existing views, so calling `rendition.resize()`
alone leaves the old frame dimensions in place; clearing first is what makes the
re-layout land.

| Symptom                                          | Fix                                                                                          |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Preview iframe 0×0 after rotating/resizing       | `AuthorEpubPreview` must observe its container and call the rendition handle `resize()`      |
| Chapter text blank though iframe has size        | `EpubRenditionHandle.resize()` must call `rendition.clear()` **before** `rendition.resize()` |
| Iframe has no accessible name after a re-display | The `displayed` listener must re-apply `author.preview.frameLabel` to the new iframe         |

### Annotation export returns an error instead of a file

| Status / code                       | Cause                                                                  |
| ----------------------------------- | ---------------------------------------------------------------------- |
| `503 EXPORT_VALIDATION_UNAVAILABLE` | `EPUBCHECK_RUNNER_URL` / `EPUBCHECK_RUNNER_TOKEN` unset or unreachable |
| `409 EXPORT_SOURCE_UNAVAILABLE`     | Latest revision is not stored in R2                                    |
| `413 EXPORT_SOURCE_TOO_LARGE`       | Source EPUB > 8 MiB or > 24 MiB expanded                               |
| `413 EXPORT_ANNOTATIONS_TOO_LARGE`  | > 1000 annotations or > 1 MiB serialized annotations                   |
| `422 EXPORT_VALIDATION_FAILED`      | EPUBCheck reported error findings for the generated bytes              |
| `502 EXPORT_VALIDATION_MISMATCH`    | Runner validated different bytes than were generated (SHA-256)         |

Markdown/HTML export uses the same route without these bounds and does not touch
the runner, so it is the quickest way to confirm annotation data itself is fine.

## Console Pattern Reference

```
⚠ Common patterns and their meanings:

[epub-loader][trace:xxx][span:yyy] Failed to load EPUB: ...
    → EPUB file unreadable or network error

EPUB init error: Error: Failed to load EPUB: ...
    → Caught in ReaderPage initEpub → reader.loadError shown

Failed to load progress: ...
    → Non-fatal; progress API failed but reader continues

level:info traceId:... event:api.success
    → Normal API call succeeded

level:error traceId:... event:api.error
    → API returned non-OK status

Failed to save progress online, queuing offline
    → Online save failed → falls back to offline queue
```

## Escalation Path

1. **Reader shows blank** → Check console + Network tab for signed URL validity
2. **TOC empty** → Validate EPUB with `epubcheck` or similar; check `book.loaded.navigation`
3. **Highlights not rendering** → Check `renderHighlightsOnRendition` calls in `relocated` handler
4. **Theme not applying** → Check `rendition.themes.registerRules('reader-theme', ...)` — verify `--color-background` and `--color-foreground` CSS vars exist
5. **If not resolved** → File issue with:
   - Console output (full trace)
   - Book ID / slug
   - Browser + OS version
   - Steps to reproduce

# TRIZ Resolution: Author Preview Reliability and Fidelity

## Resolved: Contradiction 1

**Problem:** `createEpubLoader()` can wait until its 30-second load timeout when a module Worker neither sends the `ready` handshake nor emits `error`; the existing fallback is reachable only from `onerror`.

**IFR:** Author preview and reader loading complete archive validation without waiting for the outer timeout, while a healthy Worker remains the normal path and main-thread validation is avoided.

**Separation:** Time, with a condition check on Worker readiness.

**Solution:** Start a bounded readiness timer when the parser Worker is created. A `ready` handshake clears it and flushes queued parse requests; byte buffers are transferred only after readiness, preserving the original bytes for fallback. If the same Worker remains unready at the deadline, terminate and clear it, then run the existing bounded `fallbackParse()` for every pending parse. Route actual pre-ready `onerror` through the same fallback logic; after `ready`, preserve the existing fail-fast rejection for runtime crashes.

**Why Better:** A single no-handshake state no longer waits for the 30-second load timeout. The Worker remains preferred, healthy requests still transfer their source buffers without an extra copy, and the fallback uses the same `validateArchive()` safety boundary. No package format or public loader API changes.

**New Contradictions:** NONE unresolved. Main-thread work is the existing fallback, now also used when startup hangs without an error; it is bounded by the existing archive limits and validation timeout. Queuing until readiness avoids detaching input buffers before a fallback can use them. Once the readiness timeout fires, the unresponsive Worker is terminated so it cannot race the fallback result.

## Component mapping

- `packages/reader-core/src/epub-parser-worker.ts`: readiness timer, queued dispatch after handshake, timeout cancellation, shared pre-ready fallback path, and Worker termination.
- `packages/reader-core/src/__tests__/epub-parser-worker.test.ts`: deterministic queued-dispatch and no-handshake fallback coverage, including source-buffer retention.
- `AuthorEpubPreview`: continues to use the shared `createEpubLoader()` production path; no separate author-only parser.

## Resolved: Contradiction 2

**Problem:** A live author preview's iframe becomes zero-sized after its responsive container changes dimensions, while rebuilding the EPUB and rendition would repeat package parsing and could discard the current location.

**IFR:** The existing rendition remains visible and correctly sized after any preview-container resize, without repackaging or losing the current location.

**Separation:** Condition. Resize the live rendition only when the observed preview container changes to a new nonzero size.

**Solution:** After the rendition displays, observe its container with `ResizeObserver`. Ignore zero and unchanged dimensions; call `EpubRenditionHandle.resize(width, height)` for actual size changes. The handle clears the current EPUB.js views before resizing, forcing the default manager to recreate the current CFI at the new dimensions. The preview's `displayed` listener restores the iframe's accessible title after EPUB.js replaces it. Disconnect the observer during effect cleanup.

**Why Better:** Dynamicity updates the existing rendition in place. It avoids asset refetch, EPUB packaging, archive parsing, and location loss on window resizing or device rotation.

**New Contradictions:** NONE unresolved. The observer watches the fixed-layout preview container, not the EPUB iframe, so resizing the rendition does not resize the observed element and create a feedback loop. Zero dimensions are ignored, and effect cleanup disconnects the observer.

## Component mapping

- `apps/web/src/features/author/components/AuthorEpubPreview.tsx`: observe preview-container size changes, resize the existing rendition, and restore the iframe title after re-display.
- `apps/web/src/features/author/components/AuthorEpubPreview.test.tsx`: cover the resize contract with a controlled observer.
- Browser verification: the live Demo Book preview retained its chapter text and accessible iframe title at 768×1024 and 390×844; both iframe dimensions stayed positive and the document had no horizontal overflow. The authoring E2E also covers desktop, tablet, and mobile resizing.

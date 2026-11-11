# TRIZ Core — Issue #1432: EPUB Annotation Re-export

## Goal

Export the authorized reader's annotations inside a validated copy of the original EPUB, while preserving offline Markdown and bounding all Worker-side package/annotation memory.

## Contradictions

1. **Fidelity vs bounded rewrite:** The output must retain source content/package metadata, but ZIP rewriting and EPUBCheck must not buffer an unbounded archive.
2. **Navigation vs untrusted/stale locators:** Annotations should lead to their source, but stored chapter references/CFIs can be malformed, stale, ambiguous, or user-controlled.
3. **EPUBCheck before success vs validator latency/availability:** The endpoint must validate the exact output before returning it, but the Java runner is external and can time out or be unavailable.
4. **Offline Markdown vs server-authorized EPUB:** Existing Markdown export uses local state and works offline; EPUB export needs protected source bytes and server-owned annotations.

## System boundary

The Worker authorizes the book, selects the same latest `book_files` revision used by the reader, reads it only after R2 size preflight, and builds a transient artifact. The reader-core package helper performs no network access. The existing authenticated EPUBCheck runner validates the final bytes synchronously; no export is persisted and the upload-validation queue is unchanged.

## Risks to resolve

- Strict compressed, uncompressed, entry-count, annotation, and output limits must be enforced before allocation/decompression.
- Only manifest/spine-backed internal paths may become links; stale or invalid locators must remain visible without guessed targets.
- Original chapter/resource bytes and metadata values must remain unchanged; only the package references needed for the appendix/navigation may change.
- The runner response itself is bounded and must identify the exact bytes it checked.

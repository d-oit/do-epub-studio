# Test Corpus

Generated EPUB files for benchmarking and testing. Do not edit manually — regenerate with the build script.

## Files

| File | Size Target | What It Tests |
|------|-------------|---------------|
| `small-text.epub` | ~50 KB | Baseline: 3 chapters, plain text, no images. Tests basic rendering and text extraction. |
| `image-heavy.epub` | ~2 MB | 5 chapters with image references + 2 MB non-compressible binary blob. Tests large archive handling, memory pressure, and image loading. |
| `many-chapters.epub` | ~500 KB | 1300 short chapters. Tests TOC navigation, chapter switching performance, and spine traversal at scale. |
| `malformed.epub` | ~100 KB | Non-standard tags (`<custom-widget>`, `<marquee>`), unclosed elements, event handlers (`onclick`, `onload`), `javascript:` hrefs, `<script>`/`<style>` tags, SVG `<foreignObject>`, large text nodes, unusual Unicode chars. Tests sanitizer robustness. Valid zip structure. |
| `annotation-dense.epub` | ~100 KB | 3 chapters with 1800 annotation range markers each (CFI ranges, highlight spans). Tests highlight anchoring and CFI resolution under load. |

## Regenerating

```bash
node scripts/build-test-corpus.mjs
# Or with custom output:
node scripts/build-test-corpus.mjs --output-dir ./my-output
```

Output goes to `packages/reader-core/src/__fixtures__/corpus/` by default.

## Constraints

- No external EPUB libraries — raw ZIP construction via Node.js `zlib`
- All files are valid EPUBs (correct zip structure, valid OPF/NCX/XML)
- Malformed EPUB is malformed in *content* (bad markup), not in *archive structure*
- Generated files are `.gitignore`d — regenerate as needed

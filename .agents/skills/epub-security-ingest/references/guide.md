# epub-security-ingest — Repo Guide

## Archive validator (`@do-epub-studio/shared/src/archive-validator.ts`)

| Limit | Default |
|---|---|
| Max compressed size | 100 MiB (`MAX_COMPRESSED_SIZE`) |
| Max uncompressed size | 1 GiB (`MAX_UNCOMPRESSED_SIZE`) |
| Max entry count | 10,000 (`MAX_ENTRY_COUNT`) |
| Max compression ratio | 10 (`MAX_COMPRESSION_RATIO`) |
| Timeout | 10 s (`ARCHIVE_VALIDATION_TIMEOUT_MS`) |

Rejects entry names containing `..`, or starting with `/` or `\` (traversal). Emits `ArchiveValidationError`; all options overridable per-call but defaults are the security baseline.

## Sanitizer (`packages/reader-core/src/sanitizer.ts`)

- `sanitizeEpubDocument`/`sanitizeDom` use an allowlist (`EPUB_ALLOWED_TAGS`), not a denylist.
- `createEpubSanitizerHook` must be registered before `rendition.display(...)`.
- `DEFAULT_EXTERNAL_URL_POLICY` = block-all; `buildExternalUrlCsp` produces the CSP; `createExternalUrlGuardHook` enforces it.
- SVG sanitization via `sanitizeSvg` (clipping/active content).
- `SANITIZER_POLICY_VERSION = 4` — bump on policy changes and update tests.

## SMIL (`packages/reader-core/src/media-overlay.ts`)

- `MAX_SMIL_BYTES` = 1 MiB, `MAX_CLIPS_PER_SEQUENCE` = 5,000, `MAX_CLIP_DURATION_SECONDS` = 14,400.
- `parseSmilDocument`, `parseSmilClock`, `findActiveClip` — malformed clocks return safe defaults; never throw into render.

## Parser timeouts

EPUB/XML parsing in `epub-parser-worker.ts` and archive validation run under `withTimeout` + AbortSignal; never parse unbounded.

## Bounded regex (ADR-034)

All regex over untrusted input uses `matchBounded`/`testBounded` from `@do-epub-studio/shared` (e.g., fuzzy re-anchoring said extraction, finding-path parsing).

## Sink check

`node scripts/check-untrusted-ingest-sinks.mjs` scans configured consumers (skills, shell scripts, workflows, TS files) for dynamic-execution sinks: `eval`, `sh -c`, `exec`, shell-enabled `spawn`, `Function` constructor. Adding a new target requires adding it to `DEFAULT_TARGETS`.

## Verification

```bash
flock -w 900 /tmp/vitest.global.lock pnpm --filter @do-epub-studio/reader-core exec vitest run \
  src/__tests__/archive-validator.test.ts src/__tests__/archive-validator-timeout.test.ts \
  src/__tests__/sanitizer.test.ts src/__tests__/sanitizer-timeout.test.ts \
  src/__tests__/media-overlay.test.ts src/__tests__/epub-parser-worker.test.ts
node scripts/check-untrusted-ingest-sinks.mjs
```

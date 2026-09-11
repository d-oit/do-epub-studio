# GOAP-339 — ZIP Bomb and Archive Traversal in EPUB Parsing

Issue: [#339](https://github.com/d-oit/do-epub-studio/issues/339) — CLOSED 2026-05-26 (COMPLETED)
Status: **Implemented on main; verified this sprint.**

## Goal

Pre-validate EPUB archives before epub.js decompresses them: size limits,
entry-count limit, compression-ratio check, path-traversal rejection.

## ADR

- **Chosen (as implemented)**: `packages/reader-core/src/archive-validator.ts` —
  streaming `fflate` `Unzip` pass (no full extraction) enforcing:
  `MAX_COMPRESSED_SIZE = 100 MiB`, entry-count cap, total-uncompressed cap,
  per-entry compression-ratio cap, and `..`/absolute-path traversal rejection;
  wrapped in `withTimeout` (default via caller: 10 s). Wired at **both**
  ingestion paths: `epub-parser.worker.ts` (`validateEpubArchive`, 10 s timeout)
  and `epub-parser-worker.ts:172` before parse. Typed error
  `ArchiveValidationError` with distinct messages per limit.
- **Rejected**: decompress-then-measure (memory is the attack vector);
  trusting epub.js internals (no hook surface); worker-thread-only validation
  (both parse entry points are workers; guard lives pre-parse in both).

## Implementation (as landed)

1. `archive-validator.ts` — `validateArchive(data, { timeoutMs, traceId })` + inner streaming validator.
2. Wired into `epub-parser.worker.ts` and `epub-parser-worker.ts` (all `validateArchive` call sites repo-wide are these two + tests — grepped 2026-08-29).
3. `epub-loader.test.ts` / `epub-parser-worker.test.ts` mock the guard to isolate loader/protocol behavior.

## Acceptance → Evidence

| Acceptance (issue body) | Test / file |
|---|---|
| ZIP bombs rejected before decompression | `archive-validator.test.ts` — "rejects high compression ratios (potential ZIP bomb)" |
| Path traversal entries rejected | same — "rejects … `../` …", "rejects absolute paths starting with /" |
| Unreasonable compression ratios rejected | same — ratio test |
| File size limits enforced | same — "rejects an archive that exceeds max compressed size" |
| Entry count / total size | `epub-parser.worker.test.ts` — "too many entries", "total uncompressed size exceeds limit", "No entries found" |
| Timeout | `archive-validator-timeout.test.ts` |

Verification run: `pnpm exec vitest run packages/reader-core` (sprint baseline, 2026-08-29).

## Effort

M (historical; verification only this sprint).

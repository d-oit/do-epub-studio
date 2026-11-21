# epub-validation — Repo Guide

## Runner (`apps/epubcheck-runner`)

- Package: `@do-epub-studio/epubcheck-runner` (Node service, Java required for EPUBCheck).
- `src/server.ts` — private channel endpoint; accepts bounded EPUB bytes; argument-safe process spawn; bounded time/memory; isolated temp storage; structured JSON output.
- `src/epubcheck-parsing.ts` — `parseFindings` (text) / `parseJsonReport` (structured), `normalizeFindingPath`, `validateRootfilePath`, `extractRootfilePath`, `extractOpfFromZip`, `extractEpubVersion`, `metadataFromOpf`.
- Pinned validator: EPUBCheck 5.4.0 with SHA-256 defined in `scripts/check-epub-fixtures.mjs` (downloads into `.cache/epubcheck` when missing).

## Orchestration (Worker)

- Persist revision first, then enqueue compact immutable file/revision reference to a Cloudflare Queue.
- Queue consumer streams the R2 object to the runner and persists the result: status, validator version, EPUB version, server-computed SHA-256, normalized severity/code/location/path, safe message, bounded report JSON.
- Idempotency: matching `(revision, sha256, validatorVersion)` is a no-op; changed bytes or validator version require a new result.
- Retries bounded; exhausted work visible via dead-letter path; admin retry re-enqueues; admin status/retry/report access requires admin authorization.
- Runner unavailability is visible as pending/error, never silent.

## Separation of concerns

| Concern | Owner |
|---|---|
| Archive safety (size, entries, ratio, timeout, traversal) | `validateArchive` in `@do-epub-studio/shared/src/archive-validator.ts` |
| Conformance evidence | This skill (EPUBCheck) |
| Accessibility claims + report wording | `epub-accessibility` |
| Reader-UI accessibility | `accessibility-auditor` |

## Tests

```bash
flock -w 900 /tmp/vitest.global.lock pnpm --filter @do-epub-studio/epubcheck-runner exec vitest run test/server.test.ts
flock -w 900 /tmp/vitest.global.lock pnpm --filter @do-epub-studio/worker exec vitest run src/__tests__/epub-validation-queue.test.ts
node scripts/check-epub-fixtures.mjs
```

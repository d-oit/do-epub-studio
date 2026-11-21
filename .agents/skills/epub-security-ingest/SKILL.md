---
name: epub-security-ingest
description: >
  Use for hostile ZIP/XML/SMIL ingestion, archive limits, sanitization, origin
  isolation, and adversarial fixtures. Not for packaging (epub-authoring-export)
  or conformance reports (epub-validation).
category: quality
allowed-tools: Read Write Edit Glob Grep Bash
version: "1.0.0"
license: MIT
---

# Skill: `epub-security-ingest`

Purpose: keep every untrusted EPUB ingestion path inside the bounded validation + sanitization envelope — archive limits, parser timeouts, allowlist sanitization, and origin isolation.

## When to Use

**Activate when:**
- Upload/ingest endpoints, `validateArchive` usage, or archive limit constants change.
- Editing the reader sanitizer (`sanitizer.ts`, `sanitizer-uri.ts`) or the sandbox policy.
- Parsing hostile XML/SMIL (`epub-parser-worker.ts`, `media-overlay.ts`).
- Adding adversarial fixtures (zip bombs, traversal attempts, oversized entries, script payloads).
- Any regex over untrusted EPUB content, or any new code path that reads uploaded bytes.

**Activate when (extension):** conformance or accessibility evidence task → `epub-validation` / `epub-accessibility`; generating new EPUBs → `epub-authoring-export`.

## Inputs & Authority Hierarchy

1. **ADR-1017** security boundary clause + `docs/security-posture.md` — compensating controls; archive safety is independent from conformance and is a hard rejection.
2. **ADR-034** (`plans/archive/034-adr-security-redos-hardening.md`) — every regex over untrusted input uses `matchBounded`/`testBounded` from `@do-epub-studio/shared`.
3. **Shared validator**: `@do-epub-studio/shared/src/archive-validator.ts` → `validateArchive` (defaults: 100 MiB compressed, 1 GiB uncompressed, 10,000 entries, ratio 10, 10s timeout, traversal checks). Re-exported by `packages/reader-core/src/archive-validator.ts`.
4. **Sanitizer**: `packages/reader-core/src/sanitizer.ts` (`sanitizeDom`, `sanitizeEpubDocument`, `createEpubSanitizerHook`, `buildExternalUrlCsp`, `DEFAULT_EXTERNAL_URL_POLICY` = block-all).
5. **SMIL bounds**: `packages/reader-core/src/media-overlay.ts` (`MAX_SMIL_BYTES` 1 MiB, `MAX_CLIPS_PER_SEQUENCE` 5,000, `MAX_CLIP_DURATION_SECONDS` 14,400).

## Safe CLI-First Workflow

1. Any new ingestion sink must sit behind `validateArchive` first; hard safety rejection happens before any content is parsed or rendered.
2. Use `withTimeout` + AbortSignal on every EPUB/XML parse; never parse unbounded content.
3. Sanitize before display via `createEpubSanitizerHook`; the iframe sandbox stays `allow-same-origin` only; external URLs default to block-all unless a scoped policy allows them.
4. Regex over untrusted text is always bounded (`matchBounded`/`testBounded`); no ad-hoc regex over book content.
5. Sink check: run `node scripts/check-untrusted-ingest-sinks.mjs` — it fails if any configured consumer gains dynamic-execution sinks (eval/exec/shell spawn).
6. Keep traceId emitted before any path-length guard; never log secrets or raw package contents.

## REQUIRED Verification Commands

```bash
cd /home/doit/git/do-epub-studio   # or the active worktree
flock -w 900 /tmp/vitest.global.lock pnpm --filter @do-epub-studio/reader-core exec vitest run \
  src/__tests__/archive-validator.test.ts src/__tests__/archive-validator-timeout.test.ts \
  src/__tests__/sanitizer.test.ts src/__tests__/sanitizer-timeout.test.ts \
  src/__tests__/media-overlay.test.ts src/__tests__/epub-parser-worker.test.ts
# Hermetic sink proof (fail if new exec/eval sinks appear)
node scripts/check-untrusted-ingest-sinks.mjs
# Skill/catalog/sync gates
bash scripts/validate-skill-format.sh && bash scripts/validate-skills.sh && node scripts/check-agent-sync.mjs
```

## Expected Outputs

- Hostile archives rejected with typed `ArchiveValidationError` (size/entries/ratio/timeout/traversal), before rendering.
- Sanitized DOM with allowlisted tags only; external URLs blocked by default; CSP tightened accordingly.
- SMIL parsed within byte/clip/duration bounds; malformed clocks handled, never crashing.
- No unbounded regex; no dynamic-execution sinks in ingest consumers.

## Example Task

"Add an adversarial fixture for a zip bomb (1.1 GiB uncompressed from 2 MiB compressed) to `archive-validator.test.ts` and confirm rejection via `validateArchive`."

## Reference Files

- `references/guide.md` — limits, sanitizer policies, sink checker details.
- `docs/security-posture.md`
- `plans/archive/034-adr-security-redos-hardening.md`
- `plans/1017-adr-epub-conformance-and-evidence.md` (archive-safety clause)
- `packages/reader-core/src/sanitizer.ts`, `packages/reader-core/src/media-overlay.ts`

## Rationalizations

| Rationalization | Reality |
|-----------------|---------|
| "The upload is small, so I can skip the archive check." | `validateArchive` runs on every ingest path regardless of size; skipping shrinks the security boundary for zero gain. |
| "A regex over the imported text is fine — it's just XHTML." | Untrusted content is untrusted: use `matchBounded`/`testBounded` (ADR-034) so pathological input cannot stall the worker. |
| "The reader is in an iframe, so scripts are harmless." | The sandbox is `allow-same-origin` only — still sanitize every document; never rely on the iframe alone. |
| "I can increase MAX_COMPRESSED_SIZE for this publisher." | Limits are security constants; changing them requires a security review and concurrent update of fixtures/tests. |

## Red Flags

- [ ] Any ingest path bypasses `validateArchive` (including "pre-validated" uploads).
- [ ] Unbounded regex over EPUB text, or `matchBounded`/`testBounded` not used.
- [ ] Content rendered without `createEpubSanitizerHook`, or iframe sandbox loosened.
- [ ] Parser without timeout/AbortSignal, or SMIL beyond the byte/clip/duration bounds.
- [ ] New sink found by `check-untrusted-ingest-sinks.mjs`, or archive limits changed without test updates.
- [ ] Secrets/tokens logged, or file paths from hostile packages emitted into logs/reports.

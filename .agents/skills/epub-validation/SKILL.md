---
name: epub-validation
description: >
  Use for EPUBCheck integration, finding normalization/source locations, severity,
  revision-bound conformance evidence, and accessibility report generation. Not
  for hostile-archive safety (see epub-security-ingest) or packaging (see epub-authoring-export).
category: quality
allowed-tools: Read Write Edit Glob Grep Bash
version: "1.0.0"
license: MIT
---

# Skill: `epub-validation`

Purpose: operate the EPUBCheck validation pipeline — isolated runner, durable revision-bound orchestration, normalized findings, and evidence reports — without conflating safety, conformance, and accessibility claims.

## When to Use

**Activate when:**
- Editing `apps/epubcheck-runner/` (server or parsing) or the queue consumer in the Worker.
- Normalizing finding paths/severity or producing the JSON report schema.
- Working on revision-scoped validation status, retry, dead-letter, or admin report endpoints.
- Changing how EPUB conformance evidence is stored or displayed (report wording, idempotency).

**Activate when (extension):**
- Archive-safety limits or sanitization → `epub-security-ingest`.
- Generating new packages → `epub-authoring-export`.
- Accessibility claims beyond report wording → `epub-accessibility`.

## Inputs & Authority Hierarchy

1. **ADR-1017** (`plans/1017-adr-epub-conformance-and-evidence.md`) — normative: EPUBCheck 5.4.0 pinned, private channel, durable queue, idempotent `(revision, sha256, validatorVersion)`, safety separate from conformance, evidence never conflated.
2. **Pinned validator metadata**: `scripts/check-epub-fixtures.mjs` pins EPUBCheck 5.4.0 + SHA-256.
3. **Runner code**: `apps/epubcheck-runner/src/server.ts`, `src/epubcheck-parsing.ts` — source of truth for finding shape.
4. **Worker orchestration**: `apps/worker/src/index.ts` (queue consumer), `apps/worker/src/routes/admin/books-validation.ts` (admin status/retry/report).

## Safe CLI-First Workflow

1. Read ADR-1017 before touching validation code. Keep validating conformance and archive safety separate: `validateArchive` rejection is a hard safety boundary; EPUBCheck findings are advisory evidence that never discard an accepted revision.
2. Never run Java inside the Worker. The runner is the only place EPUBCheck executes, via argument-safe spawn with bounded time/memory and isolated temp storage.
3. When parsing EPUBCheck output, use `parseFindings`/`parseJsonReport` and normalize locations via `normalizeFindingPath`; preserve code/severity and produce safe, bounded messages. Do not log raw file paths from hostile packages.
4. Persist the revision first, then enqueue a compact immutable reference; match idempotently on `(revision, sha256, validatorVersion)`. Changed bytes or validator version require a new result.
5. Report wording must never imply certification. Accessibility evidence is a separate report (see `epub-accessibility`).
6. Verify with the commands below.

## REQUIRED Verification Commands

```bash
# Runner tests (server contract, parsing/normalization)
flock -w 900 /tmp/vitest.global.lock pnpm --filter @do-epub-studio/epubcheck-runner exec vitest run test/server.test.ts
# Corpus conformance against pinned EPUBCheck (requires java; uses .cache/epubcheck)
node scripts/check-epub-fixtures.mjs
# Worker queue behavior
flock -w 900 /tmp/vitest.global.lock pnpm --filter @do-epub-studio/worker exec vitest run src/__tests__/epub-validation-queue.test.ts
# Skill/catalog/sync gates
bash scripts/validate-skill-format.sh && bash scripts/validate-skills.sh && node scripts/check-agent-sync.mjs
```

## Expected Outputs

- Structured findings with normalized severity, code, location/path, and safe message; EPUB version + validator version recorded.
- Idempotent revision-scoped validation status; runner unavailability visible as pending/error, never silent.
- Admin-only status/retry/report access; dead-letter visibility for exhausted retries.
- Report/copy that states it is evidence, not certification.

## Example Task

"Normalize EPUBCheck finding paths that arrive with backslashes or duplicated `OEBPS/` prefixes, and add a regression test to `epubcheck-parsing.test.ts`."

## Reference Files

- `references/guide.md` — runner/parsing/queue anatomy and idempotency details.
- `plans/1017-adr-epub-conformance-and-evidence.md`
- `apps/epubcheck-runner/src/server.ts`, `apps/epubcheck-runner/src/epubcheck-parsing.ts`
- `apps/worker/src/index.ts`

## Rationalizations

| Rationalization | Reality |
|-----------------|---------|
| "EPUBCheck passes, so the uploaded book is safe." | Conformance ≠ safety. `validateArchive` (size/entry/ratio/timeout/path limits) is the security boundary; EPUBCheck findings never replace it. |
| "I can run EPUBCheck inside the Worker to return results synchronously." | Java cannot run in the Worker runtime; validation is async via the queue, and uploads never wait for it. |
| "A changed file needs a fresh report only if severity changes." | Results are keyed on `(revision, sha256, validatorVersion)` — any byte change or validator bump invalidates the old result. |

## Red Flags

- [ ] Conformance findings used to reject an otherwise accepted revision (or safety rejection downgraded to a warning).
- [ ] Finding paths/messages echo raw untrusted archive content without normalization/allowlisting.
- [ ] Validation outcome cached without the validator version in the key.
- [ ] Upload response blocks on EPUBCheck, or Java is introduced into Worker code.
- [ ] Report text implies certification or mixes reader-UI accessibility with publication content findings.
- [ ] Runner or queue changes landed without `server.test.ts`/`epub-validation-queue.test.ts` coverage.

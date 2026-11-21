---
name: epub-authoring-export
description: >
  Use for EPUB 3 manuscript authoring, OPF/manifest/spine/nav generation, metadata,
  and deterministic ZIP packaging (mimetype ordering). Not for hostile uploads
  (see epub-security-ingest) or validation evidence (see epub-validation).
category: workflow
allowed-tools: Read Write Edit Glob Grep Bash
version: "1.0.0"
license: MIT
---

# Skill: `epub-authoring-export`

Purpose: package structured `AuthorPublication` manuscripts into conforming, deterministic EPUB 3 packages using the `reader-core` packager, and keep round-trip fidelity with the reading engine.

## When to Use

**Activate when:**
- Creating or editing the authoring workspace, manuscript drafts, or publish flow (`/api/author/*`, D1 `book_manuscript_drafts`).
- Changing `packages/reader-core/src/packager/` — OPF, manifest, spine, nav, serializer, ZIP writer.
- Adding metadata fields, chapter structure, or local assets to generated EPUBs.
- Debugging package determinism, `mimetype` ordering, or round-trip load failures of packaged output.

**Activate when (extension):** a task is about *reading/validating* someone else's upload → use `epub-validation` or `epub-security-ingest` instead. This skill owns generation only, never hostile-input handling.

## Inputs & Authority Hierarchy

1. **ADR-1020** (`plans/1020-adr-epub-authoring-and-packager.md`) — normative package layout, schema constraints, publish lifecycle. Highest authority.
2. **ADR-1017** (`plans/1017-adr-epub-conformance-and-evidence.md`) — conformance baseline (EPUB 3.3) that generated output must satisfy.
3. **Packager code**: `packages/reader-core/src/packager/` — `packager.ts`, `zip.ts`, `serializer.ts`, `index.ts`; the implementation is the source of truth for exact bytes.
4. **Schema/Zod boundaries**: `packages/schema` for `AuthorPublication`; authoring endpoints validate at the boundary.
5. **`packages/reader-core/src/archive-validator.ts`** (shared `validateArchive`) — mandatory pre-publish archive-safety gate.

## Safe CLI-First Workflow

1. Read ADR-1020 first; confirm which package layout variant the task targets (default: `OEBPS/`).
2. Inspect `packager.ts` + `zip.ts` before editing: the ZIP writer must emit `mimetype` first, uncompressed (Store method), at offset 0. Never reorder entries — determinism is a tested contract.
3. Constrain all content to the semantic tag vocabulary in ADR-1020 (no scripts, `<style>`, inline `on*` handlers, arbitrary external URLs). Sanitize via `sanitizeDom`/DOMPurify before persistence *and* before packaging.
4. Generated files must be listed in the OPF manifest and spine in document order; `nav.xhtml` must exist for EPUB 3.
5. Publish = one-way: compile draft → run `validateArchive` synchronously → write content-addressed bytes to R2 under SHA-256 → insert `book_files` row → enqueue EPUBCheck via `epub-validation-queue.ts`. Never overwrite a published revision; keep `draft_version` optimistic locking (409 on race).
6. Verify with the commands below. Regenerate any fixture corpus that depends on packaged output (`node scripts/build-test-corpus.mjs --output-dir …`).

## REQUIRED Verification Commands

```bash
cd /home/doit/git/do-epub-studio   # or the active worktree
# Packager unit tests (determinism, mimetype offset, spine/manifest/nav, round-trip)
flock -w 900 /tmp/vitest.global.lock pnpm --filter @do-epub-studio/reader-core exec vitest run src/__tests__/packager.test.ts
# Conformance of the generated corpus against pinned EPUBCheck 5.4.0
node scripts/check-epub-fixtures.mjs
# Skill format gate (frontmatter, ≤250 lines, Rationalizations/Red Flags)
bash scripts/validate-skill-format.sh
# Sync/catalog gates touched by any skill change
bash scripts/validate-skills.sh && node scripts/check-agent-sync.mjs
```

## Expected Outputs

- A deterministic, byte-identical package for identical input (same order, timestamps, compression level).
- `mimetype` first at offset 0 with `application/epub+zip`, uncompressed.
- Complete OPF with metadata, unique identifier, manifest covering every referenced file, ordered spine, `nav.xhtml`.
- Round-trip: `createEpubLoader` loads the packaged output without sanitizer violations or missing-resource errors.

## Example Task

"Add page-list (`nav epub:type="page-list"`) generation to the authoring packager, with a fixture verifying it appears in nav and manifest."

## Reference Files

- `references/guide.md` — repo anatomy, authority hierarchy, and packager invariants.
- `plans/1020-adr-epub-authoring-and-packager.md`
- `plans/1017-adr-epub-conformance-and-evidence.md`
- `packages/reader-core/src/packager/zip.ts`, `packages/reader-core/src/packager/packager.ts`

## Rationalizations

| Rationalization | Reality |
|-----------------|---------|
| "I can zip in any order as long as the reader opens it." | The ZIP order, `mimetype` Store method, and byte determinism are tested contracts in `packager.test.ts`; changing them breaks reproducibility and R2 content-addressing. |
| "Scripts in the manuscript make it more interactive." | ADR-1020 forbids active content by schema; `sanitizeDom` strips it. Interactive authoring belongs in the UI, never in the packaged EPUB. |
| "Overwriting a revision is fine — it's just an author workspace." | Published revisions are immutable and content-addressed; clients and audits depend on that. Amend a draft, publish a new revision. |

## Red Flags

- [ ] `mimetype` not first/uncompressed, or entry order varies between runs.
- [ ] Package includes scripts, event handlers, or external URLs rejected by the schema/sanitizer.
- [ ] Manifest/spine drift: a chapter present in spine but not manifest (or vice versa).
- [ ] Publishing overwrites an existing immutable revision or bypasses `validateArchive`.
- [ ] Draft save lost silently instead of 409 conflict on `draft_version` race.
- [ ] Packager tests skipped after touching `zip.ts`/`serializer.ts`.
- [ ] New packager feature landed without a fixture in `src/__tests__/fixtures/`.
- [ ] Metadata added to OPF but not covered by `metadataFromOpf` round-trip assertions.

---
name: epub-reader-regression
description: >
  Use for EPUB corpus triage, cross-browser reader tests, CFI/pagination, RTL,
  fixed-layout, and media overlay regressions. Not for implementing loader/TOC
  anchoring (see epub-rendering-and-cfi).
category: quality
allowed-tools: Read Write Edit Glob Grep Bash
version: "1.0.0"
license: MIT
---

# Skill: `epub-reader-regression`

Purpose: keep the reader stable across the capability corpus and browsers — triage rendering/regression reports, regenerate fixtures, and verify behavior against the evidence-backed capability matrix.

## When to Use

**Activate when:**
- A reader rendering/regression bug is reported (layout, pagination, RTL, fixed layout, media overlays, CFI navigation).
- Changing corpus fixtures (`packages/reader-core/src/__tests__/fixtures/generate.mjs` → generated `capability-corpus/`) or the matrix `docs/epub-capability-matrix.md`.
- Running/updating cross-browser reader checks (Playwright: chromium, firefox, webkit, iphone, pixel, pwa-chromium).
- Verifying a new reader capability claim against evidence.

**Activate when (extension):** implementing loader/rendition/TOC/anchoring itself → `epub-rendering-and-cfi`.

## Inputs & Authority Hierarchy

1. **Capability matrix**: `docs/epub-capability-matrix.md` — evidence-backed (status, observed behavior, fixture, engine/version); the review cadence and standards baseline there are authoritative.
2. **ADR-006** (`plans/archive/006-adr-annotation-model.md`) — multi-signal locators (CFI + text + chapter + DOM fallback).
3. **Reader core**: `packages/reader-core/src/` — `fixed-layout.ts`, `media-overlay.ts`, `locator.ts`, `epub-loader.ts`, `toc.ts`.
4. **Corpus scripts**: `packages/reader-core/src/__tests__/fixtures/generate.mjs` + `generate-capabilities.mjs` (capability corpus generators; run pre-test via `test:unit`), `scripts/check-epub-fixtures.mjs` (runs pinned EPUBCheck over the corpus).

## Safe CLI-First Workflow

1. Triage: reproduce against the corpus first — identify which fixture(s) exercise the failing path; if none exist, file the gap and add a fixture (see `fixtures/generate.mjs` data model).
2. Pin the claim: check the capability matrix before asserting any behavior; a claim without (fixture, engine version, observed behavior) evidence is not a claim.
3. CFI regressions: verify locator multi-signal behavior (cfi + selectedText + chapterRef + DOM fallback) via `locator*` tests — never reduce to CFI-only.
4. Cross-browser: reader E2E runs via Playwright projects in CI only — never launch browsers during local unit tests; local work uses Vitest with `pool: 'forks'`.
5. Media overlays: respect SMIL bounds (`media-overlay.ts`); RTL/fixed-layout behavior comes from `resolveBookDirection`/`parseFixedLayoutFromOpf` — add fixtures per axis.
6. After changes, regenerate/validate corpus and run the targeted vitest set.

## REQUIRED Verification Commands

```bash
cd /home/doit/git/do-epub-studio   # or the active worktree
# Targeted reader regression tests
flock -w 900 /tmp/vitest.global.lock pnpm --filter @do-epub-studio/reader-core exec vitest run \
  src/__tests__/capability-corpus.test.ts src/__tests__/locator-cfi.test.ts \
  src/__tests__/fixed-layout.test.ts src/__tests__/media-overlay.test.ts
# Corpus conformance against pinned EPUBCheck 5.4.0
node scripts/check-epub-fixtures.mjs
# Regenerate capability-corpus fixtures after model changes (also runs pre-test)
node src/__tests__/fixtures/generate.mjs
node src/__tests__/fixtures/generate-capabilities.mjs
# Skill/catalog/sync gates
bash scripts/validate-skill-format.sh && bash scripts/validate-skills.sh && node scripts/check-agent-sync.mjs
```

## Expected Outputs

- Regression reports tied to specific fixtures + engine versions; matrix updated when a claim changes.
- New fixtures for uncovered axes (RTL, fixed layout, overlays, pagination) with deterministic content.
- Green targeted vitest run and corpus conformance check.

## Example Task

"Investigate 'chapter 3 renders LTR in an RTL book' using the corpus; if uncovered, add an RTL fixture and cover `resolveBookDirection`."

## Reference Files

- `references/guide.md` — corpus layout, matrix mechanics, and browser matrix.
- `docs/epub-capability-matrix.md`
- `plans/archive/006-adr-annotation-model.md`
- `packages/reader-core/src/fixed-layout.ts`, `packages/reader-core/src/media-overlay.ts`
- `packages/reader-core/src/__tests__/fixtures/generate.mjs`, `packages/reader-core/src/__tests__/fixtures/zip-builder.mjs`

## Rationalizations

| Rationalization | Reality |
|-----------------|---------|
| "The reader opens the book, so the feature works." | Capability claims require matrix evidence: status + observed behavior + fixture + engine/version. Unverified behavior is not a claim. |
| "I can run Playwright locally to check this quickly." | Browser launches belong to CI Playwright projects; local verification uses Vitest (forks pool). Never launch browsers in unit tests. |
| "CFI alone is enough to restore the highlight." | ADR-006 requires multi-signal locators; CFI-only regressions are the drift bug class. |
| "This edge case doesn't need a fixture." | Every matrix entry references a deterministic fixture; uncovered axes get a fixture before a fix is accepted. |

## Red Flags

- [ ] Claim added to the matrix without fixture + engine/version evidence.
- [ ] CFI-only logic changes without updating multi-signal locator tests.
- [ ] Fixture regenerated non-deterministically or without updating `check-epub-fixtures.mjs` expectations.
- [ ] RTL/fixed-layout change without an axis fixture.
- [ ] Playwright invoked during unit tests, or vitest run outside the flock.
- [ ] Regression closed without a reproducing fixture path.

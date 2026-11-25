# EPUB Corpus Regression Policy (issue #1483)

This document defines how new parser/security defects add minimized fixtures to
the durable corpus (extending #1434). The corpus lives in
`packages/testkit/src/epub-corpus/`:

- `manifest.ts` — single source of truth (provenance, expectations, verdicts);
- `generate.ts` — deterministic in-repo generators (no network, no binaries);
- `known-diffs.ts` — triaged EPUBCheck disagreements (never silent failures);
- Layer 1: `packages/reader-core/src/__tests__/epub-corpus.test.ts` (Vitest);
- Layer 2: `apps/tests/epub-corpus.spec.ts` (Playwright, shared manifest);
- Differential: `scripts/diff-corpus-epubcheck.mts` (optional job).

## Rules

1. **Every fixture has provenance.** A new fixture must declare `source`,
   `license` (CC0-1.0) and a note explaining what it models. No fixture may be
   vendored from the network.
2. **Every fixture has expected outcomes.** `expectedParses`,
   `expectedArchive`, `expectedDiagnostics`, `expectedMetadata` and
   `securityVerdict` are mandatory. A fixture without explicit expectations is
   not a corpus fixture.
3. **One manifest.** Unit and browser layers parametrize from
   `CORPUS_ENTRIES`; never fork expectations in a spec.
4. **Regressions fail pre-merge.** Layer 1 runs in CI on every PR that touches
   the reader/sanitizer/archive code. Missing expected diagnostics or an
   unexpected archive rejection fails the suite.
5. **No silent expected-failures.** If EPUBCheck legitimately disagrees with
   our (stricter or more tolerant) behavior, add a triage row to
   `known-diffs.ts` with a rationale. The differential job fails on untriaged
   error-level findings.

## Adding a fixture for a discovered defect

1. **Minimize.** Reduce the failing input to the smallest EPUB (or archive)
   that still triggers the defect. Keep content deterministic (use
   `prng`-seeded generation or fixed strings).
2. **Generate.** Add a generator function in `generate.ts` returning the
   archive bytes; register it in `generateCorpusEntry`. Prefer reusing
   `buildEpubFromSpec`/`specWithBody` builders; add a `case` in the switch.
3. **Declare.** Add a manifest entry in `manifest.ts` with provenance,
   feature tags, and the exact expected outcomes. For security defects, set
   `securityVerdict` to `sanitized` (with what is stripped) or
   `graceful-reject` (with where).
4. **Wire diagnostics.** The Layer 1 collector (`collectDiagnostics`) is code
   based: teach it to emit your diagnostic codes by reading the archive and
   the sanitized DOM. Prefer one code per observable behavior.
5. **Cover both layers.** Set `browserable: true` only when the fixture is a
   valid archive a real reader can open; adversarial payloads that exist only
   to be rejected stay unit-layer only.
6. **Verify.** Run Layer 1; then typecheck/lint both touched workspaces.
7. **Triage EPUBCheck.** When EPUBCheck would report error-level findings that
   we intentionally differ on, add a `KNOWN_DIFFS` row.

## Corpus integrity checks

- Generation is deterministic: Layer 1 regenerates each fixture and asserts
  byte-identity.
- No fixture may trigger network access in tests; all routes are mocked in
  Layer 2 and no resource is fetched in Layer 1.
- Coverage is reported by category via the manifest (`standards`,
  `layout-i18n`, `embedded-resources`, `media-annotation`, `malformed`,
  `security`); CI fails on unexpected archive/parse behavior changes.

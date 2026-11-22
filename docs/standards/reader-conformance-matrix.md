# Reader typography / navigation conformance matrix

Status of script-specific typography and navigation behaviors across the reader's
supported targets. Each row lists the curated fixture that exercises it and the
test files that pin the behavior. Fixtures are generated deterministically
in-test (`packages/testkit/src/multilingual-epub-factory.ts`) — no network, no
binaries.

Legend: **supported** = behavior verified and pinned by tests · **partial** =
works for common cases, known gaps documented · **unsupported** = not provided,
rationale below.

| #   | Behavior                                                                                                                        | Support     | Fixture                                       | Tests                                                                                                                            | Limitation                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | RTL reading (Arabic) — package `page-progression-direction="rtl"` drives spine order, chapter `dir="rtl"` survives sanitization | supported   | `ar-rtl`                                      | Vitest `packages/reader-core/src/__tests__/multilingual-conformance.test.ts`; Playwright `apps/tests/reader-conformance.spec.ts` | Page-progression falls back to LTR when the package omits the attribute (epub.js default)                                         |
| 2   | RTL reading (Hebrew)                                                                                                            | supported   | `he-rtl`                                      | same as #1                                                                                                                       | same as #1                                                                                                                        |
| 3   | Vertical writing (Japanese) — `writing-mode: vertical-rl` in chapter CSS survives sanitization and is renderable                | partial     | `ja-vertical`                                 | Vitest same file (sanitizer markers); Playwright same spec (computed `writing-mode`)                                             | Pagination is horizontal-only; epub.js column pagination in vertical flow is not exercised; `text-orientation` handled by browser |
| 4   | CJK punctuation / line breaking — punctuation glyphs (、。「」（），。！？；：“) preserved byte-for-byte                        | supported   | `ja-vertical`, `zh-ruby`, `ko`                | Vitest same file (verbatim-text + sanitizer markers)                                                                             | Line-breaking decisions are browser CSS responsibilities; not asserted by tests                                                   |
| 5   | Ruby annotations (`<ruby><rt>` preserved and rendered                                                                           | supported   | `zh-ruby`, `ja-vertical`                      | Vitest same file (`querySelector('ruby rt')`); Playwright same spec                                                              | No ruby typography controls (size/alignment are CSS-only)                                                                         |
| 6   | In-book language switch — chapter-level `lang`/`dir` change within one publication                                              | supported   | `inbook-lang-switch`                          | Vitest same file; Playwright same spec (chapter `lang` asserted per chapter)                                                     | Sanitizer preserves `lang`; no per-chapter direction override beyond attributes                                                   |
| 7   | Page progression direction                                                                                                      | supported   | `ar-rtl`, `he-rtl`                            | Vitest same file (`book.packaging.direction`); Playwright same spec (ArrowRight advances to next spine item)                     | Fixed-layout spread handling is separate (see `resolveEffectiveSpread`)                                                           |
| 8   | Mixed-script search — Latin inside RTL and RTL inside LTR chapters                                                              | partial     | `mixed-bidi`                                  | Vitest same file (bidi spans preserved); in-book search spec `apps/tests/in-book-search.spec.ts`                                 | Search matches plain text; no Unicode normalization or script-aware ranking; whole-word semantics are ASCII-only                  |
| 9   | TOC hierarchy (nested nav)                                                                                                      | supported   | `ar-rtl`, `zh-ruby`                           | Vitest same file (`flattenToc`, subitems presence)                                                                               | epub.js flattens nested nav entries into duplicated labels; hierarchy depth is preserved but parent text is not exposed           |
| 10  | Landmarks / page-list navigation                                                                                                | unsupported | `ar-rtl` (nav contains landmarks + page-list) | Vitest same file ("no landmark/page-list APIs")                                                                                  | The reader navigation model is TOC-only; landmarks/page-list are not surfaced in UI; no reader regression tests                   |
| 11  | App locale vs content language separation                                                                                       | supported   | `inbook-lang-switch`                          | Playwright same spec ("app locale never rewrites publication")                                                                   | App locale is a cookie/localStorage preference; publication `lang` is immutable                                                   |
| 12  | Bidi isolation (`unicode-bidi: isolate` on mixed runs)                                                                          | supported   | `mixed-bidi`, `inbook-lang-switch`            | Vitest same file (span markers); Playwright same spec (computed `unicode-bidi`)                                                  | Isolation spans must be authored; reader does not auto-wrap mixed runs                                                            |

## Verification commands

```bash
# Vitest (reader-core layer)
pnpm --filter @do-epub-studio/reader-core exec vitest run src/__tests__/multilingual-conformance.test.ts

# Playwright (render layer; run in CI, not locally)
pnpm exec playwright test apps/tests/reader-conformance.spec.ts
```

## Related decisions

- `docs/typography-decision.md` — reader typography model.
- `docs/epub-capability-matrix.md` — generic EPUB capability surface.
- Reading-direction UI controls exist in the settings panel
  (`apps/web/src/features/reader/components/toolbar/ReaderSettingsPanel.tsx`); they
  only override when the publication has not declared a direction (see
  `useEpubRendition`), satisfying the "user-facing controls only where metadata
  does not define behavior" requirement. Writing-mode controls are `partial`:
  they apply CSS `writing-mode` via the theme applier and are not reflected in
  pagination.

# epub-reader-regression — Repo Guide

## Corpus

- Location: `packages/reader-core/src/__tests__/fixtures/` → generated `capability-corpus/` (generated, deterministic).
- Generators: `packages/reader-core/src/__tests__/fixtures/generate.mjs` (capability corpus) + `generate-capabilities.mjs`; run automatically before `test:unit`/`test:coverage`. `scripts/build-test-corpus.mjs` is the separate benchmark corpus generator (`--output-dir`).
- Conformance gate over the corpus: `scripts/check-epub-fixtures.mjs` — requires Java; downloads pinned EPUBCheck 5.4.0 into `.cache/epubcheck` (SHA-256 verified).

## Capability matrix

`docs/epub-capability-matrix.md` records per-feature: status, observed reader behavior, fixture, and engine/version. Sections: standards status/normative baseline, evidence & classification, format and layout, content and navigation, security & accessibility metadata, validator scope vs reader compatibility, reproducibility, review cadence. `scripts/check-standards-status.mjs` checks standards drift.

## Reader modules to know

- `fixed-layout.ts` — `parseFixedLayoutFromOpf`, `isFixedLayout`, `resolveBookDirection` (RTL/LTR).
- `media-overlay.ts` — SMIL bounds, `parseSmilDocument`, `parseSmilClock`, `findActiveClip`.
- `locator.ts` + `locator-cfi.test.ts` — multi-signal locators (ADR-006).
- `epub-loader.ts` — load/rendition lifecycle; `toc.ts` — TOC building.

## Browser matrix (CI only)

Root `playwright.config.ts` defines projects: demo-preview, live-cloudflare, chromium, firefox, webkit, iphone, pixel, pwa-chromium. Local skill work never launches browsers; use Vitest with `pool: 'forks'` and the repo-wide flock.

## Verification

```bash
flock -w 900 /tmp/vitest.global.lock pnpm --filter @do-epub-studio/reader-core exec vitest run \
  src/__tests__/capability-corpus.test.ts src/__tests__/locator-cfi.test.ts \
  src/__tests__/fixed-layout.test.ts src/__tests__/media-overlay.test.ts
node scripts/check-epub-fixtures.mjs
node src/__tests__/fixtures/generate.mjs && node src/__tests__/fixtures/generate-capabilities.mjs
```

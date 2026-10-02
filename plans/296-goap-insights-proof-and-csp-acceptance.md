# GOAP-296: insights proof + deployment acceptance record (F9, F10)

**Status:** DONE (implemented + verified 2026-09-30)
**Date:** 2026-09-30
**Source:** `analysis/feature-docs-harness-audit.md` F9 (vacuous insights proof) and F10 (deployment verification gap)
**Governance:** ADR-999 (insights remain device-local; no cross-device claim), ADR-214 (evidence beats aspiration)

## F9 — a proof that can fail

- Removed the E2E check in `apps/tests/reader-annotations-and-admin.spec.ts`
  that asserted `expect(insightsVisible || true).toBe(true)` (cannot fail), and
  deleted `apps/tests/reading-insights.spec.ts`, whose four tests asserted only
  that the reader still loads (plus one conditional click with no assertion).
- Same vacuity class, same file: the assistive-tech check now asserts the real
  `role="alert"`-ancestor result (the login error carries `role="alert"`), and
  the offline-indicator check now awaits the offline alert's visibility and
  text instead of `isVisible || true`. Both run green on chromium (17/17).
- Added `apps/web/src/features/reader/components/info/InfoPanel.insights.test.tsx`:
  seeds the device-local insights store at its storage boundary (the IndexedDB
  module owns encryption and is mocked; `reading-insights.test.ts` covers the
  timer→save→compute chain), renders the real `InfoPanel`, and asserts the
  computed metrics for the requested book only ("25 min", "12 pages"; the
  other book's 99s do not leak). A negative case pins that no activity means
  no insights section.
- No API, schema or UI change: the server insights APIs stay for their
  consumers; nothing was deleted for lack of a web caller.

### Observation recorded while replacing the proof (fixed in GOAP-297)

The mocked E2E dev lane never rendered EPUB content. GOAP-297 traced it to a
malformed fixture ZIP (`deflateSync` instead of raw DEFLATE violates ZIP
method 8 — JSZip rejected the archive, so epub.js's `opened` stayed pending
until the loader's 30 s timeout), an unparseable progress CFI
(`epubcfi(/6/4)` throws in @intity/epub-js 0.3.96), broken custom-`epubUrl`
route interception, and an unmocked feedback endpoint adding retry noise.
All four are fixed, the reader now validates/falls back on stored CFIs, and
the previously guarded chapter-navigation spec asserts real rendered text
(27 passed / 7 skipped / 0 failed in the re-run battery).

## F10 — the deployment acceptance requirement is recorded

- `docs/runbooks/infrastructure-setup.md` gained a verification section:
  under the enforced CSP (`connect-src 'self'` + Cloudflare), a deployed
  browser must complete the labelled model download and the ORT wasm fetch;
  when an origin is blocked the panel must report the failure without
  fabricating a finding; any admitted origin is an explicit, reviewed
  `connect-src` change — never loosened ad hoc, never replaced by
  self-hosting multi-gigabyte assets without its own decision.
- No CSP, asset-ownership or hosting change in this slice.

## Verification

- `vitest run src/features/reader/components/info src/features/reader/hooks`:
  75 tests pass (9 in the info directory, including the two new ones).
- The edited `apps/tests/reader-annotations-and-admin.spec.ts` runs green on
  chromium (admin + reader flows unaffected by the removal).
- eslint + prettier clean on every changed file; no production code changed.

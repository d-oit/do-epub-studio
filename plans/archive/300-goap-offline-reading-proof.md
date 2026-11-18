# GOAP-300: Offline reading proof + encrypted signed-file URL cache (A5)

**Status:** DONE
**Date:** 2026-10-02
**Type:** Corrective implementation slice (authorized from the GOAP-298 audit,
finding A5)
**ADRs referenced:** ADR-005 (offline sync), ADR-214 (audit recommendation
governance)
**Source findings:** A5 — "the offline reload test does not prove offline
reading" in `analysis/comprehensive-gap-audit.md`
**Related:** ADR-300 (typecheck scope — sibling number, different topic)

## Goal

Turn the PWA lane's offline-reload scenario into proof of the product promise:
load the fixture online, go offline, reload, and still read the cached chapter
and operate reader controls; reconnect must not lose state. The code paths that
made that possible (a cached signed file URL) must not weaken the online
authorization decision.

## Changes

- **`bookFiles` store (IndexedDB v5)** in `apps/web/src/lib/offline/db.ts`:
  `BookFileEntry { bookId, url, fileId, cachedAt }`, written through
  `saveBookFile` (encrypted at rest under the session key — the URL is a
  time-limited capability), read through `getBookFile`, and included in
  `clearAllEncryptedData` so logout purges it. Header-only plaintext: the URL
  never appears outside `encryptedPayload`.
- **Reader wiring** in `apps/web/src/features/reader/ReaderPage.tsx`: a
  successful `POST /api/books/:id/file-url` caches the URL best-effort (a cache
  write failure never breaks reading); on failure the cached URL is used
  **only when `navigator.onLine` is false**, so an expired or revoked online
  capability still surfaces as an error instead of a stale read.
- **E2E scenario rework** in `apps/tests/offline-reader.spec.ts` (the audit's
  anchor, previously body-visibility only): online fixture load asserting
  `OFFLINE TEST CONTENT`, service-worker control acquired before the offline
  leg, EPUB bytes seeded into `external-assets`, then `context.setOffline(true)`
  and a reload that must still render the chapter with no "Failed to load book"
  surface; reader controls are exercised by keyboard (the offline banner covers
  the toolbar, so pointer interception is not what is under test), and the
  chapter survives reconnect.
- **Docs:** `docs/offline.md` gains the store row and the "Offline reading
  flow (A5, GOAP-300)" section describing the fallback condition and the SW
  cache routes.

## Evidence

- `apps/web/src/__tests__/offline-db.book-files.test.ts` — round-trips the entry
  through encryption (`SYNTHETIC-SIGNED-CAPABILITY` absent from the raw record),
  returns `undefined` for an unknown book, refuses to decrypt under a different
  session key, and is purged by `clearAllEncryptedData`.
- `pnpm --filter @do-epub-studio/web test:unit` — 144 files / 1442 tests green
  (2026-10-02).
- `PLAYWRIGHT_MODE=preview E2E_DEMO_LOGIN=1 pnpm test:e2e
apps/tests/offline-reader.spec.ts --project=pwa-chromium --workers=1` —
  **5 passed** (2026-10-02). This is local browser proof against a preview
  build with controlled API routes, not deployed-Cloudflare acceptance.

## Notes

- The audit authorized nothing on its own; this record documents the executed
  slice for a finding it names, so the `GOAP-300` references in
  `apps/web/src/lib/offline/db.ts`, `apps/web/src/features/reader/ReaderPage.tsx`
  and `docs/offline.md` resolve to a real plan.
- Not covered here: cross-device reading-insights display and the admin
  aggregate surface (the audit's optional opportunities), and A8's retention
  owner — all still open.

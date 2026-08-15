# GOAP-243: Web `as unknown as` Cast Cleanup

**Date:** 2026-08-15
**Status:** 🚧 IN PROGRESS (PR pending)
**Baseline:** `main` @ `5d10ba3` (post GOAP-242, PR #988)
**Related:** plans/241 (worker-side cast cleanup); GOAP-242 (which deferred web-side
casts to a dedicated follow-up)

## Goal

Replace the unchecked `as unknown as` casts in `apps/web/src` with typed,
documented accessors — or delete them when the underlying field is already
typed — and fix the one latent correctness smell (`toArrayBuffer`'s Buffer
handling). The worker-side `as unknown as` casts were already removed in
GOAP-241/242; this closes the same class of finding on the web package.

## Findings and disposition

| Site | Before | Disposition |
| --- | --- | --- |
| `lib/offline/crypto.ts` `toArrayBuffer` | `Buffer.from(bytes) as unknown as ArrayBuffer` (Node branch) | **Fixed.** Unified both branches to `bytes.buffer.slice(offset, offset+len)`. `Buffer.from(bytes).buffer` is the pooled backing store (length ≠ bytes), so the old cast handed callers a wrong-length buffer under Node — a latent `invalid iv length` bug the crypto tests now pin. |
| `lib/offline/crypto.ts` `getWebCrypto` | `webcrypto as unknown as Crypto` | **Retained, documented.** Node's `webcrypto` is typed against its own `CryptoKey`/`KeyUsage` whose `usages` union is stricter than the DOM's (e.g. `'decapsulateBits'`), so a plain `as Crypto` fails typecheck; the cast is a genuine library-type bridge, not a cover-up. Commented. |
| `features/reader/hooks/useReaderEpub.ts` `book.spine`, `book.container`, `rendition.layout.settings`, `rendition._contents` | 3× `book/rendition as unknown as {...}` | **Centralized.** New `features/reader/lib/epub-internals.ts` declares `EpubBookInternals<T>` (`spine`, `container.fullPath`) and `EpubRenditionInternals` (`layout.settings`, `_contents`) — all-optional so a plain `as` cast (no `unknown` hop) typechecks. `book.container.fullPath` is genuinely absent from the installed 0.3.96 `Container` type, so it is not deletable. |
| `features/reader/hooks/useReaderSearch.ts` `book.spine` | `book as unknown as { spine: SpineLike }` | **Centralized** on shared `EpubBookInternals<SpineSection>` (which pins the revision actually installed — the repo resolves `@intity/epub-js@0.3.96`, not 0.3.97). Locally-duplicated `SpineLike` interface removed. |
| `features/reader/components/annotations/AnnotationToolbar.tsx` | `range as unknown as { cfiRange?: string }` then re-cast | **Removed.** `'cfiRange' in range && typeof range.cfiRange === 'string'` narrows natively; no cast. |
| `main.tsx` Background Sync registration | `registration as unknown as { sync?: {...} }` | **Fixed.** Typed intersection `ServiceWorkerRegistration & { sync?: {...} }`. |
| `lib/prefetch-manager.ts` Network Information | `navigator as unknown as { connection?: Connection }` | **Fixed.** `NavigatorWithConnection extends Navigator { connection?: Connection }`. |

## Verification (run)

- `pnpm --filter @do-epub-studio/web exec tsc --noEmit` — clean.
- `pnpm --filter @do-epub-studio/web lint` — clean.
- `pnpm --filter @do-epub-studio/web exec vitest run` — 119 files / 1279 tests pass.
- `pnpm --filter @do-epub-studio/web build` — clean (no new warnings; the two known benign ones from GOAP-241 unchanged).
- `pnpm verify:fast` scoped to web — green in CI.

## Deferred (tracked, not in this PR)

- OwlWatch **MEDIUM**: `useReaderEpub.ts` `initEpub` is ~216 lines. This is
  **pre-existing** (identical span on `main`; this PR's changes to the file are
  type-only and the file is 3 lines shorter than before) and distinct from cast
  cleanup. Splitting reader-initialization wiring is a separate,
  E2E-gated refactor (PR-time CI does not run E2E), so it is deliberately out
  of scope here. Open as a follow-up task.

## Acceptance

- [ ] New PR opened; all CI green (fast-check, quality gate, pre-commit, worker/build, Codacy, CodeQL, Repowise, Lighthouse, Cloudflare Pages).
- [ ] Remaining `as unknown as` occurrences in `apps/web/src` are either removed, typed intersections, or individually documented as unavoidable library bridges.
- [ ] Plan/ADR-INDEX updated; CHANGELOG entry recorded.

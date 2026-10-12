# GOAP-306: Locale chunk failure has an honest, recoverable state (A9)

**Status:** DONE
**Date:** 2026-10-03
**Type:** Corrective implementation slice (authorized from the GOAP-298 audit,
finding A9)
**ADRs referenced:** ADR-214 (audit recommendation governance)
**Source findings:** A9 — "locale chunk rejection has no handled load-error
state" in `analysis/comprehensive-gap-audit.md`

## Goal

A failed locale chunk must not be an unhandled rejection plus a document that
claims a language it never rendered. The audit's observable acceptance: abort the
selected Arabic chunk → no unhandled rejection and no silent claim of fully
Arabic content → after an explicit retry/reselection succeeds, translated
controls and document language/direction agree. The intentional
dictionary-key→English fallback policy stays as it is.

## Changes

- **`i18n/index.ts`**: `ensureLocale` returns `Promise<boolean>` and absorbs a
  rejected dynamic import — it logs `i18n.locale_load_failed` **once per locale
  per document** (every mounted `useTranslation` calls it; an unreported path
  emitted 13 identical warnings) and reports `false`. No caller can produce an
  unhandled rejection, and a later call still retries.
- **`stores/locale.ts`**: the store now separates the _requested_ locale from
  what is rendered — `localeStatus: 'loading' | 'ready' | 'failed'`,
  `failedLocale`, `localeAttempt` (bumped by every `setLocale`, including a
  reselection), plus `reportLocaleLoad(locale, loaded)`. `partialize` persists
  only `locale`, so the stored envelope stays the shape the locale sensor writes
  (A3/GOAP-304); `merge` still rejects unrenderable values.
- **`hooks/useDocumentLocale.ts`**: `lang`/`dir` describe the content actually
  rendered — while a chunk is loading or after it failed the document declares
  `en`, not the pending choice (WCAG 3.1.1 honesty).
- **`hooks/useTranslation.ts`**: returns the **effective** locale (what is
  rendered, `en` while loading/failed) alongside `t`; publishes the load outcome
  to the store; a reselection of a locale that already failed in this document
  triggers a reload, because a failed dynamic import stays rejected for the
  document's lifetime (measured: the second selection issues **no** request —
  the module registry caches the rejection, so only a fresh document can retry).

## Evidence

Unit/integration (`pnpm --filter @do-epub-studio/web test:unit` → 145 files /
1451 tests):

| Case                           | Assertion                                                                                                                           |
| :----------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| Arabic module throws at import | `ensureLocale('ar')` resolves `false`, logs `i18n.locale_load_failed` once, no rejection                                            |
| chunk fails on selection       | store `localeStatus: 'failed'`, hook `locale` stays `en`, `t` keeps English fallback text, requested locale still `ar` in the store |
| reselection after failure      | `window.location.reload` called exactly once and no second in-place import is attempted                                             |
| document honesty               | `localeStatus: 'failed'`/`'loading'` → `html[lang]=en, dir=ltr`; `'ready'` → the locale (`ar` → `rtl`)                              |

Browser acceptance against the built preview (`127.0.0.1:4173/login`, Playwright,
`page.route('**/assets/ar-*.js', route.abort())`):

| Stage                               | `lang` | `dir`   | switcher | first label       | page errors | failure events |
| :---------------------------------- | :----- | :------ | :------- | :---------------- | :---------- | :------------- |
| start                               | en     | ltr     | en       | Email Address     | 0           | 0              |
| Arabic selected, chunk aborted      | **en** | ltr     | **en**   | Email Address     | **0**       | 1              |
| Arabic re-selected, chunk reachable | **ar** | **rtl** | ar       | البريد الإلكتروني | 0           | 1              |

The switcher showing `en` while the Arabic chunk is missing is what makes the
retry reachable at all: a `<select>` fires no `change` event when the user picks
the value it already holds, so a dropdown that displayed the _requested_ locale
would have had no way to re-trigger the load.

## Out of scope

No retry loop, backoff or offline-detection heuristic is introduced, and no new
UI affordance (banner/toast) — the state is honest in the document and the
switcher, and the reload is the recovery. A visible error surface would be a UI
decision of its own.

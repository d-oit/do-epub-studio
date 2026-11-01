# ADR-1018: Reader rendition styling requires inline `<style>` in the Pages CSP

**Date:** 2026-11-01
**Status:** Accepted
**Deciders:** Project maintainer
**Related:** ADR-035, ADR-123, ADR-1014, ADR-1017

## Context

ADR-123 replaced `style-src 'self' 'unsafe-inline'` with
`style-src 'self'; style-src-attr 'unsafe-inline'` on the Cloudflare Pages
surface, on the reasoning that the app's own CSS is compiled by Tailwind/Vite
and that dynamic styling flows through React inline `style={}` attributes.

The EPUB reading engine does not follow that model. It styles book content
exclusively by creating `<style>` elements inside the rendition frame:
`Rendition.adjustImages` appends an `images` stylesheet on every content load,
and the app's reader theme registers body/`img` rules through
`Themes.registerRules` + `select`. Under `style-src 'self'` those elements are
blocked, `HTMLStyleElement.sheet` is `null`, and `Contents.createStyle` throws
`TypeError: Cannot read properties of null (reading 'cssRules')`.

Observed consequences (local Pages, isolated preview, 2026-11-01):

- Font size, line height, font family, theme colours and image constraints
  never applied to reflowable content; the rendition stayed `16px/16px
"Times New Roman"` regardless of the reader's settings.
- Each blocked injection produced an unhandled rejection, which the global
  handler converts into `errors.generic` toasts. The toast container
  (`fixed bottom-4 right-4 z-50`) stacks over the comments panel
  (`fixed inset-y-0 right-0 w-80 z-40`) and intercepted pointer events meant
  for its Edit/Delete/Reply/Resolve actions.

Two scoping strategies were tested and rejected:

- **Route-scoped `_headers`** for `/read/*` emits the relaxed header, but the
  reader is reached by client-side navigation, so the document keeps the CSP
  fetched with the entry route; the enforced policy stayed strict in-page.
- **Blob-URL rendition frames** (`method: 'blobUrl'`) inherit the creator's
  CSP as a local-scheme document, so the same violations occurred (and
  `base-uri 'self'` blocked the engine's base URI).

## Decision

1. Cloudflare Pages serves `style-src 'self' 'unsafe-inline'` together with
   the existing `style-src-attr 'unsafe-inline'`. No external style origin is
   permitted. `script-src` stays `'self' 'wasm-unsafe-eval'` — inline `<style>`
   elements cannot escalate to script execution.
2. The Cloudflare Worker API keeps its stricter CSP (`style-src 'self'`, no
   `style-src-attr`), because its responses are JSON and it serves no styles.
3. `apps/web/src/__tests__/security-posture.test.ts` pins the relaxed
   `style-src` while continuing to assert strict `script-src`, self-hosted
   fonts, and the absence of external style origins. Widening `style-src`
   beyond `'self'`/`'unsafe-inline'`, or adding `'unsafe-inline'` to
   `script-src`, requires a new ADR.
4. The reader theme still re-selects the engine theme on preference changes,
   because `Themes.select()` is a no-op for an already-current theme; the CSP
   change alone would leave the open chapter stale.

## Alternatives considered

- **Route-scoped CSP (Pages `_headers` or middleware):** ineffective for a
  client-side-routed SPA; the reader document is the same document the user
  arrived on.
- **Blob-URL or srcdoc rendition frames:** both inherit the creator's CSP.
- **Inline style attributes only (`Themes.appendRule`/`Contents.css`):** keeps
  ADR-123 intact but cannot express selector rules such as image constraints,
  and requires filtering the engine's `adjustImages` hook out of
  `hooks.content.tasks` — coupling to pinned engine internals for a
  third-party-owned code path.
- **A separate reader document with its own policy:** preserves the strict
  policy elsewhere but changes reader navigation and adds a second boot path.

## Consequences

- The Pages surface re-opens the visual-only inline-style injection lever that
  ADR-123 closed; the script and font restrictions that ADR-123 introduced are
  unchanged and remain tested.
- Reader typography, image constraints and theme colours work again, and the
  repeated stylesheet rejections (and the error toasts they generated) stop.
- Any future move to a CSP nonce/hash strategy must cover engine-injected
  styles, which the current engine cannot attribute.

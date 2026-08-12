# GOAP-229: External-URL Hardening — Sanitizer Host Allowlist + Fetch-Level Egress Guard

**Date:** 2026-08-12
**Status:** ✅ COMPLETED (merged as PR <this PR>)
**Baseline:** `main` @ `4785286` (post GOAP-228, PR #965/966)
**Related:** Plans 212 (`archive/212-…`), 224 (`archive/224-…`), 228; ADR-212, ADR-214; security checklist
**Finding closed:** External-URL blocking was **partial** — scheme allowlist only
(`http/https/mailto` on `use`/`image`/`feImage` `href`), with **no host
allowlist for `http(s)`** and **no fetch-level guard** (MEDIUM hardening item
carried forward from GOAP-224 / GOAP-228).

## What closed

| Layer | Change | Key files |
| --- | --- | --- |
| L1 — Sanitizer host allowlist (default-deny) | `ExternalUrlPolicy` (`block-all` default → `allowlist` with host/subdomain matching) threaded through `sanitizeDom`, `sanitizeEpubDocument`, `createEpubSanitizerHook`, `createSvgSanitizerHook`. Absolute `http(s)` hrefs on linkable elements are stripped unless the host equals an allowlist entry or is a strict subdomain of one. `mailto:`/relative/fragment unchanged. `SANITIZER_POLICY_VERSION` bumped 2→3 (embedded in the per-hook cache key). Host parsing is char-scan/bounded (no regex, mirrors `getScheme`); parse failure = deny. | `packages/reader-core/src/sanitizer.ts`, `packages/reader-core/src/__tests__/sanitizer.test.ts` |
| L2 — Fetch-level egress guard | `buildExternalUrlCsp(policy)` + `createExternalUrlGuardHook(policy)` inject a strict CSP `<meta>` into every rendered chapter: `img/style/font/media/connect-src` default-deny external origins (allowlisted HTTPS origins added only in allowlist mode), plus `object-src 'none'`, `frame-src 'none'`, `base-uri 'none'`, `form-action 'none'`. `'self'`/`blob:`/`data:` keep book-local resources (epubjs blob rewrites) working. Registered in `createEpubLoader.createRendition` and the app's `useReaderEpub` right beside the mandatory sanitizer hook. | `packages/reader-core/src/sanitizer.ts`, `packages/reader-core/src/epub-loader.ts` (`EpubLoaderOptions.externalUrlPolicy`), `apps/web/src/features/reader/hooks/useReaderEpub.ts` |

**Why layered**: the sanitizer strips disallowed external hrefs at
content-ingestion (primary prevention); the CSP is the network-plane backstop
so the browser refuses external subresource fetches even if a URL evades
sanitization. epubjs's own resource loader only serves from the archive zip
(absolute `http(s)` are "not found"), so the real egress surface was the
browser fetching `<img>`/CSS directly inside the sandboxed iframe — which the
CSP now blocks.

## Tests

- `sanitizer.test.ts`: default-deny strips `http(s)` on `use`/`image`/`feImage`;
  allowlist keeps exact host + strict subdomains; strips non-subdomain
  boundary (`example.com.evil.org`), wrong-TLD, and malformed hosts (deny);
  `sanitizeEpubDocument` + both hooks honor `externalUrlPolicy`; `buildExternalUrlCsp`
  block-all/allowlist directive assertions; guard hook injects idempotent CSP
  meta into `<head>`, accepts raw `Document` payload, safe with no head.
- Full suites: reader-core 349/349, web 1268/1268, reader-core lint +
  typecheck, web typecheck — all green.

## Deferred / gated (unchanged — still tracked in living ADRs)

- R1/R12/N3 email gate, S1–S9, O2, P5/P7 — private security triage (ADR-212/214)
- ADR-217 OTel evaluation ADR stands (deferred)
- Book-remote-image opt-in UX: default remains `block-all` (privacy-first);
  an `allowlist` policy can be passed per-book when a trusted host set exists.

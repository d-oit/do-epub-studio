# GOAP-304: locale sensor that can select and verify this app's locale (A3)

**Status:** DONE
**Date:** 2026-10-03
**Type:** Corrective implementation slice (authorized from the GOAP-298 audit,
finding A3)
**ADRs referenced:** ADR-214 (audit recommendation governance), ADR-246
(do-harness completion contract — sensors wrap the same command everywhere)
**Source findings:** A3 — "locale sensor cannot select or verify this app's
locale" in `analysis/comprehensive-gap-audit.md`

## Goal

The audit found the sensor unable to activate this app's locale and unwilling to
fail when it did not: it switched via a query parameter or cookie that
`apps/web/src/stores/locale.ts` never reads, validated only `dir`, and therefore
reported zero findings for a `de` probe that was still English. Deliver an
adapter that drives the real mechanism and a contract that fails loudly when the
requested language did not render.

## Changes

- **Activation through the app's own mechanism** (`switchVia.storageKey`): the
  sensor writes the persisted UI locale this app actually hydrates from —
  `localStorage['do-epub-locale']` in the zustand-persist envelope
  (`{"state":{"locale":"de"},"version":0}`, `stores/locale.ts`) — before loading
  the route, so the store boots into the requested locale. No second
  query/cookie precedence convention was added to the product; the generic
  `param`/`cookie` paths stay for apps that read them.
- **Language contract** (`i18n-locale-not-applied`): every probe — baseline
  included — must render a `html[lang]` whose primary subtag matches the
  requested locale. A probe that renders the wrong language produced no usable
  delta, so it is a finding rather than an OK.
- **CLI**: `WEB_AUDIT_LOCALE_STORAGE_KEY` selects the persisted-state
  activation (precedence: storage key → cookie → `WEB_AUDIT_LOCALE_PARAM`),
  documented in `scripts/i18n-audit.mjs`'s header alongside the new contract.
- **Tests** (`scripts/web-ui/audit.test.mjs`, run by the `web-ui-tests` sensor):
  the envelope is written before the route load and twice per probe
  (`domcontentloaded` → write → `networkidle`); an app that ignores activation
  fails with `i18n-locale-not-applied` for its non-baseline locales (and
  `i18n-direction` too when the locale is RTL); `expectedLanguage` /
  `persistedLocalePayload` unit cases.

## Evidence

Acceptance run against the built app (`pnpm --filter @do-epub-studio/web build`

- `preview` on `127.0.0.1:4173`), command:

```sh
WEB_AUDIT_BASE_URL=http://127.0.0.1:4173 WEB_AUDIT_ROUTES=/login \
WEB_AUDIT_LOCALES=en,de,ar WEB_AUDIT_LOCALE_STORAGE_KEY=do-epub-locale \
node scripts/i18n-audit.mjs
```

→ `OK: no locale-specific regressions on 1 route(s)`, and the document each
probe rendered was captured directly:

| locale | `html[lang]` | `dir` | rendered text (first heading / first label)                            |
| :----- | :----------- | :---- | :--------------------------------------------------------------------- |
| en     | `en`         | `ltr` | “A quiet, considered home for your library.” / “Email Address”         |
| de     | `de`         | `ltr` | “Ein ruhiges, durchdachtes Zuhause für deine Bibl…” / “E-Mail-Adresse” |
| ar     | `ar`         | `rtl` | “موطن هادئ ومدروس لمكتبتك.” / “البريد الإلكتروني”                      |

**Negative control** — the same command with `WEB_AUDIT_LOCALE_STORAGE_KEY=wrong-key`
(the app cannot activate) → **exit 1** with three findings: `i18n-locale-not-applied`
for `de` and `ar`, plus `i18n-direction` for `ar`. That is the audit's required
"an intentionally English document during the de probe reports a
locale-activation/language failure instead of OK".

Unit suite: `node --test scripts/web-ui/audit.test.mjs` → 30 tests, 30 pass.

## Out of scope

The sensor still does not assert _translated text_ beyond the declared language;
a locale whose catalogs are empty but whose `lang` is set would pass. The
audit's acceptance is met as written (language + direction + the per-locale text
probe's own findings), and the evidence above shows real translated text; a
content assertion needs a per-locale key contract the product does not have —
a separate decision.

# ADR-199 — i18n Plural Rules: Deferral

**Status:** Accepted (deferred) — follow-up implemented 2026-08-11 via GOAP-227: plural-category variants for count-bearing keys, resolved by `Intl.PluralRules` through the `pluralize()` helper (structured catalog values; no ICU MessageFormat migration). The full ICU MessageFormat option remains documented below if the plural-key surface grows.
**Date:** 2026-07-29
**Authors:** d-oit
**Related:** Wave 2 i18n hardening (`feat/wave2-i18n-hardening`), GOAP-227 (`plans/227-goap-i18n-plural-rules.md`)

---

## Context

The app supports 13 locales: `en`, `de`, `fr`, `es`, `pt`, `it`, `ja`, `zh`, `ko`, `ar`, `ru`, `hi`, `nl`.

Several of these languages (notably Arabic `ar`, Russian `ru`, and Hindi `hi`) require CLDR plural-category rules beyond the simple `one`/`other` distinction that English uses:

- **Arabic** uses 6 plural categories: zero, one, two, few, many, other.
- **Russian** and related Slavic languages use 4 categories with complex rules based on the last digit/digits.
- **Hindi** treats `0` as plural unlike English.

The current translation catalog format stores plain strings keyed by `TranslationKeys` (e.g., `"relativeTime.minutesAgo": "{{count}} minutes ago"`). It does not support `{count, plural, one{...} other{...}}` ICU MessageFormat syntax or any equivalent plural-aware interpolation.

## Decision

Plural rules support is **deferred** pending a catalog format decision.

### Why defer rather than partially implement

1. **Catalog format is the blocking constraint.** Adding `Intl.PluralRules` to helper code without catalog support produces messages that look grammatically correct in English but remain wrong in Arabic/Russian/Hindi — silent degradation rather than visible failure.

2. **Format migration is a breaking change.** Migrating 13 catalogs (~400 keys total) from raw strings to ICU MessageFormat requires a chosen library (`@formatjs/intl-messageformat`, `i18next`, or a custom resolver), a build-time extraction step, and QA across all locales. This is a dedicated sprint, not an incremental fix.

3. **Current call sites are sparse.** Only relative-time strings (`relativeTime.minutesAgo`, `relativeTime.hoursAgo`, `relativeTime.daysAgo`) pass a `count` parameter today. The surface area is small enough that the quality gap is acceptable as a documented known limitation.

## Consequences

- Arabic, Russian, and Hindi users will see grammatically incorrect count strings (e.g., "3 minutes ago" where Arabic grammar requires a different form). This is a known limitation, not a regression — it was true before Wave 2.
- All locale-aware **date and number formatting** is already correct as of Wave 2 (`apps/web/src/lib/i18n-format.ts` uses `Intl.DateTimeFormat`/`Intl.NumberFormat` with the active locale).
- A follow-up task must be opened before any new locale with non-trivial plural rules is added.

## Follow-up required

Before adding any language that uses more than 2 plural categories, or before
the `ar`/`ru`/`hi` locale share exceeds 5% of active users:

1. ~~Choose a plural-aware message format~~ **Done (GOAP-227, 2026-08-11):**
   structured plural-category values (`{ zero?, one?, two?, few?, many?,
   other }`) in the existing catalogs, resolved via `Intl.PluralRules` through
   `apps/web/src/lib/i18n-format.ts` `pluralize()` and `translate()` in
   `apps/web/src/i18n/index.ts`. ICU MessageFormat via `@formatjs/...` remains
   the fallback option if the plural-key surface outgrows the structured form.
2. ~~Migrate all `count`-bearing catalog keys across all 13 locales~~ **Done
   (GOAP-227):** `comment.replies` + `offline.pendingSync` migrated (also
   fixed a `{{count}}` double-brace bug). Grammar-neutral count keys
   (`relativeTime.*` abbreviated units, `*_with_count` badges) deliberately
   stay as strings — units and parenthetical counts do not inflect.
3. ~~Update `useTranslation` to call the ICU resolver~~ **Done (GOAP-227):**
   `translate()` resolves plural objects with `pluralize()` for the `count`
   param; no dependency added.
4. ~~Add a CI check that rejects new catalog keys containing `{count}` without
   a plural form~~ **Done (GOAP-227):** enforced in the i18n parity test with a
   documented grammar-neutral allowlist.

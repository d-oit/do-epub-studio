/**
 * Locale-pure pluralization helpers (GOAP-227).
 *
 * Kept in their own module — no dependency on the locale store or the i18n
 * loader — so catalogs (`i18n/en.ts`) and `i18n/index.ts` can import them
 * without creating the cycle i18n/… → i18n-format → stores/locale → i18n/…
 * (madge-dead-code check).
 */

/**
 * The plural category strings a locale may produce for a count. Only `other`
 * is required; the rest are optional because not every locale uses them (and
 * even within a locale a particular count may not trigger them). Omitted
 * categories fall back to `other`.
 */
export type PluralCategories = {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
};

/**
 * Pick a locale-aware plural form for a count using `Intl.PluralRules`.
 *
 * The count is classified into a CLDR plural category (`zero`/`one`/`two`/
 * `few`/`many`/`other`) by the given locale, and the corresponding string is
 * returned. If the exact category is not supplied, `other` is used, so this
 * never returns `undefined`. Pass an explicit `locale`; it does not read the
 * locale store.
 */
export function pluralize(
  locale: string,
  count: number,
  categories: PluralCategories,
): string {
  const category = new Intl.PluralRules(locale).select(count);
  return categories[category] ?? categories.other;
}

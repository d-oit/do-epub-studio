import { getCurrentLocale } from '../stores/locale';

/**
 * Locale-aware formatting helpers. These format using the active UI locale
 * (from the locale store) rather than the browser locale, so dates/numbers
 * match the language the user selected in the app.
 *
 * They read the store snapshot at call time. All current call sites live in
 * components that also call `useTranslation()`, so a locale change re-renders
 * them and the next format pick up the new locale.
 */

export function formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(getCurrentLocale(), options ?? { dateStyle: 'medium' }).format(date);
}

export function formatDateTime(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(
    getCurrentLocale(),
    options ?? { dateStyle: 'medium', timeStyle: 'short' },
  ).format(date);
}

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
 * never returns `undefined`. Pass an explicit `locale`; unlike the date/number
 * helpers above it does not read the locale store.
 */
export function pluralize(
  locale: string,
  count: number,
  categories: PluralCategories,
): string {
  const category = new Intl.PluralRules(locale).select(count);
  return categories[category] ?? categories.other;
}

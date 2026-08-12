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

// Plural helpers live in ./i18n-plural (locale-pure, no store/loader imports)
// to keep catalog + loader imports cycle-free; re-export for existing callers.
export { pluralize } from './i18n-plural';

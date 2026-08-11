import { en, type TranslationKeys, type TranslationValue } from './en';
import { pluralize } from '../lib/i18n-plural';

/** Locale key type — union of all supported locale codes. */
export type LocaleKey =
  | 'en'
  | 'de'
  | 'fr'
  | 'es'
  | 'pt'
  | 'it'
  | 'ja'
  | 'zh'
  | 'ko'
  | 'ar'
  | 'ru'
  | 'hi'
  | 'nl';

/** Lazy-loaded dictionaries. Starts with English (the synchronous fallback). */
const loadedDictionaries: Record<string, Record<string, TranslationValue>> = { en };

/**
 * Ensure the given locale dictionary is loaded into memory. Safe to call
 * multiple times — each locale is only fetched once. English is always
 * available synchronously and this is a no-op for `'en'`.
 */
export async function ensureLocale(locale: LocaleKey): Promise<void> {
  if (locale === 'en') return;
  if (loadedDictionaries[locale]) return;
  const mod = await loadLocaleModule(locale);
  if (mod) loadedDictionaries[locale] = mod;
}

async function loadLocaleModule(locale: LocaleKey): Promise<Record<string, TranslationValue> | undefined> {
  switch (locale) {
    case 'de': return (await import('./de')).de;
    case 'fr': return (await import('./fr')).fr;
    case 'es': return (await import('./es')).es;
    case 'pt': return (await import('./pt')).pt;
    case 'it': return (await import('./it')).it;
    case 'ja': return (await import('./ja')).ja;
    case 'zh': return (await import('./zh')).zh;
    case 'ko': return (await import('./ko')).ko;
    case 'ar': return (await import('./ar')).ar;
    case 'ru': return (await import('./ru')).ru;
    case 'hi': return (await import('./hi')).hi;
    case 'nl': return (await import('./nl')).nl;
    default: return undefined;
  }
}

/** Synchronous translate — reads from the already-loaded cache. */
export function translate(
  key: TranslationKeys,
  locale: LocaleKey,
  params?: Record<string, string | number>,
): string {
  const catalog = loadedDictionaries[locale] ?? loadedDictionaries.en;
  const value = catalog[key] ?? loadedDictionaries.en[key] ?? key;
  let template: string;
  if (typeof value === 'string') {
    template = value;
  } else if (params && typeof params.count === 'number') {
    // GOAP-227 (ADR-199 follow-up): plural-aware keys carry CLDR category
    // variants; Intl.PluralRules picks the form for the active locale
    // (ar zero/one/two/few/many, ru one/few/many, hi one/other, ...).
    template = pluralize(locale, params.count, value);
  } else {
    template = value.other;
  }
  if (!params) return template;
  let result = template;
  for (const [paramName, paramValue] of Object.entries(params)) {
    result = result.replaceAll(`{${paramName}}`, String(paramValue));
  }
  return result;
}

/** Format a number using Intl.NumberFormat for the given locale. */
export function formatNumber(
  value: number,
  locale: LocaleKey,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

/** Format a date using Intl.DateTimeFormat for the given locale. */
export function formatDate(
  date: Date,
  locale: LocaleKey,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, options).format(date);
}

export function availableLocales(): Array<{ code: LocaleKey; label: string }> {
  return [
    { code: 'en', label: 'English' },
    { code: 'de', label: 'Deutsch' },
    { code: 'fr', label: 'Fran\u00e7ais' },
    { code: 'es', label: 'Espa\u00f1ol' },
    { code: 'pt', label: 'Portugu\u00eas' },
    { code: 'it', label: 'Italiano' },
    { code: 'ja', label: '\u65e5\u672c\u8a9e' },
    { code: 'zh', label: '\u4e2d\u6587' },
    { code: 'ko', label: '\ud55c\uad6d\uc5b4' },
    { code: 'ar', label: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629' },
    { code: 'ru', label: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439' },
    { code: 'hi', label: '\u0939\u093f\u0928\u094d\u0926\u0940' },
    { code: 'nl', label: 'Nederlands' },
  ];
}

export type { TranslationKeys } from './en';

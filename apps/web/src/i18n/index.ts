import { en, type TranslationKeys } from './en';
import { de } from './de';
import { fr } from './fr';
import { es } from './es';
import { pt } from './pt';
import { it } from './it';
import { ja } from './ja';
import { zh } from './zh';
import { ko } from './ko';
import { ar } from './ar';
import { ru } from './ru';
import { hi } from './hi';
import { nl } from './nl';

export const dictionaries = {
  en,
  de,
  fr,
  es,
  pt,
  it,
  ja,
  zh,
  ko,
  ar,
  ru,
  hi,
  nl,
};

export type LocaleKey = keyof typeof dictionaries;

export function translate(key: TranslationKeys, locale: LocaleKey, params?: Record<string, string | number>): string {
  const catalog = dictionaries[locale] ?? dictionaries.en;
  const template = catalog[key] ?? dictionaries.en[key] ?? key;
  if (!params) return template;
  let result = template;
  for (const [paramName, value] of Object.entries(params)) {
    result = result.replace(`{${paramName}}`, String(value));
  }
  return result;
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

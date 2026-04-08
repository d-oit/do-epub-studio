import { en, type TranslationKeys } from './en';
import { de } from './de';
import { fr } from './fr';

export const dictionaries = {
  en,
  de,
  fr,
};

export type LocaleKey = keyof typeof dictionaries;

export function translate(key: TranslationKeys, locale: LocaleKey): string {
  const catalog = dictionaries[locale] ?? dictionaries.en;
  return catalog[key] ?? dictionaries.en[key] ?? key;
}

export function availableLocales(): Array<{ code: LocaleKey; label: string }> {
  return [
    { code: 'en', label: 'English' },
    { code: 'de', label: 'Deutsch' },
    { code: 'fr', label: 'Français' },
  ];
}

export type { TranslationKeys } from './en';

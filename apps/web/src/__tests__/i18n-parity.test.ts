import { describe, it, expect } from 'vitest';
import { ensureLocale, type LocaleKey } from '../i18n';
import { en } from '../i18n/en';

const localeModules: Record<string, () => Promise<Record<string, Record<string, string>>>> = {
  de: () => import('../i18n/de'),
  fr: () => import('../i18n/fr'),
  es: () => import('../i18n/es'),
  pt: () => import('../i18n/pt'),
  it: () => import('../i18n/it'),
  ja: () => import('../i18n/ja'),
  zh: () => import('../i18n/zh'),
  ko: () => import('../i18n/ko'),
  ar: () => import('../i18n/ar'),
  ru: () => import('../i18n/ru'),
  hi: () => import('../i18n/hi'),
  nl: () => import('../i18n/nl'),
};

const localeNames = Object.keys(localeModules) as LocaleKey[];

async function loadAllLocales(): Promise<Record<string, Record<string, string>>> {
  const result: Record<string, Record<string, string>> = { en };
  for (const name of localeNames) {
    await ensureLocale(name);
    const mod = await localeModules[name]();
    result[name] = mod[name];
  }
  return result;
}

describe('i18n parity', () => {
  let dictionaries: Record<string, Record<string, string>>;

  beforeAll(async () => {
    dictionaries = await loadAllLocales();
  });

  it('has all locale dictionaries defined', () => {
    for (const name of localeNames) {
      expect(dictionaries).toHaveProperty(name);
    }
  });

  it('has the same keys across all locales', () => {
    const enKeys = new Set(Object.keys(dictionaries.en));

    for (const locale of localeNames) {
      const localeKeys = new Set(Object.keys(dictionaries[locale]));
      const missingKeys = [...enKeys].filter((k) => !localeKeys.has(k));
      const extraKeys = [...localeKeys].filter((k) => !enKeys.has(k));

      expect(missingKeys, `Missing keys in ${locale}: ${missingKeys.join(', ')}`).toHaveLength(0);
      expect(extraKeys, `Extra keys in ${locale}: ${extraKeys.join(', ')}`).toHaveLength(0);
    }
  });

  it('has no empty or placeholder translations', () => {
    for (const locale of localeNames) {
      const dict = dictionaries[locale];
      const emptyKeys = Object.entries(dict).filter(
        ([, value]) => !value || value.trim() === '' || value === 'TODO',
      );

      expect(emptyKeys, `Empty/placeholder translations in ${locale}`).toHaveLength(0);
    }
  });

  it('has no untranslated keys (value equals key name)', () => {
    for (const locale of localeNames) {
      const dict = dictionaries[locale];
      const untranslatedKeys = Object.entries(dict).filter(
        ([key, value]) => key === value,
      );

      expect(untranslatedKeys, `Untranslated keys in ${locale}`).toHaveLength(0);
    }
  });
});

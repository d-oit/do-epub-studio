import { describe, it, expect } from 'vitest';
import { ensureLocale, type LocaleKey } from '../i18n';
import { en } from '../i18n/en';
import type { TranslationValue } from '../i18n/en';

const localeModules: Record<string, () => Promise<Record<string, Record<string, TranslationValue>>>> = {
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

async function loadAllLocales(): Promise<Record<string, Record<string, TranslationValue>>> {
  const result: Record<string, Record<string, TranslationValue>> = { en };
  for (const name of localeNames) {
    await ensureLocale(name);
    const mod = await localeModules[name]();
    result[name] = mod[name];
  }
  return result;
}

describe('i18n parity', () => {
  let dictionaries: Record<string, Record<string, TranslationValue>>;

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
      const emptyKeys = Object.entries(dict).filter(([, value]) => {
        if (typeof value === 'string') {
          return !value || value.trim() === '' || value === 'TODO';
        }
        // Plural objects: every variant must be non-empty.
        return Object.values(value).some((v) => v === undefined || v.trim() === '');
      });

      expect(emptyKeys, `Empty/placeholder translations in ${locale}`).toHaveLength(0);
    }
  });

  it('has no untranslated keys (value equals key name)', () => {
    for (const locale of localeNames) {
      const dict = dictionaries[locale];
      const untranslatedKeys = Object.entries(dict).filter(
        ([key, value]) => typeof value === 'string' && key === value,
      );

      expect(untranslatedKeys, `Untranslated keys in ${locale}`).toHaveLength(0);
    }
  });

  it('has matching value shapes across locales (string vs plural object) and `other` always present (GOAP-227)', () => {
    for (const locale of localeNames) {
      const dict = dictionaries[locale];
      for (const key of Object.keys(dictionaries.en)) {
        const enValue = dictionaries.en[key];
        const localeValue = dict[key];
        expect(
          typeof localeValue,
          `Value type mismatch for ${key} in ${locale} (en: ${typeof enValue})`,
        ).toBe(typeof enValue);
        if (typeof localeValue === 'object') {
          expect(
            localeValue.other,
            `Plural key ${key} in ${locale} is missing the required 'other' category`,
          ).toBeTruthy();
        }
      }
    }
  });

  it('rejects new string keys with {count} outside the grammar-neutral allowlist (ADR-199 follow-up item 4)', () => {
    // Grammar-neutral keys legitimately interpolate a count without plural
    // inflection: parenthetical badges and abbreviated relative-time units.
    const COUNT_NEUTRAL_ALLOWLIST = [
      'reader.bookmarks_with_count',
      'annotation.comment_with_count',
      'relativeTime.minutesAgo',
      'relativeTime.hoursAgo',
      'relativeTime.daysAgo',
    ];
    for (const locale of localeNames) {
      const dict = dictionaries[locale];
      for (const [key, value] of Object.entries(dict)) {
        if (typeof value !== 'string') continue;
        if (!value.includes('{count}')) continue;
        expect(
          COUNT_NEUTRAL_ALLOWLIST,
          `${locale}: string key '${key}' contains {count} but is not plural-aware — migrate it to a plural object or add it to the allowlist`,
        ).toContain(key);
      }
    }
  });
});

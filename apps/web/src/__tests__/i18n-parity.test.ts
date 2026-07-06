import { describe, it, expect } from 'vitest';
import { dictionaries, type LocaleKey } from '../i18n';

describe('i18n parity', () => {
  const localeNames = Object.keys(dictionaries) as LocaleKey[];

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
      if (locale === 'en') continue;
      const dict = dictionaries[locale];
      const untranslatedKeys = Object.entries(dict).filter(
        ([key, value]) => key === value,
      );

      expect(untranslatedKeys, `Untranslated keys in ${locale}`).toHaveLength(0);
    }
  });
});

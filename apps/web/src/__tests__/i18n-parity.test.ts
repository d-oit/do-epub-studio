import { describe, it, expect } from 'vitest';
import { dictionaries } from '../i18n';
import { en } from '../i18n/en';
import { de } from '../i18n/de';
import { fr } from '../i18n/fr';

describe('i18n parity', () => {
  const locales = { en, de, fr } as const;
  const localeNames = Object.keys(locales) as (keyof typeof locales)[];

  it('has all locale dictionaries defined', () => {
    expect(dictionaries).toHaveProperty('en');
    expect(dictionaries).toHaveProperty('de');
    expect(dictionaries).toHaveProperty('fr');
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

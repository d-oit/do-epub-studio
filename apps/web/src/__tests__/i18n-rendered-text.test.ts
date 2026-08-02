import { describe, it, expect } from 'vitest';
import { dictionaries, type LocaleKey } from '../i18n';

/**
 * Snapshot test for i18n rendered text drift detection.
 *
 * WHY: Hard-coded E2E assertions break when translations change (e.g., PR #853
 * changed German du→Sie but didn't update E2E tests). This test snapshots
 * critical UI text across all locales. When a translation changes, the
 * snapshot fails — forcing the developer to update both the translation
 * AND any dependent E2E assertions.
 *
 * HOW TO UPDATE: Run `pnpm --filter web test -- --run --update i18n-rendered-text`
 * after intentionally changing translations, then update E2E tests in the same commit.
 */

const CRITICAL_KEYS = [
  'login.subtitle',
  'login.submit',
  'login.emailLabel',
  'login.passwordLabel',
  'admin.createBookModal.title',
  'reader.settings.title',
] as const;

describe('i18n rendered text snapshots', () => {
  const localeNames = Object.keys(dictionaries) as LocaleKey[];

  it('login page critical text matches snapshot', () => {
    const snapshot: Record<string, Record<string, string>> = {};
    for (const locale of localeNames) {
      snapshot[locale] = {};
      for (const key of CRITICAL_KEYS) {
        snapshot[locale][key] = dictionaries[locale][key as keyof typeof dictionaries.en];
      }
    }
    expect(snapshot).toMatchSnapshot();
  });

  it('each locale has unique login.subtitle text', () => {
    const subtitles = localeNames.map((locale) => ({
      locale,
      text: dictionaries[locale]['login.subtitle'],
    }));

    const uniqueTexts = new Set(subtitles.map((s) => s.text));
    expect(uniqueTexts.size).toBe(localeNames.length);
  });
});

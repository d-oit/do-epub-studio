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

type Dict = typeof dictionaries.en;

const CRITICAL_KEYS: (keyof Dict)[] = [
  'login.subtitle',
  'login.submit',
  'login.emailLabel',
  'login.passwordLabel',
  'admin.createBookModal.title',
  'reader.settings.title',
];

const LOCALE_NAMES = Object.keys(dictionaries) as LocaleKey[];

function getSnapshot(): Map<string, Map<string, string>> {
  const snapshot = new Map<string, Map<string, string>>();
  for (const locale of LOCALE_NAMES) {
    const dict = new Map<string, string>();
    for (const key of CRITICAL_KEYS) {
      dict.set(String(key), dictionaries[locale][key]);
    }
    snapshot.set(locale, dict);
  }
  return snapshot;
}

describe('i18n rendered text snapshots', () => {
  it('login page critical text matches snapshot', () => {
    const snapshot = getSnapshot();
    const obj: Record<string, Record<string, string>> = {};
    for (const [locale, dict] of snapshot) {
      obj[locale] = Object.fromEntries(dict);
    }
    expect(obj).toMatchSnapshot();
  });

  it('each locale has unique login.subtitle text', () => {
    const subtitleMap = new Map<string, string>();
    for (const locale of LOCALE_NAMES) {
      subtitleMap.set(locale, dictionaries[locale]['login.subtitle']);
    }
    const uniqueTexts = new Set(subtitleMap.values());
    expect(uniqueTexts.size).toBe(LOCALE_NAMES.length);
  });
});

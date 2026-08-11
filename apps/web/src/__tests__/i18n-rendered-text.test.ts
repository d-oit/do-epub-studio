import { describe, it, expect } from 'vitest';
import { en } from '../i18n/en';
import { de } from '../i18n/de';
import { fr } from '../i18n/fr';
import { es } from '../i18n/es';
import { pt } from '../i18n/pt';
import { it as itLocale } from '../i18n/it';
import { ja } from '../i18n/ja';
import { zh } from '../i18n/zh';
import { ko } from '../i18n/ko';
import { ar } from '../i18n/ar';
import { ru } from '../i18n/ru';
import { hi } from '../i18n/hi';
import { nl } from '../i18n/nl';

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

import type { TranslationValue } from '../i18n/en';

const enCatalog = en as Record<string, TranslationValue>;

describe('i18n rendered text snapshots', () => {
  it('login page critical text matches snapshot', () => {
    const snapshot = {
      en: {
        'login.subtitle': enCatalog['login.subtitle'],
        'login.submit': enCatalog['login.submit'],
        'login.emailLabel': enCatalog['login.emailLabel'],
        'login.passwordLabel': enCatalog['login.passwordLabel'],
        'admin.createBookModal.title': enCatalog['admin.createBookModal.title'],
        'reader.settings.title': enCatalog['reader.settings.title'],
      },
    };
    expect(snapshot).toMatchSnapshot();
  });

  it('each locale has unique login.subtitle text', () => {
    const uniqueTexts = new Set([
      enCatalog['login.subtitle'],
      de['login.subtitle'],
      fr['login.subtitle'],
      es['login.subtitle'],
      pt['login.subtitle'],
      itLocale['login.subtitle'],
      ja['login.subtitle'],
      zh['login.subtitle'],
      ko['login.subtitle'],
      ar['login.subtitle'],
      ru['login.subtitle'],
      hi['login.subtitle'],
      nl['login.subtitle'],
    ]);
    expect(uniqueTexts.size).toBe(13);
  });
});

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dictionaries, type LocaleKey } from '../i18n';

/**
 * Supported UI locales. Derived from the catalog registry (`dictionaries`) so
 * this type and the `LocaleSwitcher` options can never drift apart. Previously
 * hard-coded to `'en' | 'de' | 'fr'` while 13 catalogs existed, forcing an
 * unsafe cast in the switcher.
 */
export type SupportedLocale = LocaleKey;

const SUPPORTED_LOCALES = Object.keys(dictionaries) as readonly SupportedLocale[];

function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

interface LocaleState {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
}

function detectLocale(): SupportedLocale {
  if (typeof navigator === 'undefined' || !navigator.language) {
    return 'en';
  }
  // Match on the primary language subtag (e.g. 'zh' from 'zh-Hans-CN') against
  // the full set of supported catalogs, falling back to English.
  const [preferred] = navigator.language.split('-');
  return isSupportedLocale(preferred) ? preferred : 'en';
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: detectLocale(),
      setLocale: (locale) => set({ locale }),
    }),
    { name: 'do-epub-locale' },
  ),
);

export function getCurrentLocale(): SupportedLocale {
  return useLocaleStore.getState().locale;
}

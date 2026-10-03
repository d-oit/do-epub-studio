import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { availableLocales, type LocaleKey } from '../i18n';

/**
 * Supported UI locales. Derived from `availableLocales()` so this type and the
 * `LocaleSwitcher` options can never drift apart.
 */
export type SupportedLocale = LocaleKey;

const SUPPORTED_LOCALES = availableLocales().map((l) => l.code) as readonly SupportedLocale[];

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
  return preferred && isSupportedLocale(preferred) ? preferred : 'en';
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: detectLocale(),
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: 'do-epub-locale',
      // A persisted value this build cannot render must never become the active
      // locale: `useDocumentLocale` writes it into `html[lang]`, so a stale or
      // regional tag (`de-DE`) would declare a language whose every lookup falls
      // back to English — the app asserting something untrue about its content
      // (A3/GOAP-304). Unsupported values fall back to the detected locale.
      merge: (persisted, current) => {
        const stored = (persisted as { locale?: unknown } | undefined)?.locale;
        return {
          ...current,
          locale: typeof stored === 'string' && isSupportedLocale(stored) ? stored : current.locale,
        };
      },
    },
  ),
);

export function getCurrentLocale(): SupportedLocale {
  return useLocaleStore.getState().locale;
}

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SupportedLocale = 'en' | 'de' | 'fr';

interface LocaleState {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
}

function detectLocale(): SupportedLocale {
  if (typeof navigator === 'undefined' || !navigator.language) {
    return 'en';
  }
  const [preferred] = navigator.language.split('-');
  if (preferred === 'de' || preferred === 'fr') {
    return preferred;
  }
  return 'en';
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

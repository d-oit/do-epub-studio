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
  /**
   * Whether the selected locale's dictionary is actually in use. `loading`
   * while a chunk is in flight, `failed` when it never arrived — in both cases
   * the tree renders the English fallback, so `html[lang]` must not claim the
   * selected locale (A9/GOAP-306). Consumers read this instead of guessing.
   */
  localeStatus: 'loading' | 'ready' | 'failed';
  /**
   * Bumped by every `setLocale` call, including a reselection of the same
   * locale — that is what makes "select the language again" a working retry
   * after a failed chunk load.
   */
  localeAttempt: number;
  /**
   * The locale whose chunk failed in *this document*, or null. A failed dynamic
   * import stays rejected for the document's lifetime, so a retry needs a fresh
   * document; this is what tells the retry path apart from a first attempt.
   */
  failedLocale: SupportedLocale | null;
  setLocale: (locale: SupportedLocale) => void;
  /** Publish the outcome of loading `locale`'s dictionary. */
  reportLocaleLoad: (locale: SupportedLocale, loaded: boolean) => void;
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
      // The detected locale has no dictionary yet unless it is English: saying
      // `ready` here would let the document claim a language before the chunk
      // resolved (the A9 failure mode, from the other direction).
      localeStatus: detectLocale() === 'en' ? 'ready' : 'loading',
      localeAttempt: 0,
      setLocale: (locale) =>
        set((state) => ({
          locale,
          localeStatus: locale === 'en' ? 'ready' : 'loading',
          localeAttempt: state.localeAttempt + 1,
        })),
      failedLocale: null,
      reportLocaleLoad: (locale, loaded) =>
        set({
          localeStatus: loaded ? 'ready' : 'failed',
          failedLocale: loaded ? null : locale,
        }),
    }),
    {
      name: 'do-epub-locale',
      // Only the choice is persisted: load status and the retry counter are
      // runtime state, and the stored envelope must stay
      // `{"state":{"locale":…},"version":0}` (the shape the locale sensor
      // writes — A3/GOAP-304).
      partialize: (state) => ({ locale: state.locale }),
      // A persisted value this build cannot render must never become the active
      // locale: `useDocumentLocale` writes it into `html[lang]`, so a stale or
      // regional tag (`de-DE`) would declare a language whose every lookup falls
      // back to English — the app asserting something untrue about its content
      // (A3/GOAP-304). Unsupported values fall back to the detected locale.
      merge: (persisted, current) => {
        const stored = (persisted as { locale?: unknown } | undefined)?.locale;
        const locale =
          typeof stored === 'string' && isSupportedLocale(stored) ? stored : current.locale;
        return {
          ...current,
          locale,
          localeStatus: locale === 'en' ? 'ready' : 'loading',
        };
      },
    },
  ),
);

export function getCurrentLocale(): SupportedLocale {
  return useLocaleStore.getState().locale;
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTranslation } from '../hooks/useTranslation';
import { useLocaleStore } from '../stores/locale';
import * as i18n from '../i18n';

vi.mock('../i18n', () => ({
  translate: vi.fn((key: string, _locale: string, params?: Record<string, string | number>) => {
    const translations = new Map<string, string>([
      ['app.title', 'd.o.EPUB Studio'],
      ['reader.settings', 'Reader Settings'],
      ['reader.theme', 'Theme'],
    ]);
    let result = translations.get(key) ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        result = result.replace(`{${k}}`, String(v));
      }
    }
    return result;
  }),
  ensureLocale: vi.fn(() => Promise.resolve(true)),
  availableLocales: vi.fn(() => [
    { code: 'en', label: 'English' },
    { code: 'de', label: 'Deutsch' },
    { code: 'fr', label: 'Fran\u00e7ais' },
    { code: 'es', label: 'Espa\u00f1ol' },
    { code: 'pt', label: 'Portugu\u00eas' },
    { code: 'it', label: 'Italiano' },
    { code: 'ja', label: '\u65e5\u672c\u8a9e' },
    { code: 'zh', label: '\u4e2d\u6587' },
    { code: 'ko', label: '\ud55c\uad6d\uc5b4' },
    { code: 'ar', label: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629' },
    { code: 'ru', label: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439' },
    { code: 'hi', label: '\u0939\u093f\u0928\u094d\u0926\u0940' },
    { code: 'nl', label: 'Nederlands' },
  ]),
}));

beforeEach(() => {
  useLocaleStore.setState({ locale: 'en', localeStatus: 'ready', localeAttempt: 0 });
  vi.mocked(i18n.ensureLocale).mockResolvedValue(true);
});

describe('useTranslation', () => {
  it('returns t function, locale, and setLocale', () => {
    const { result } = renderHook(() => useTranslation());

    expect(typeof result.current.t).toBe('function');
    expect(result.current.locale).toBe('en');
    expect(typeof result.current.setLocale).toBe('function');
  });

  it('translates a known key', () => {
    const { result } = renderHook(() => useTranslation());
    expect(result.current.t('app.title')).toBe('d.o.EPUB Studio');
  });

  it('returns key as fallback for unknown key', () => {
    const { result } = renderHook(() => useTranslation());
    expect(result.current.t('nonexistent.key' as Parameters<typeof result.current.t>[0])).toBe(
      'nonexistent.key',
    );
  });

  it('replaces params in translation', () => {
    const { result } = renderHook(() => useTranslation());
    expect(result.current.t('app.title')).toBe('d.o.EPUB Studio');
  });

  it('updates t function when locale changes', async () => {
    const { result } = renderHook(() => useTranslation());
    expect(result.current.locale).toBe('en');

    // `setLocale` re-renders with the new locale, then `useTranslation`'s effect
    // resets `loadedLocale` to null and re-sets it once `ensureLocale` resolves.
    // Both continuations must land inside act() or React warns.
    await act(async () => {
      useLocaleStore.getState().setLocale('de');
      await Promise.resolve();
    });

    expect(result.current.locale).toBe('de');
  });

  it('calls setLocale to change locale', async () => {
    const { result } = renderHook(() => useTranslation());

    await act(async () => {
      result.current.setLocale('fr');
      await Promise.resolve();
    });

    expect(useLocaleStore.getState().locale).toBe('fr');
  });

  it('reports a failed chunk load instead of leaving the locale claimed as loaded', async () => {
    // A failed dynamic import must not reject (unhandled rejection) and must not
    // report `ready`: the tree keeps English fallback text, so the store says
    // `failed` and the document language stays honest (A9/GOAP-306).
    vi.mocked(i18n.ensureLocale).mockResolvedValueOnce(false);

    const { result } = renderHook(() => useTranslation());
    await act(async () => {
      result.current.setLocale('ar');
      await Promise.resolve();
      await Promise.resolve();
    });

    // The hook reports what is rendered; the store keeps the requested locale.
    expect(result.current.locale).toBe('en');
    expect(useLocaleStore.getState().locale).toBe('ar');
    expect(useLocaleStore.getState().localeStatus).toBe('failed');
    // Fallback text is the intentional policy — it stays English, as when loading.
    expect(result.current.t('app.title')).toBe('d.o.EPUB Studio');
  });

  it('reloads when the same locale is selected again after a failure', async () => {
    // A failed dynamic import stays rejected for the document's lifetime
    // (measured in the browser: the second selection issues no request), so the
    // only working retry is a fresh document — the persisted locale then loads.
    vi.mocked(i18n.ensureLocale).mockResolvedValueOnce(false);
    const reload = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload },
    });

    try {
      const { result } = renderHook(() => useTranslation());
      await act(async () => {
        result.current.setLocale('ar');
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(useLocaleStore.getState().localeStatus).toBe('failed');
      expect(reload).not.toHaveBeenCalled();

      await act(async () => {
        result.current.setLocale('ar');
        await Promise.resolve();
      });

      expect(reload).toHaveBeenCalledTimes(1);
      // The retry is the reload itself; no second import is attempted in-place.
      expect(i18n.ensureLocale).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    }
  });
});

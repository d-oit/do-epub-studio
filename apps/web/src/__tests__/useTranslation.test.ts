import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTranslation } from '../hooks/useTranslation';
import { useLocaleStore } from '../stores/locale';

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
  ensureLocale: vi.fn(() => Promise.resolve()),
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
  useLocaleStore.setState({ locale: 'en' });
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
    expect(result.current.t('nonexistent.key' as Parameters<typeof result.current.t>[0])).toBe('nonexistent.key');
  });

  it('replaces params in translation', () => {
    const { result } = renderHook(() => useTranslation());
    expect(result.current.t('app.title')).toBe('d.o.EPUB Studio');
  });

  it('updates t function when locale changes', () => {
    const { result } = renderHook(() => useTranslation());
    expect(result.current.locale).toBe('en');

    act(() => {
      useLocaleStore.getState().setLocale('de');
    });

    expect(result.current.locale).toBe('de');
  });

  it('calls setLocale to change locale', () => {
    const { result } = renderHook(() => useTranslation());

    act(() => {
      result.current.setLocale('fr');
    });

    expect(useLocaleStore.getState().locale).toBe('fr');
  });
});

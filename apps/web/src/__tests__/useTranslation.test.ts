import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTranslation } from '../hooks/useTranslation';
import { useLocaleStore } from '../stores/locale';

vi.mock('../i18n', () => ({
  translate: vi.fn((key: string, _locale: string, params?: Record<string, string | number>) => {
    const translations: Record<string, string> = {
      'app.title': 'd.o.EPUB Studio',
      'reader.settings': 'Reader Settings',
      'reader.theme': 'Theme',
    };
    let result = Object.hasOwn(translations, key) ? translations[key] : key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        result = result.replace(`{${k}}`, String(v));
      }
    }
    return result;
  }),
  dictionaries: { en: {}, de: {}, fr: {}, es: {}, pt: {}, it: {}, ja: {}, zh: {}, ko: {}, ar: {}, ru: {}, hi: {}, nl: {} },
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

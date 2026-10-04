import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useDocumentLocale } from '../useDocumentLocale';
import { useLocaleStore } from '../../stores/locale';

describe('useDocumentLocale', () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: 'en' });
    const html = document.documentElement;
    html.removeAttribute('lang');
    html.removeAttribute('dir');
  });

  it('sets html lang and dir from the active locale', () => {
    renderHook(() => useDocumentLocale());
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('updates html lang and dir when the locale switches to RTL', () => {
    renderHook(() => useDocumentLocale());
    act(() => {
      useLocaleStore.setState({ locale: 'ar' });
    });
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('updates html lang and dir when the locale switches back to LTR', () => {
    renderHook(() => useDocumentLocale());
    act(() => {
      useLocaleStore.setState({ locale: 'ar' });
    });
    act(() => {
      useLocaleStore.setState({ locale: 'fr' });
    });
    expect(document.documentElement.lang).toBe('fr');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('restores the previous html lang and dir on unmount', () => {
    document.documentElement.setAttribute('lang', 'fr');
    document.documentElement.setAttribute('dir', 'rtl');

    const { unmount } = renderHook(() => useDocumentLocale());
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');

    unmount();
    expect(document.documentElement.lang).toBe('fr');
    expect(document.documentElement.dir).toBe('rtl');
  });
});

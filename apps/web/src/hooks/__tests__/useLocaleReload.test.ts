/**
 * A9/GOAP-306 (review follow-up) — the retry reload has exactly one owner.
 *
 * `useTranslation` used to reload whenever `failedLocale === locale`, so a
 * consumer that mounted *after* the failure reloaded on its own and every
 * mounted consumer reloaded once per retry. The retry signal now lives in the
 * store (set only by an explicit reselection of the failed locale) and this
 * single hook performs it.
 */
import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocaleReload } from '../useLocaleReload';
import { useTranslation } from '../useTranslation';
import { useLocaleStore } from '../../stores/locale';
import * as i18n from '../../i18n';
import type * as I18nModule from '../../i18n';

// Keep the real translate/availableLocales; drive only the loader.
vi.mock('../../i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof I18nModule>();
  return { ...actual, ensureLocale: vi.fn() };
});

const reload = vi.fn();

function stubReload(): () => void {
  const originalLocation = window.location;
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, reload },
  });
  return () => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  };
}

describe('useLocaleReload', () => {
  beforeEach(() => {
    reload.mockClear();
    useLocaleStore.setState({
      locale: 'en',
      localeStatus: 'ready',
      localeAttempt: 0,
      failedLocale: null,
      reloadRequested: false,
    });
    vi.mocked(i18n.ensureLocale).mockResolvedValue(false);
  });

  it('reloads once for an explicit retry, with several consumers mounted', async () => {
    const restore = stubReload();
    try {
      const reloadOwner = renderHook(() => useLocaleReload());
      const first = renderHook(() => useTranslation());
      const second = renderHook(() => useTranslation());

      await act(async () => {
        first.result.current.setLocale('ar');
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(useLocaleStore.getState().localeStatus).toBe('failed');
      expect(reload).not.toHaveBeenCalled();

      // Explicit retry: reselect the locale that failed.
      await act(async () => {
        second.result.current.setLocale('ar');
        await Promise.resolve();
      });

      expect(reload).toHaveBeenCalledTimes(1);
      reloadOwner.unmount();
    } finally {
      restore();
    }
  });

  it('does not reload for a first selection or another locale', async () => {
    const restore = stubReload();
    try {
      renderHook(() => useLocaleReload());
      const consumer = renderHook(() => useTranslation());

      await act(async () => {
        consumer.result.current.setLocale('ar');
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(reload).not.toHaveBeenCalled();

      await act(async () => {
        consumer.result.current.setLocale('de');
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(reload).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });
});

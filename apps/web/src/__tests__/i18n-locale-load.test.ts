/**
 * A9/GOAP-306 — a locale chunk that fails to load must be an explicit state,
 * not an unhandled rejection plus a document that claims a language it never
 * rendered.
 *
 * The Arabic module is mocked to throw at import time, which is what a failed
 * chunk fetch looks like to `ensureLocale`.
 */
import { describe, expect, it, vi } from 'vitest';

const { logClientEventMock } = vi.hoisted(() => ({ logClientEventMock: vi.fn() }));

vi.mock('../lib/client-logger', () => ({ logClientEvent: logClientEventMock }));
vi.mock('../i18n/ar', () => {
  throw new Error('Failed to fetch dynamically imported module: ar');
});

import { ensureLocale, translate } from '../i18n';

describe('ensureLocale failure handling (A9/GOAP-306)', () => {
  it('reports a failed chunk load as false and logs the event', async () => {
    logClientEventMock.mockClear();

    await expect(ensureLocale('ar')).resolves.toBe(false);

    expect(logClientEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'warn',
        event: 'i18n.locale_load_failed',
        metadata: { locale: 'ar' },
      }),
    );
  });

  it('keeps the intentional English dictionary-key fallback intact', () => {
    // The fallback policy is unchanged: an unloaded locale resolves keys through
    // English, which is what the UI renders while the state is `failed`.
    expect(translate('app.title', 'ar')).toBe(translate('app.title', 'en'));
  });

  it('is a no-op for the synchronous English dictionary', async () => {
    await expect(ensureLocale('en')).resolves.toBe(true);
  });
});

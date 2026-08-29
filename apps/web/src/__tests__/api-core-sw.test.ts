import { describe, it, expect, vi, afterEach } from 'vitest';

/**
 * Regression: the production service worker (src/sw.ts) dynamically imports
 * lib/offline/sync on background 'sync' events, which pulls lib/api/core.ts
 * into the SW chunk. In that context window/self are undefined, so the
 * module-level origin lookup in API_BASE_URL must not throw.
 */
describe('api/core API_BASE_URL (service-worker context)', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalSelf = Object.getOwnPropertyDescriptor(globalThis, 'self');

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    if (originalSelf) Object.defineProperty(globalThis, 'self', originalSelf);
  });

  it('does not throw and yields a relative base when window and self are undefined', async () => {
    Object.defineProperty(globalThis, 'window', { value: undefined, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'self', { value: undefined, configurable: true, writable: true });
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.stubEnv('PROD', true);
    // test-setup.ts's beforeEach imports lib/data-cache -> lib/api -> core at
    // setup time, so core.ts is already evaluated (cached) with window alive
    // before this test body runs. Clear the registry so the import below
    // re-evaluates the module under the stubbed globals.
    vi.resetModules();
    const { API_BASE_URL } = await import('../lib/api/core');
    expect(API_BASE_URL).toBe('');
  });
});

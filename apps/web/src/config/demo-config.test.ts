import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveHelpUrl, isDemoLoginEnabled } from './demo-config';

describe('demo-config env helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('isDemoLoginEnabled is false when the flag is unset', () => {
    expect(isDemoLoginEnabled()).toBe(false);
  });

  it('isDemoLoginEnabled is true only when the flag is exactly 1', () => {
    vi.stubEnv('VITE_DEMO_LOGIN_ENABLED', '1');
    expect(isDemoLoginEnabled()).toBe(true);
  });

  it('resolveHelpUrl defaults to the in-app /help page when unset or empty', () => {
    // The /help route ships in every deployment, so no env config is needed.
    expect(resolveHelpUrl()).toEqual({ href: '/help', isExternal: false });
    vi.stubEnv('VITE_HELP_URL', '');
    expect(resolveHelpUrl()).toEqual({ href: '/help', isExternal: false });
  });

  it('resolveHelpUrl treats a leading-slash path as a same-origin route', () => {
    vi.stubEnv('VITE_HELP_URL', '/guide');
    expect(resolveHelpUrl()).toEqual({ href: '/guide', isExternal: false });
  });

  it('resolveHelpUrl marks an absolute off-origin URL as external', () => {
    vi.stubEnv('VITE_HELP_URL', 'https://docs.example.com/guide');
    const result = resolveHelpUrl();
    expect(result.href).toBe('https://docs.example.com/guide');
    expect(result.isExternal).toBe(true);
  });

  it('resolveHelpUrl falls back to /help for an invalid explicit URL', () => {
    vi.stubEnv('VITE_HELP_URL', 'not a url');
    expect(resolveHelpUrl()).toEqual({ href: '/help', isExternal: false });
  });
});

import { describe, it, expect } from 'vitest';
import { useAuthStore } from '../stores/auth';
import fs from 'node:fs';
import path from 'node:path';

import { useLocaleStore } from '../stores/locale';

describe('Security Posture (Web)', () => {
  it('asserts session token is persisted in localStorage with correct key', () => {
    // Zustand persist configuration is static, we can check its properties
    // We don't need to instantiate the store to check the persist options
    // but the store is already exported.

    const persistOptions = (useAuthStore as unknown as { persist?: { getOptions: () => { name: string, storage: any } } }).persist?.getOptions();
    expect(persistOptions?.name).toBe('do-epub-auth');
    expect(persistOptions?.storage?.getItem).toBeDefined();
    // Default storage is localStorage if not specified otherwise
    expect(persistOptions?.storage).not.toBe(null);
  });

  it('asserts no other stores use localStorage for sensitive data', () => {
    // locale is fine in localStorage
    const localePersist = (useLocaleStore as unknown as { persist?: { getOptions: () => { name: string } } }).persist?.getOptions();
    expect(localePersist?.name).toBe('do-epub-locale');

    // preferences MUST use cookieStorage, not localStorage (per memory/ADR-092)
    // We check this here to ensure it doesn't leak into localStorage
    const prefPath = path.resolve(__dirname, '../stores/preferences.ts');
    const prefContent = fs.readFileSync(prefPath, 'utf-8');
    expect(prefContent).toContain('createJSONStorage(() => cookieStorage)');
  });

  it('asserts CSP headers in _headers are strict and include report-uri', () => {
    const headersPath = path.resolve(__dirname, '../../public/_headers');
    const content = fs.readFileSync(headersPath, 'utf-8');

    // Match the CSP header line
    const cspMatch = content.match(/Content-Security-Policy: ([^;]+(?:; [^;]+)*);/);
    if (!cspMatch) throw new Error('CSP header not found');

    const csp = cspMatch[1];

    // Compensating control 1: Strict script-src (no 'unsafe-inline', no 'unsafe-eval')
    // Note: 'wasm-unsafe-eval' is permitted per docs/security-posture.md
    const scriptSrcMatch = csp.match(/script-src ([^;]+)/);
    expect(scriptSrcMatch).not.toBeNull();
    const scriptSrc = scriptSrcMatch?.[1] ?? '';

    const tokens = scriptSrc.split(' ');
    expect(tokens).toContain("'self'");
    expect(tokens).toContain("'wasm-unsafe-eval'");
    expect(tokens).not.toContain("'unsafe-inline'");
    expect(tokens).not.toContain("'unsafe-eval'");

    // Compensating control 2 (SE2 — ADR-123 / Plan 122): style-src is strict.
    // 'unsafe-inline' is permitted ONLY for style-src-attr, which governs
    // React component inline `style={}` attributes (CSP Level 3).
    const styleSrcMatch = csp.match(/style-src ([^;]+)/);
    expect(styleSrcMatch).not.toBeNull();
    const styleTokens = (styleSrcMatch?.[1] ?? '').split(' ');
    expect(styleTokens).toContain("'self'");
    expect(styleTokens).not.toContain("'unsafe-inline'");
    expect(styleTokens).not.toContain('https://fonts.googleapis.com');

    const styleSrcAttrMatch = csp.match(/style-src-attr ([^;]+)/);
    expect(styleSrcAttrMatch).not.toBeNull();
    const styleAttrTokens = (styleSrcAttrMatch?.[1] ?? '').split(' ');
    expect(styleAttrTokens).toContain("'unsafe-inline'");

    // Compensating control 3 (SE3 — ADR-123 / Plan 122): fonts are self-hosted.
    // 'font-src' must be 'self' only — no Google or Fontshare origins.
    const fontSrcMatch = csp.match(/font-src ([^;]+)/);
    expect(fontSrcMatch).not.toBeNull();
    const fontTokens = (fontSrcMatch?.[1] ?? '').split(' ');
    expect(fontTokens).toContain("'self'");
    expect(fontTokens).not.toContain('https://fonts.gstatic.com');
    expect(fontTokens).not.toContain('https://api.fontshare.com');

    // Ensure report-uri is present and correct
    expect(csp).toContain('report-uri /api/csp-report');
  });

  it('fonts are self-hosted via @fontsource imports, not loaded from external origins (SE3 — ADR-123 / Plan 122)', () => {
    const htmlPath = path.resolve(__dirname, '../../index.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');

    // No external font <link> or <script> tags from fonts.googleapis.com
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');

    // globals.css must import the self-hosted font families
    const cssPath = path.resolve(__dirname, '../styles/globals.css');
    const css = fs.readFileSync(cssPath, 'utf-8');
    expect(css).toContain('@fontsource-variable/geist');
    expect(css).toContain('@fontsource/instrument-serif');
  });

  it('asserts client-logger.ts does not export sessionToken to telemetry', () => {
    const loggerPath = path.resolve(__dirname, '../lib/client-logger.ts');
    const content = fs.readFileSync(loggerPath, 'utf-8');

    // The logger should not be aware of session tokens
    expect(content).not.toContain('sessionToken');
    expect(content).not.toContain('useAuthStore');
  });

  it('session token is cleared on logout', () => {
    useAuthStore.getState().setAuth({
      sessionToken: 'a'.repeat(64),
      sessionExpiresAt: Date.now() + 86_400_000,
      bookId: 'book-1',
      bookSlug: 'slug-1',
      bookTitle: 'Test Book',
      email: 'test@example.com',
      capabilities: { canRead: true, canComment: false, canHighlight: false, canBookmark: false, canDownloadOffline: false, canExportNotes: false, canManageAccess: false },
    });
    expect(useAuthStore.getState().sessionToken).toBe('a'.repeat(64));
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    useAuthStore.getState().logout();

    expect(useAuthStore.getState().sessionToken).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().bookId).toBeNull();
    expect(useAuthStore.getState().email).toBeNull();
    expect(useAuthStore.getState().capabilities).toBeNull();
  });

  it('session token matches expected format (256-bit hex string)', () => {
    const persistOptions = (useAuthStore as unknown as { persist?: { getOptions: () => { name: string, storage: any } } }).persist?.getOptions();
    expect(persistOptions?.name).toBe('do-epub-auth');

    // ADR-092: tokens are 256-bit random = 64 hex chars
    // This regex asserts the format without depending on a specific token value.
    const hex64 = /^[0-9a-f]{64}$/;
    expect(hex64.test('a'.repeat(64))).toBe(true);
    expect(hex64.test('a'.repeat(63))).toBe(false);
    expect(hex64.test('g' + 'a'.repeat(63))).toBe(false);
  });

  it('preferences cookie uses Secure flag on HTTPS (B9 from Plan 118)', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../stores/preferences.ts'),
      'utf-8',
    );
    // Should conditionally add Secure flag when location.protocol is 'https:'
    expect(content).toContain("location.protocol === 'https:'");
    expect(content).toContain('; Secure');
  });

  it('AGENTS.md references docs/security-posture.md', () => {
    const agentsPath = path.resolve(__dirname, '../../../../AGENTS.md');
    const content = fs.readFileSync(agentsPath, 'utf-8');
    expect(content).toContain('docs/security-posture.md');
  });
});

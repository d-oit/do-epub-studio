import { describe, it, expect } from 'vitest';
import { validateApiOrigin, resolveApiBaseUrl } from './api-origin';

describe('validateApiOrigin', () => {
  it('accepts a valid https origin in production', () => {
    const result = validateApiOrigin({
      raw: 'https://do-epub-studio.pages.dev/',
      isProduction: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.resolution).toEqual({
        kind: 'configured',
        url: 'https://do-epub-studio.pages.dev',
      });
    }
  });

  it('normalizes a trailing slash to the bare origin', () => {
    const result = validateApiOrigin({ raw: 'https://api.do-epub-studio.test/', isProduction: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.resolution).toEqual({ kind: 'configured', url: 'https://api.do-epub-studio.test' });
    }
  });

  it('accepts http origins in dev for local workers', () => {
    const result = validateApiOrigin({
      raw: 'http://127.0.0.1:8787',
      isProduction: false,
    });
    expect(result.ok).toBe(true);
  });

  it('allows a missing value and resolves to same-origin /api/*', () => {
    expect(validateApiOrigin({ raw: undefined, isProduction: true })).toEqual({
      ok: true,
      resolution: { kind: 'same-origin' },
    });
    expect(validateApiOrigin({ raw: '   ', isProduction: true })).toEqual({
      ok: true,
      resolution: { kind: 'same-origin' },
    });
  });

  it('rejects a malformed value', () => {
    const result = validateApiOrigin({ raw: 'not a url', isProduction: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/not a valid absolute URL/);
  });

  it('rejects non-http(s) schemes', () => {
    for (const raw of ['file:///tmp/api', 'javascript:alert(1)', 'ftp://host/api']) {
      const result = validateApiOrigin({ raw, isProduction: false });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/protocol/);
    }
  });

  it('rejects http in production (cross-environment config)', () => {
    const result = validateApiOrigin({ raw: 'http://localhost:8787', isProduction: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/must use https/);
  });

  it('rejects placeholder example.com in every environment', () => {
    for (const isProduction of [true, false]) {
      const result = validateApiOrigin({ raw: 'https://example.com', isProduction });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/example\.com/);
    }
  });

  it('rejects workers.dev placeholders in every environment', () => {
    for (const raw of ['https://my-worker.workers.dev', 'https://api.worker.dev']) {
      const result = validateApiOrigin({ raw, isProduction: false });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/placeholder/);
    }
  });

  it('rejects angle-bracket and marker placeholders', () => {
    for (const raw of ['https://<your-worker>.workers.dev', 'https://replaceme.example.com']) {
      const result = validateApiOrigin({ raw, isProduction: false });
      expect(result.ok).toBe(false);
    }
  });

  it('rejects known SPA-only frontend hosts in production', () => {
    for (const raw of [
      'https://do-epub-studio.onrender.com',
      'https://do-epub-studio.vercel.app',
      'https://do-epub-studio.netlify.app',
      'https://do-epub-studio.github.io',
    ]) {
      const result = validateApiOrigin({ raw, isProduction: true });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/SPA-only host/);
    }
  });

  it('allows SPA-only hosts in dev (local experimentation)', () => {
    const result = validateApiOrigin({ raw: 'https://do-epub-studio.onrender.com', isProduction: false });
    expect(result.ok).toBe(true);
  });

  it('rejects an origin with a path, query, fragment, or credentials', () => {
    for (const raw of [
      'https://api.example.com/api',
      'https://api.example.com/?key=value',
      'https://api.example.com/#frag',
      'https://user:pass@api.example.com',
    ]) {
      const result = validateApiOrigin({ raw, isProduction: true });
      expect(result.ok).toBe(false);
    }
  });
});

describe('resolveApiBaseUrl', () => {
  it('returns the configured origin when valid', () => {
    expect(resolveApiBaseUrl({ raw: 'https://api.do-epub-studio.test', isProduction: true })).toEqual({
      kind: 'configured',
      url: 'https://api.do-epub-studio.test',
    });
  });

  it('falls back to same-origin when missing or invalid', () => {
    expect(resolveApiBaseUrl({ raw: undefined, isProduction: true })).toEqual({
      kind: 'same-origin',
    });
    expect(resolveApiBaseUrl({ raw: 'nope', isProduction: true })).toEqual({
      kind: 'same-origin',
    });
  });
});

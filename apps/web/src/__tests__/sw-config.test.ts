import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';

describe('Service Worker Configuration', () => {
  const swPath = join(__dirname, '../sw.ts');
  const swContent = readFileSync(swPath, 'utf-8');

  it('implements NetworkFirst-like strategy for navigation with index.html fallback', () => {
    expect(swContent).toContain('NavigationRoute');
    expect(swContent).toContain('await fetch(params.request)');
    expect(swContent).toContain('getCacheKeyForURL(\'index.html\')');
  });

  it('implements NetworkOnly strategy for sensitive API routes', () => {
    // The source code uses double backslashes in the regex string literal in sw.ts
    expect(swContent).toContain('registerRoute(/^https?:.*\\/api\\/(?:admin|access)(\\/.*)?$/i, new NetworkOnly());');
  });

  it('implements NetworkFirst for generic API requests with 1-hour expiration', () => {
    // 60 * 60 = 3600 seconds = 1 hour
    expect(swContent).toContain('maxAgeSeconds: 60 * 60');
    expect(swContent).toContain('cacheName: \'api-responses\'');
  });

  it('implements StaleWhileRevalidate for EPUB and book content with 7-day expiration', () => {
    // 60 * 60 * 24 * 7 = 604800 seconds = 7 days
    expect(swContent).toContain('cacheName: \'book-content\'');
    expect(swContent).toContain('maxAgeSeconds: 60 * 60 * 24 * 7');
  });

  it('implements CacheFirst for images with 30-day expiration', () => {
    expect(swContent).toContain('cacheName: \'images\'');
    expect(swContent).toContain('maxAgeSeconds: 60 * 60 * 24 * 30');
  });

  it('uses StaleWhileRevalidate for external assets', () => {
    expect(swContent).toContain('new StaleWhileRevalidate({');
    expect(swContent).toContain('cacheName: \'external-assets\'');
  });
});

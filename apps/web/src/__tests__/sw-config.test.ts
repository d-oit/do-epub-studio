import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';

describe('Service Worker Configuration', () => {
  const swPath = join(__dirname, '../sw.ts');
  const swContent = readFileSync(swPath, 'utf-8');

  it('serves navigation requests from precached app shell via createHandlerBoundToURL', () => {
    expect(swContent).toContain('NavigationRoute');
    // The shell is keyed by the URL Pages actually serves: `/index.html`
    // answers with a 308 whose redirect `upgrade-insecure-requests` breaks on
    // an http origin, which aborted the whole install.
    expect(swContent).toContain("const APP_SHELL_URL = '/';");
    expect(swContent).toContain('createHandlerBoundToURL(APP_SHELL_URL)');
    expect(swContent).toContain("entry.url === 'index.html'");
  });

  it('implements NetworkOnly strategy for sensitive API routes', () => {
    // The source code uses double backslashes in the regex string literal in sw.ts
    expect(swContent).toContain(
      'registerRoute(/^https?:.*\\/api\\/(?:admin|access)(\\/.*)?$/i, new NetworkOnly());',
    );
  });

  it('implements NetworkFirst for generic API requests with 1-hour expiration', () => {
    // 60 * 60 = 3600 seconds = 1 hour
    expect(swContent).toContain('maxAgeSeconds: 60 * 60');
    expect(swContent).toContain("cacheName: 'api-responses'");
  });

  it('serves book files manifest-first with a stale fallback cache (issue #1485)', () => {
    // The /api/files/* route prefers a verified offline copy (manifest
    // gated), then the network with a stale 'book-content' fallback.
    expect(swContent).toContain('function handleBookFileRequest');
    expect(swContent).toContain("caches.open('book-content')");
    expect(swContent).toContain('serveBookResource(request)');
  });

  it('implements CacheFirst for images with 30-day expiration', () => {
    expect(swContent).toContain("cacheName: 'images'");
    expect(swContent).toContain('maxAgeSeconds: 60 * 60 * 24 * 30');
  });

  it('uses StaleWhileRevalidate for external assets', () => {
    expect(swContent).toContain('new StaleWhileRevalidate({');
    expect(swContent).toContain("cacheName: 'external-assets'");
  });
});

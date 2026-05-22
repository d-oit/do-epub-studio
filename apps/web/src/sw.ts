/// <reference lib="WebWorker" />
/// <reference types="vite-plugin-pwa/client" />

import { cleanupOutdatedCaches, precacheAndRoute, getCacheKeyForURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { createTraceId } from '@do-epub-studio/shared';

declare let self: ServiceWorkerGlobalScope;

// SyncEvent type definition for Service Worker background sync
interface SyncEvent extends Event {
  readonly tag: string;
  readonly lastChance: boolean;
  waitUntil(promise: Promise<unknown>): void;
}

// Clean up old caches during installation
cleanupOutdatedCaches();

// Precache app shell and assets
precacheAndRoute(self.__WB_MANIFEST);

// Handle navigation requests by falling back to precached app shell (index.html)
// Precached assets are already handled by precacheAndRoute, this provides the SPA fallback.
registerRoute(
  new NavigationRoute(
    async (params) => {
      try {
        // Attempt to fetch from network first for freshness
        const response = await fetch(params.request);
        if (response.ok) return response;
        throw new Error('Network response was not ok');
      } catch {
        // Fallback to precached index.html
        return (
          (await caches.match(getCacheKeyForURL('index.html') || '/index.html')) || Response.error()
        );
      }
    },
    {
      // Exclude API and internal worker routes from navigation handling
      denylist: [/^\/api\//, /^\/_worker\//],
    },
  ),
);

// Cache Google Fonts stylesheets
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-stylesheets',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

// Cache Google Fonts web fonts
registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

// Cache images with CacheFirst strategy
registerRoute(
  /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
  new CacheFirst({
    cacheName: 'images',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  }),
);

// Cache EPUB and other book content (covers, media) with CacheFirst
registerRoute(
  /^https?:.*\/api\/files\/.*/i,
  new CacheFirst({
    cacheName: 'book-content',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 }), // 30 days
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

// Sensitive API requests - Never cache (handles with or without trailing slash)
registerRoute(/^https?:.*\/api\/(?:admin|access)(\/.*)?$/i, new NetworkOnly());

// API requests with NetworkFirst (prefer fresh data, fallback to cache)
registerRoute(
  /^https?:.*\/api\/.*/i,
  new NetworkFirst({
    cacheName: 'api-responses',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 }), // 1 hour
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
    networkTimeoutSeconds: 10,
  }),
);

// External assets or non-precached static files
registerRoute(
  ({ url }) => url.origin !== self.location.origin && !url.pathname.startsWith('/api/'),
  new StaleWhileRevalidate({
    cacheName: 'external-assets',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 }), // 7 days
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

// Handle offline queue for sync
self.addEventListener('sync', (event: Event) => {
  const syncEvent = event as SyncEvent;
  if (syncEvent.tag === 'sync-reader-state') {
    syncEvent.waitUntil(
      (async () => {
        const traceId = createTraceId();
        console.log(
          JSON.stringify({ level: 'info', traceId, event: 'sw.sync.start', tag: syncEvent.tag }),
        );
        try {
          const { syncAll } = await import('./lib/offline/sync');
          await syncAll();
          console.log(
            JSON.stringify({
              level: 'info',
              traceId,
              event: 'sw.sync.complete',
              tag: syncEvent.tag,
            }),
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(
            JSON.stringify({
              level: 'error',
              traceId,
              event: 'sw.sync.failed',
              tag: syncEvent.tag,
              error: { message },
            }),
          );
        }
      })(),
    );
  }
});

// Message handler for cache invalidation
self.addEventListener('message', (event) => {
  const data = event.data as { type?: string; cacheName?: string } | undefined;
  if (data && data.type === 'CLEAR_CACHE') {
    const traceId = createTraceId();
    const cacheName = data.cacheName;
    if (cacheName) {
      event.waitUntil(
        caches.delete(cacheName).then((deleted) => {
          console.log(
            JSON.stringify({ level: 'info', traceId, event: 'sw.cache.cleared', cacheName, deleted }),
          );
        }),
      );
    }
  }
});

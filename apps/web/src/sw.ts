/// <reference lib="WebWorker" />
/// <reference types="vite-plugin-pwa/client" />

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { createTraceId } from './lib/telemetry';

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

// Cache EPUB files with CacheFirst (large binary files)
registerRoute(
  /^https?:.*\/api\/files\/.*/i,
  new CacheFirst({
    cacheName: 'epub-files',
    plugins: [
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 7 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

// API requests with NetworkFirst (prefer fresh data, fallback to cache)
registerRoute(
  /^https?:.*\/api\/.*/i,
  new NetworkFirst({
    cacheName: 'api-responses',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 15 }), // 15 minutes
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
    networkTimeoutSeconds: 10,
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
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    const traceId = createTraceId();
    const cacheName = event.data.cacheName as string;
    event.waitUntil(
      caches.delete(cacheName).then((deleted) => {
        console.log(
          JSON.stringify({ level: 'info', traceId, event: 'sw.cache.cleared', cacheName, deleted }),
        );
      }),
    );
  }
});

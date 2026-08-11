/// <reference lib="WebWorker" />
/// <reference types="vite-plugin-pwa/client" />

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { RangeRequestsPlugin } from 'workbox-range-requests';
import { createHandlerBoundToURL } from 'workbox-precaching';
import { enable as enableNavigationPreload } from 'workbox-navigation-preload';
import { createTraceId } from '@do-epub-studio/shared';
import { swLogEvent } from './sw-logger';

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

// Enable navigation preload for faster SPA navigations when SW is active
// NavigationPreloadManager may not exist in all browsers (e.g. Firefox)
if ('navigationPreload' in self.registration) {
  enableNavigationPreload();
}

// Handle navigation requests using the precached app shell (index.html)
// Precached assets are handled by precacheAndRoute; this provides the SPA fallback
// using createHandlerBoundToURL to avoid unnecessary network round-trips.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    // Exclude API and internal worker routes from navigation handling
    denylist: [/^\/api\//, /^\/_worker\//],
  }),
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

const DEBUG = process.env.NODE_ENV !== 'production';

// --- Quota guard: throttled estimate + measured eviction --------------------

const QUOTA_THRESHOLD = 0.85;
/** Minimum ms between actual navigator.storage.estimate() calls. */
const THROTTLE_MS = 60_000;
/** Min-gap after a *failed* estimate before we retry (prevents hammer). */
const BACKOFF_MS = 300_000;

let lastEstimateAt = 0;
let lastFailedAt = 0;

// Caches we are willing to evict, in descending priority order.
// Caches NOT listed here (e.g. precache / app shell) are never touched.
const EVICTABLE_PREFIXES = ['images', 'external-assets', 'epub', 'google-fonts-stylesheets', 'google-fonts-webfonts', 'book-content'] as const;

async function evictLargestCache(): Promise<void> {
  const cacheNames = await caches.keys();
  let targetName: string | null = null;
  let targetSize = -1;

  for (const name of cacheNames) {
    // Skip caches that must never be evicted (precache / app shell).
    if (name.startsWith('workbox-precache')) continue;

    // Only consider caches that match an evictable prefix, or the fallback.
    const matchesPrefix = EVICTABLE_PREFIXES.some((p) => name.startsWith(p) || name === p);
    if (!matchesPrefix && name !== 'external-assets') continue;

    const cache = await caches.open(name);
    const keys = await cache.keys();
    if (keys.length > targetSize) {
      targetSize = keys.length;
      targetName = name;
    }
  }

  if (targetName) {
    await caches.delete(targetName);
  } else {
    // Fallback when nothing matched — keep old behaviour.
    await caches.delete('external-assets');
  }
}

const quotaGuardPlugin = {
  cacheWillUpdate: async ({
    request,
    response,
  }: {
    request: Request;
    response: Response;
  }) => {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
      return response;
    }

    const now = Date.now();

    // Throttle: skip if we estimated recently OR are in a backoff window.
    if (now - lastEstimateAt < THROTTLE_MS) return response;
    if (now - lastFailedAt < BACKOFF_MS) return response;

    try {
      lastEstimateAt = now;
      const { usage, quota } = await navigator.storage.estimate();
      if (usage === undefined || quota === undefined) return response;

      const usageRatio = usage / quota;
      if (usageRatio > QUOTA_THRESHOLD) {
        const traceId = createTraceId();
        swLogEvent(
          'warning',
          'sw.storage.quota_warning',
          { traceId, usage, quota, usageRatio },
          { request },
        );
        await evictLargestCache();
      }
    } catch (err) {
      lastFailedAt = Date.now();
      swLogEvent(
        'error',
        'sw.storage.estimate_error',
        { traceId: createTraceId(), error: err instanceof Error ? err.message : String(err) },
        { request },
      );
    }
    return response;
  },
};

// Cache images with CacheFirst strategy
registerRoute(
  /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      quotaGuardPlugin,
    ],
  }),
);

// Cache EPUB and other book content (covers, media) with StaleWhileRevalidate
registerRoute(
  /^https?:.*\/api\/files\/.*/i,
  new StaleWhileRevalidate({
    cacheName: 'book-content',
    plugins: [
      new RangeRequestsPlugin(),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 }), // 7 days
      new CacheableResponsePlugin({ statuses: [0, 200, 206] }),
      quotaGuardPlugin,
    ],
  }),
);

// Sensitive API requests - Never cache (handles with or without trailing slash)
registerRoute(/^https?:.*\/api\/(?:admin|access)(\/.*)?$/i, new NetworkOnly());

// API requests with NetworkFirst (prefer fresh data, fallback to cache)
registerRoute(
  /^https?:.*\/api\/(?!files|admin|access)(.*)/i,
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
        if (DEBUG) {
          swLogEvent('info', 'sw.sync.start', { traceId, tag: syncEvent.tag });
        }
        try {
          const { syncAll } = await import('./lib/offline/sync');
          await syncAll();
          if (DEBUG) {
            swLogEvent('info', 'sw.sync.complete', { traceId, tag: syncEvent.tag });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          swLogEvent('error', 'sw.sync.failed', {
            traceId,
            tag: syncEvent.tag,
            error: { message },
          });
          // Surface the failure (rejects the waitUntil promise) so
          // Workbox/background-sync can observe and retry. Log first, then let
          // the error propagate — never swallow retryable sync failures.
          throw error;
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
          if (DEBUG) {
            swLogEvent('info', 'sw.cache.cleared', { traceId, cacheName, deleted });
          }
        }),
      );
    }
  }
});

// --- Global error handlers: redacted, never rethrown ------------------------

function toErrorRecord(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { name: 'Unknown', message: typeof error === 'string' ? error : String(error) };
}

self.addEventListener('error', (event) => {
  // ``event.error`` is DOM-typed `any`; capture it as `unknown` so the
  // serializer sees a safe type and nothing leaks.
  const err: unknown = event.error;
  swLogEvent('error', 'sw.global.error', {
    message: event.message ?? toErrorRecord(err).message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: toErrorRecord(err),
  });
});

self.addEventListener('unhandledrejection', (event) => {
  const reason: unknown = event.reason;
  swLogEvent('error', 'sw.global.unhandledrejection', {
    error: toErrorRecord(reason ?? 'Unknown rejection reason'),
  });
});

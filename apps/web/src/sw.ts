/// <reference lib="WebWorker" />
/// <reference types="vite-plugin-pwa/client" />

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

import { createHandlerBoundToURL } from 'workbox-precaching';
import { enable as enableNavigationPreload } from 'workbox-navigation-preload';
import { createTraceId } from '@do-epub-studio/shared';
import { swLogEvent } from './sw-logger';
import { evictToThreshold } from './lib/offline/eviction';
import { recoverOfflineStorage } from './lib/offline/recovery';
import { serveBookResource } from './lib/offline/serving';

declare let self: ServiceWorkerGlobalScope;

// SyncEvent type definition for Service Worker background sync
interface SyncEvent extends Event {
  readonly tag: string;
  readonly lastChance: boolean;
  waitUntil(promise: Promise<unknown>): void;
}

// Clean up old caches during installation
cleanupOutdatedCaches();

// Precache app shell and assets. The manifest names the shell `index.html`,
// but Cloudflare Pages answers `/index.html` with a 308 to `/`; following that
// redirect from an `http` origin is upgraded to `https` by
// `upgrade-insecure-requests` and the install fails with "Failed to fetch".
// Key the shell by the URL that is actually served so the install never
// depends on a redirect.
const APP_SHELL_URL = '/';
const precacheEntries = self.__WB_MANIFEST.map((entry) =>
  typeof entry === 'string'
    ? entry === 'index.html'
      ? APP_SHELL_URL
      : entry
    : entry.url === 'index.html'
      ? { ...entry, url: APP_SHELL_URL }
      : entry,
);
precacheAndRoute(precacheEntries);

// Control the page that triggered the first install without waiting for a
// reload; until then, fetches on that first visit bypass the worker, so an
// offline reload after a first visit failed with an uncontrolled document.
// Updates still wait for the user's refresh prompt (no `skipWaiting`).
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(self.clients.claim());
  // Reconcile offline storage (interrupted staging, orphan caches, stale or
  // corrupt manifests) on every activation; never blocking activation.
  void recoverOfflineStorage().catch((error: unknown) => {
    swLogEvent('error', 'sw.storage.recovery_failed', {
      traceId: createTraceId(),
      error: error instanceof Error ? error.message : String(error),
    });
  });
});

// Enable navigation preload for faster SPA navigations when SW is active
// NavigationPreloadManager may not exist in all browsers (e.g. Firefox)
if ('navigationPreload' in self.registration) {
  enableNavigationPreload();
}

// Handle navigation requests using the precached app shell (index.html)
// Precached assets are handled by precacheAndRoute; this provides the SPA fallback
// using createHandlerBoundToURL to avoid unnecessary network round-trips.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL(APP_SHELL_URL), {
    // Exclude API and internal worker routes from navigation handling
    denylist: [/^\/api\//, /^\/_worker\//],
  }),
);

// Fonts are self-hosted via @fontsource (ADR-123, PR #748) — no external font
// origins are cached. CSP `font-src 'self'` blocks the old external font CDN
// origins, so the pre-ADR-123 Google Fonts CacheFirst routes (removed in
// GOAP-248) could never match and were dead code.

const DEBUG = process.env.NODE_ENV !== 'production';

// --- Quota guard: throttled estimate + measured eviction --------------------

const QUOTA_THRESHOLD = 0.85;
/** Minimum ms between actual navigator.storage.estimate() calls. */
const THROTTLE_MS = 60_000;
/** Min-gap after a *failed* estimate before we retry (prevents hammer). */
const BACKOFF_MS = 300_000;

let lastEstimateAt = 0;
let lastFailedAt = 0;

// Eviction is handled by lib/offline/eviction (byte-estimate + tier-aware
// LRU). Old entry-count-based cache eviction is gone; user data is never a
// candidate (see EVICTION / ownership modules).

const quotaGuardPlugin = {
  cacheWillUpdate: async ({ request, response }: { request: Request; response: Response }) => {
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
        const eviction = await evictToThreshold();
        swLogEvent(
          'info',
          'sw.storage.evicted',
          {
            traceId,
            evictedBooks: eviction.evictedBooks.length,
            removedCaches: eviction.removedCaches.length,
            freedBytes: eviction.freedBytes,
          },
          { request },
        );
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

/**
 * Book-file route (issue #1485): prefers a verified offline copy (manifest
 * gated), then network with a stale 'book-content' fallback. Replaces the old
 * StaleWhileRevalidate route so a single handler owns /api/files/* and
 * CacheStorage/IndexedDB cannot disagree about availability.
 */
async function handleBookFileRequest(request: Request): Promise<Response> {
  const offline = await serveBookResource(request);
  if (offline) return offline;

  if (request.method !== 'GET') {
    return fetch(request);
  }

  try {
    const response = await fetch(request);
    if (response.status === 200) {
      try {
        const cache = await caches.open('book-content');
        await cache.put(request, response.clone());
      } catch {
        // Quota/cache write failures must not discard the fetched response.
      }
    }
    return response;
  } catch {
    const cache = await caches.open('book-content');
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response('Book unavailable offline', { status: 503 });
  }
}

registerRoute(/^https?:.*\/api\/files\/.*/i, ({ request }) => handleBookFileRequest(request));

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
          // Notify available window clients so the authenticated foreground page can drain the queue.
          // SW does not receive or persist session tokens.
          const clients = await self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true,
          });
          for (const client of clients) {
            client.postMessage({ type: 'SYNC_REQUESTED', tag: syncEvent.tag });
          }
          if (DEBUG) {
            swLogEvent('info', 'sw.sync.complete', {
              traceId,
              tag: syncEvent.tag,
              notifiedClients: clients.length,
            });
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

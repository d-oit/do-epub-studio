# ADR-251: Service Worker Build Format Matches Classic Registration

**Date:** Current session
**Status:** Accepted
**Deciders:** Project maintainer
**Related:** ADR-005, ADR-124, GOAP-251

## Context

The production service worker failed to register on every page load
(`sw.registration_failed`: "ServiceWorker script evaluation failed"). The
deployed `sw.js` is an ES-module bundle that contains `import.meta` (emitted by
Vite 8/Rolldown's `__vitePreload` helper because `sw.ts` has a dynamic
`import('./lib/offline/sync')`). vite-plugin-pwa registers the SW with
`type: 'classic'` in production (the `__TYPE__` placeholder resolves to
`devOptions.enabled ? devOptions.type : "classic"`), so the browser parses the
module bundle as a classic script and throws
`Cannot use 'import.meta' outside a module`.

The offline/PWA layer (ADR-005, ADR-124) never activated in production.

## Decision

The `injectManifest` service worker MUST be built as an IIFE (classic worker):

```ts
VitePWA({
  strategies: 'injectManifest',
  injectManifest: { rollupFormat: 'iife' },
  // ...
})
```

Rationale:

- The plugin's registration client hardcodes `type: 'classic'` in production,
  so the SW bundle must be classic-compatible. IIFE output has zero
  `import.meta` and evaluates as a classic script.
- The alternative (registering with `type: 'module'`) requires bypassing the
  plugin's `virtual:pwa-register` client and reimplementing the workbox-window
  update flow — unnecessary churn for a one-line build-format fix.
- `worker.format: 'es'` in the Vite config is a separate concern (reader-core
  module workers) and does not affect the plugin's SW build.

Additionally, background-sync tag registration MUST be deferred until the
worker reaches the `activated` state; calling `sync.register()` during first
install throws `InvalidStateError` ("no active Service Worker").

## Consequences

- The service worker registers and activates in production; offline support
  (ADR-005) works again.
- The SW build is classic rather than module — `import.meta` cannot be used in
  `sw.ts` (it was never used; the emitted `import.meta` came from the bundler
  helper, not source).
- A future vite-plugin-pwa upgrade that supports production `type: 'module'`
  registration could revisit ES-format SW builds; until then IIFE is the
  contract.

# GOAP-251: Fix Service Worker Registration Failure in Production

**Date:** 2026-08-20
**Status:** COMPLETED
**Related:** ADR-251

## Problem

`https://do-epub-studio.onrender.com/` logged `sw.registration_failed` on every
load: `ServiceWorker script evaluation failed` for `/sw.js`. The deployed
`sw.js` (byte-identical to the current `main` build, verified by SHA-256) failed
to parse because it is an ES-module bundle containing `import.meta`, while
vite-plugin-pwa's client registers the SW with `type: 'classic'` in production.

Root cause chain:

1. `vite-plugin-pwa` builds the `injectManifest` SW with `rollupFormat: 'es'`
   by default and renames `sw.mjs` → `sw.js`.
2. Vite 8 (Rolldown) injects its `__vitePreload` helper (which uses
   `import.meta.resolve` / `import.meta.url`) into ES-format bundles that
   contain dynamic imports — `sw.ts` has `import('./lib/offline/sync')`.
3. The plugin's registration client hardcodes `type: 'classic'` in production
   (`__TYPE__` is replaced with `devOptions.enabled ? devOptions.type :
   "classic"`), so the browser parses the module bundle as a classic script →
   `SyntaxError: Cannot use 'import.meta' outside a module` → registration
   fails and no offline support ever activates.

## Execution

1. **Analyze:** Reproduced the parse failure in the browser
   (`new Function(sw.js)` → `Cannot use 'import.meta' outside a module`) and
   confirmed deployed `sw.js` === local build via SHA-256.
2. **Decompose:** Separate the build format (ES vs IIFE) from the registration
   type (classic), and the sync-registration timing bug exposed once the SW
   actually activates.
3. **Strategize:** Force `rollupFormat: 'iife'` so the emitted SW is a classic
   worker with no `import.meta` — matching the plugin's classic registration
   contract with a one-line config change and no runtime rewiring.
4. **Execute:** Add `injectManifest: { rollupFormat: 'iife' }` to `VitePWA`
   config; fix the pre-existing `sw.background_sync_register_failed` timing bug
   in `main.tsx` (`onRegistered` now defers `sync.register()` until the worker
   reaches `activated`); update the SW-registration unit test and add a
   deferral-path test.
5. **Verify:** `vite build` emits zero `import.meta` in `sw.js`; the SW
   registers and becomes ACTIVE in a fresh browser session against `vite
   preview` with a clean console (no `sw.registration_failed`, no
   `sw.background_sync_register_failed`); full quality gate passes.

## Acceptance criteria

- `sw.js` is a classic IIFE bundle with zero `import.meta` occurrences.
- Service worker registers and activates in a real browser with a clean
  console.
- Background sync registration is deferred until activation (no
  `InvalidStateError`).
- Quality gate (lint, typecheck, 1304 web tests, knip, madge, impeccable)
  passes.

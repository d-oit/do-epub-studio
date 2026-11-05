# ADR-1019: Route PWA E2E network mocks through the browser context

**Status:** Accepted

**Deciders:** Project maintainers

**Related:** ADR-021, ADR-074, ADR-1018, GOAP-1019

## Context

The PWA Playwright project enables service workers. PR #1422 adds `clients.claim()` on activation so the first page becomes controlled without a warm-up navigation. The PWA offline-reader test uses route mocks to serve its login response and EPUB. Once the worker handles the page's fetches, requests that the worker sends to the network are not visible to `page.route()`. Those requests fell through to the local Vite proxy and the reader could not load its EPUB.

Playwright's official Service Workers guide documents the distinction: `browserContext.route()` sees network requests made by a service worker; the frame-owned request is not routable when the service worker handles it. Disabling service workers in the PWA project would avoid the routing issue but would invalidate the behavior the project exists to test.

## Decision

1. Keep `clients.claim()` in the production service worker; do not trade first-visit offline behavior for test-mock convenience.
2. In PWA tests that exercise an active service worker, register shared API/EPUB mocks with `BrowserContext.route()`. Register per-test overrides on the same context so they can observe or fulfill service-worker-owned requests.
3. Keep page-level routes for tests that run with service workers blocked and do not need to intercept service-worker network traffic.
4. Use named function declarations for standalone Playwright page-evaluation probes in tests; do not suppress Codacy's Biome lexical-scope findings.

## Alternatives considered

- **Remove `clients.claim()`:** rejected; it restores the first-load control gap and the offline reload failure.
- **Block service workers in the PWA project:** rejected; the PWA lane would stop exercising its service-worker behavior.
- **Keep `page.route()` or suppress the Codacy findings:** rejected; neither fixes the PWA network path, and suppressions hide genuine static-analysis feedback.

## Consequences

- Context-level routes cover both ordinary frame requests and worker-owned network requests; route order must be kept intentional when a test overrides a shared mock.
- The offline-reader suite continues to test the real service worker, including activation, cache behavior, offline rendering, and reconnect.
- Playwright evaluation probes remain serializable without tripping the repository's Codacy Biome rule.

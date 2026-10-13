# GOAP-313: Vercel Manifest CORS & API Proxy Rewrites

**Status:** COMPLETE
**Date:** 2026-10-18

## 1. Problem Description

When deploying to Vercel (e.g. preview deployments with Vercel Deployment Protection / SSO):

1. **Manifest CORS Error:** `login:1 Access to manifest at 'https://vercel.com/sso-api?url=...' (redirected from '.../manifest.webmanifest') from origin '...' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.`
2. **API 404 & Parse Error:** Requests to `/api/demo/reader-login` and `/api/access/request` on Vercel deployments hit static file routing (or SSO redirects) and return 404 HTML pages (`"The page c..."`), which causes `apiRequest` in `apps/web/src/lib/api/core.ts` to throw `SyntaxError: Unexpected token 'T', "The page c"... is not valid JSON`.

## 2. Root Cause

1. On Vercel Preview deployments with SSO / Deployment Protection enabled, uncredentialed fetches for `/manifest.webmanifest` are redirected to `https://vercel.com/sso-api`, which returns response headers without CORS headers. Passing `crossorigin="use-credentials"` on `<link rel="manifest">` ensures session credentials accompany manifest requests, and setting manifest headers in `vercel.json` provides CORS access.
2. Vercel static site deployments served from `apps/web/dist` have no native `/api/*` handler unless configured. Proxying `/api/:path*` to `https://do-epub-studio.pages.dev/api/:path*` in `vercel.json` ensures API requests hit the Cloudflare Pages Functions backend.
3. In `apps/web/src/lib/api/core.ts`, non-JSON responses (HTML 404/500/redirects) were throwing raw `SyntaxError` without preserving HTTP status or trace metadata.

## 3. Solution

1. **`apps/web/index.html`**:
   - Added `crossorigin="use-credentials"` to `<link rel="manifest" href="/manifest.webmanifest" />`.
2. **`vercel.json`**:
   - Configured `headers` for `/manifest.webmanifest` (`Access-Control-Allow-Origin: *`, `Content-Type: application/manifest+json`).
   - Configured `rewrites` to proxy `/api/:path*` to `https://do-epub-studio.pages.dev/api/:path*`.
3. **`apps/web/src/lib/api/core.ts`**:
   - Enhanced `apiRequest` catch block to annotate thrown parse error with `status` and `traceId`.
4. **`apps/web/src/lib/api/core.test.ts`**:
   - Added unit test coverage for non-JSON HTML response handling.

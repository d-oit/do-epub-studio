import path from 'path';
import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import tailwindcss from '@tailwindcss/vite';
import appIdentity from './src/config/app-identity.json' with { type: 'json' };
// Static import instead of readFileSync(VERSION) per AGENTS.md Tier 1.
// scripts/check-app-identity.mjs asserts VERSION === root package.json
// version, so the package version is the authoritative static source.
import rootPackage from '../../package.json' with { type: 'json' };
// Static JSON import (AGENTS.md Tier 1): the Cloudflare Pages per-file cap —
// single source of truth in .performance-budgets.json (Plan 214 R5), shared
// with scripts/check-bundle-budget.mjs.
import performanceBudgets from '../../.performance-budgets.json' with { type: 'json' };

const isAnalyze = process.env.ANALYZE === 'true';
const appVersion = rootPackage.version;

/**
 * lightningcss (the Tailwind v4 pipeline) rewrites a literal
 * `backdrop-filter` + `-webkit-backdrop-filter` pair down to the -webkit-
 * form only — its bundled browser data marks the standard property as
 * unsupported, so Firefox renders no glass blur in production (GOAP-253 A5).
 * This restores the standard declaration beside every -webkit- twin in
 * emitted CSS. Remove once lightningcss ships corrected backdrop-filter data.
 */
function restoreStandardBackdropFilter(): PluginOption {
  return {
    name: 'restore-standard-backdrop-filter',
    apply: 'build',
    generateBundle(_, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === 'asset' && file.fileName.endsWith('.css')) {
          file.source = String(file.source).replace(
            /-webkit-backdrop-filter:([^;}]+)/g,
            (_m, value: string) => `backdrop-filter:${value};-webkit-backdrop-filter:${value}`,
          );
        }
      }
    },
  };
}

/**
 * GOAP-273 B1 / #1188: Cloudflare Pages rejects any single deployed file
 * larger than 25 MiB at asset-validation time — after install, tsc, vite and
 * the service-worker build all pass. The offender is onnxruntime-web's
 * `ort-wasm-simd-threaded.asyncify.wasm` (25.6 MiB), which vite emits through
 * the bundled ORT module's `new URL(..., import.meta.url)` reference — dead
 * weight at runtime, because transformers.js sets
 * `env.backends.onnx.wasm.wasmPaths` to ORT's version-pinned jsdelivr CDN at
 * module init (browser, only when wasmPaths is unset), so the engine never
 * fetches the local copy (ADR-262's local-first contract holds: a static GET
 * for a public binary, same class as the on-demand model download). Dropping
 * oversize assets here fails fast at build time instead of at deploy;
 * scripts/check-bundle-budget.mjs enforces the same cap from
 * .performance-budgets.json as the sensor of record.
 */
function dropOversizedAssets(): PluginOption {
  const maxBytes = performanceBudgets.platformLimits.cloudflarePagesMaxFileBytes;
  return {
    name: 'drop-oversized-assets',
    apply: 'build',
    generateBundle(_, bundle) {
      for (const [fileName, file] of Object.entries(bundle)) {
        if (file.type !== 'asset') continue;
        const bytes =
          typeof file.source === 'string' ? Buffer.byteLength(file.source) : file.source.byteLength;
        if (bytes > maxBytes) {
          console.warn(
            `[drop-oversized-assets] dropping ${fileName} (${(bytes / 1024 / 1024).toFixed(1)} MiB): exceeds ${maxBytes / (1024 * 1024)} MiB per-file deploy cap (Cloudflare Pages)`,
          );
          // Reflect form of `delete bundle[fileName]` (rollup's documented
          // drop pattern): the keys come from Object.entries of the build-time
          // bundle itself, so no untrusted input can reach them — the call-
          // argument form keeps Codacy's ESLint 8 dynamic-key delete /
          // object-injection findings (false positives by construction) out
          // without disabling any rule (AGENTS.md Tier 3).
          Reflect.deleteProperty(bundle, fileName);
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [
    {
      name: 'app-identity-html',
      transformIndexHtml(html) {
        return html
          .replaceAll('%APP_NAME%', appIdentity.name)
          .replaceAll('%APP_DESCRIPTION%', appIdentity.description)
          .replaceAll('%APP_VERSION%', appVersion);
      },
    },
    react(),
    tailwindcss(),
    restoreStandardBackdropFilter(),
    dropOversizedAssets(),
    VitePWA({
      registerType: 'prompt',
      // Only precache assets that actually ship from public/. favicon.ico has no
      // source (index.html references /favicon.svg), so it must not be listed.
      includeAssets: ['robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: appIdentity.name,
        short_name: appIdentity.shortName,
        description: appIdentity.description,
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      strategies: 'injectManifest',
      // Build the SW as an IIFE (classic worker), NOT an ES module. The plugin's
      // client registers the SW with `type: 'classic'` in production, but Vite 8
      // (Rolldown) emits `import.meta` in the module-preload helper of ES-format
      // bundles that contain dynamic imports — a parse error in classic workers:
      // "Cannot use 'import.meta' outside a module" → sw.registration_failed.
      // IIFE output has no `import.meta` and evaluates fine as a classic worker.
      // GOAP-273 B1: the .wasm/.onnx engine artifacts are labelled, on-demand
      // downloads (never precached — GOAP-262 bundle rejection stands), so
      // exclude them from the precache glob even if a dependency drops them
      // into dist/ where the default glob would silently swallow them.
      injectManifest: {
        rollupFormat: 'iife',
        globIgnores: ['**/*.wasm', '**/*.onnx'],
      },
      srcDir: 'src',
      filename: 'sw.ts',
    }),
    ...(isAnalyze
      ? [
          visualizer({
            open: false,
            filename: 'dist/stats.html',
            gzipSize: true,
            brotliSize: true,
          }) as PluginOption,
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  worker: {
    // reader-core constructs module workers (`new Worker(url, { type: 'module' })`
    // for epub-parser + reanchor). Vite's default iife worker format mis-bundles
    // them in production builds (epub-parser inlined as a data: URL with a bogus
    // MIME, reanchor emitted as raw .ts), which made every production build fail
    // to load books (scheduled E2E, issue #957). ES format emits real worker chunks.
    format: 'es',
  },
  build: {
    outDir: 'dist',
    manifest: true,
    sourcemap: false,
    // Raw (pre-gzip) advisory limit only. The enforced budgets are gzipped and
    // live in .performance-budgets.json (lazyChunkJs 165 KB). The on-device
    // editorial engine chunk (transformers.web, GOAP-273 B1) is 158 KB gzipped
    // and is fetched only on a user-initiated engine prepare, never on route
    // entry, so it legitimately exceeds Vite's 500 KB raw default. Set above
    // that chunk but well below a genuinely oversized new one, so the advisory
    // — and the quality gate's zero-warning rail on it — still bites.
    chunkSizeWarningLimit: 600,
    rolldownOptions: { output: {
        // Vite 8 Rolldown uses codeSplitting or function manualChunks
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }
            if (id.includes('epubjs')) {
              return 'epubjs';
            }
            if (id.includes('jszip')) {
              return 'vendor-jszip';
            }
            if (id.includes('idb')) {
              return 'vendor-idb';
            }
            if (id.includes('uuid')) {
              return 'vendor-uuid';
            }
            if (id.includes('zustand')) {
              return 'zustand';
            }
            if (id.includes('workbox')) {
              return 'workbox';
            }
            if (id.includes('i18next') || id.includes('react-i18next')) {
              return 'i18n';
            }
          }
          // Route-aware chunking: isolate reader-core from admin/editor
          if (id.includes('packages/reader-core')) {
            return 'reader-core';
          }
          // Shell-shared stores (imported statically by App/AppShell AND lazy
          // routes): pin to a neutral chunk so Rolldown never places them
          // inside reader-route — a single static index→reader-route edge would
          // drag the whole reader-core chunk (~90KB gzip) into every route
          // total (ADR-107 §3). Must precede the features/reader rule.
          // NOTE: src/lib/offline is deliberately NOT pinned: the shell reads
          // it only through a dynamic import (useSyncStatus), so its IndexedDB
          // machinery must stay in lazy chunks, not the static closure.
          if (id.includes('src/stores/')) {
            return 'app-shared';
          }
          if (id.includes('packages/shared')) {
            return 'shared-lib';
          }
          if (id.includes('packages/ui')) {
            return 'ui-lib';
          }
          if (id.includes('features/reader')) {
            return 'reader-route';
          }
          if (id.includes('features/admin')) {
            return 'admin-route';
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    // Dev only: the Worker builds signed file URLs against APP_BASE_URL (the
    // web origin in dev), so `/api/files/...` must resolve same-origin. Proxy
    // them to the local Wrangler worker. Preview/CI preview mode (mocked API)
    // and production (Pages same-origin function) are unaffected.
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8787',
        changeOrigin: false,
      },
    },
  },
});

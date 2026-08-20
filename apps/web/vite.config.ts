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

const isAnalyze = process.env.ANALYZE === 'true';
const appVersion = rootPackage.version;

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
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: appIdentity.name,
        short_name: appIdentity.shortName,
        description: appIdentity.description,
        version: appVersion,
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
      injectManifest: { rollupFormat: 'iife' },
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
    chunkSizeWarningLimit: 500,
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
  },
});

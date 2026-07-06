import path from 'path';
import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import tailwindcss from '@tailwindcss/vite';
import appIdentity from './src/config/app-identity.json';
import appVersionRaw from '../../VERSION?raw';

const appVersion = appVersionRaw.trim();
const isAnalyze = process.env.ANALYZE === 'true';

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
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    manifest: true,
    sourcemap: false,
    rolldownOptions: {
      output: {
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

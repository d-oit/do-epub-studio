import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

const isAnalyze = process.env.ANALYZE === 'true';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'do EPUB Studio',
        short_name: 'EPUB Studio',
        description: 'EPUB reading and editorial workspace',
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
          }) as any,
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
    sourcemap: true,
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
            if (id.includes('zustand')) {
              return 'zustand';
            }
            if (id.includes('workbox')) {
              return 'workbox';
            }
          }
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});

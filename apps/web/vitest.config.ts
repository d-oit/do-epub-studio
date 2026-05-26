import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'virtual:pwa-register': path.resolve(__dirname, './src/__mocks__/virtual-pwa-register.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['src/test-setup.ts'],
    // Use forks instead of threads for better React 18 isolation
    pool: 'forks',
    // Run test files sequentially if needed, but forks should handle isolation
    fileParallelism: false,
    isolate: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    watch: {
      usePolling: true,
    },
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'json', 'html', 'lcov', 'clover'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: 50,
        functions: 40,
        branches: 29,
        statements: 35,
      },
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/test-setup.ts',
        'src/vite-env.d.ts',
        'src/sw.ts',
      ],
    },
  },
});

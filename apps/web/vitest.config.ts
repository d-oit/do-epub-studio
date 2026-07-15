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
    // Use threads for shared jsdom environment — 5x faster than forks.
    // jsdom isolation is handled by vitest's isolate flag.
    pool: 'threads',
    // Run test files in parallel for throughput.
    // Each file is isolated; shared state is reset in test-setup.ts.
    fileParallelism: true,
    isolate: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    watch: {
      usePolling: true,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'clover'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: 55,
        functions: 48,
        branches: 40,
        statements: 55,
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

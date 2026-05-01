import { defineConfig } from 'vitest/config';

export default defineConfig({
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
      provider: 'v8',
      reporter: ['text', 'lcov', 'clover'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: 10,
        functions: 55,
        branches: 50,
        statements: 10,
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

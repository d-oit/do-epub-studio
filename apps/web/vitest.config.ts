import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['src/test-setup.ts'],
    // Use forks for process isolation to prevent DOM pollution
    pool: 'forks',
    poolOptions: {
      forks: {
        // Higher memory limit (2048MB) to prevent OOM
        memoryLimit: 2048,
        // Single fork to minimize memory pressure
        maxParallelTests: 1,
      },
    },
    // Run tests sequentially in main process to avoid worker memory accumulation
    // This prevents OOM during cleanup when running large test suites in CI
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
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
        'src/sw.ts', // Service worker has separate build
      ],
    },
  },
});

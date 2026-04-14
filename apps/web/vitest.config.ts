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
        // Increase memory limit to prevent OOM in CI (was 512MB)
        memoryLimit: 2048,
        // Reduce parallelism to avoid memory pressure
        maxParallelTests: 2,
      },
    },
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

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['src/test-setup.ts'],
    // Threads pool provides good balance of isolation and speed
    // singleThread prevents race conditions in React concurrent rendering tests
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
        minThreads: 1,
        maxThreads: 1,
      },
    },
    // Run test files sequentially with isolate for better React test isolation
    fileParallelism: false,
    isolate: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    // Use polling for file watching - required for WSL2 where native file system events are unreliable
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
        'src/sw.ts', // Service worker has separate build
      ],
    },
  },
});

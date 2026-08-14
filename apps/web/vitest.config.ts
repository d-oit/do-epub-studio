import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      'virtual:pwa-register': path.resolve(import.meta.dirname, './src/__mocks__/virtual-pwa-register.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['src/test-setup.ts'],
    // Use forks for test isolation per AGENTS.md Tier 3 / docs/conventions.md.
    // Measured 2026-08-05 (Plan 214 R4): forks 24.7s vs threads 26.1s for the
    // full web suite (1115 tests) — the old "5x faster" thread claim was stale
    // and forks are not slower here, so policy-compliant forks win.
    // Note: Vitest 4 removed `poolOptions.forks.singleFork` (top-level pool
    // options); forks default to one file per process, which preserves the
    // ADR-216 isolation guarantee.
    pool: 'forks',
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

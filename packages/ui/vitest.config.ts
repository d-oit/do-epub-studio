import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'json', 'html', 'lcov', 'clover'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.stories.tsx'],
      reportsDirectory: './coverage',
      thresholds: { lines: 10, functions: 5, branches: 5, statements: 10 },
    },
  },
});

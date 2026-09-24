import { defineConfig } from 'vitest/config';
// Coverage floors' single source of truth is /coverage-thresholds.json
// (ADR-282). Never restate the numbers here — scripts/validate-coverage-parity.sh
// fails the gate if this config stops deriving thresholds from that JSON.
import coverageThresholds from '../../coverage-thresholds.json';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'clover'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.stories.tsx'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: coverageThresholds['ui'].lines,
        functions: coverageThresholds['ui'].functions,
        branches: coverageThresholds['ui'].branches,
        statements: coverageThresholds['ui'].statements,
      },
    },
  },
});

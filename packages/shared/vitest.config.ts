import { defineConfig } from 'vitest/config';
// Coverage floors' single source of truth is /coverage-thresholds.json
// (ADR-282). Never restate the numbers here — scripts/validate-coverage-parity.sh
// fails the gate if this config stops deriving thresholds from that JSON.
import coverageThresholds from '../../coverage-thresholds.json';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'clover'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: coverageThresholds['shared'].lines,
        functions: coverageThresholds['shared'].functions,
        branches: coverageThresholds['shared'].branches,
        statements: coverageThresholds['shared'].statements,
      },
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    },
  },
});

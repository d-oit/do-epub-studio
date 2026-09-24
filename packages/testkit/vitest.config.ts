import { defineConfig } from 'vitest/config';
// Coverage floors' single source of truth is /coverage-thresholds.json
// (ADR-282). Never restate the numbers here — scripts/validate-coverage-parity.sh
// fails the gate if this config stops deriving thresholds from that JSON.
import coverageThresholds from '../../coverage-thresholds.json';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'clover'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      thresholds: {
        lines: coverageThresholds['testkit'].lines,
        functions: coverageThresholds['testkit'].functions,
        branches: coverageThresholds['testkit'].branches,
        statements: coverageThresholds['testkit'].statements,
      },
    },
  },
});

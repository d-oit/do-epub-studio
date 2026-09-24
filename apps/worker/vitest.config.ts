import { defineConfig } from 'vitest/config';
// Coverage floors' single source of truth is /coverage-thresholds.json
// (ADR-282). Never restate the numbers here — scripts/validate-coverage-parity.sh
// fails the gate if this config stops deriving thresholds from that JSON.
import coverageThresholds from '../../coverage-thresholds.json';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'clover'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: coverageThresholds['worker'].lines,
        functions: coverageThresholds['worker'].functions,
        branches: coverageThresholds['worker'].branches,
        statements: coverageThresholds['worker'].statements,
      },
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/index.ts', // Entry point tested via route handlers
      ],
    },
  },
});

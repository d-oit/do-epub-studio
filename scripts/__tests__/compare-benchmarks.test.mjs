import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// ADR-312: the regression gate fails only when a drop clears BOTH the
// threshold and the combined relative margin of error (rme) of the two runs.
// These tests pin the decision table.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.resolve(__dirname, '../compare-benchmarks.mjs');
const rootDir = path.resolve(__dirname, '../..');
const tempDir = path.resolve(__dirname, 'temp-compare-benchmarks');

function benchFile(name, benchmarks) {
  return {
    filepath: `/repo/${name}`,
    groups: [
      {
        fullName: `src/${name} > perf`,
        benchmarks,
      },
    ],
  };
}

function writeFixtures(baselineBenchmarks, headBenchmarks) {
  fs.writeFileSync(
    path.join(tempDir, 'baseline.json'),
    JSON.stringify({ files: [benchFile('bench.ts', baselineBenchmarks)] }),
  );
  fs.writeFileSync(
    path.join(tempDir, 'head.json'),
    JSON.stringify({ files: [benchFile('bench.ts', headBenchmarks)] }),
  );
}

function runScript(args = []) {
  return spawnSync(
    'node',
    [scriptPath, path.join(tempDir, 'baseline.json'), path.join(tempDir, 'head.json'), ...args],
    { cwd: rootDir, encoding: 'utf8' },
  );
}

describe('compare-benchmarks.mjs (ADR-218 + ADR-312)', () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('fails when a drop clears both the threshold and the noise bars', () => {
    writeFixtures([{ name: 'slow', hz: 100, rme: 2 }], [{ name: 'slow', hz: 60, rme: 2 }]);
    const result = runScript();
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('❌');
    expect(result.stdout).toContain('Regression detected');
    expect(result.stdout).toContain('-40.00%');
  });

  it('passes a >threshold drop that is inside the combined rme noise band (the CI flake)', () => {
    // Observed on a noisy GitHub runner: -21% on a benchmark with base rme 15%
    // and head rme 30% — the two error bars overlap, so the drop is not
    // evidence of a regression.
    writeFixtures([{ name: 'noisy', hz: 100, rme: 15 }], [{ name: 'noisy', hz: 60, rme: 30 }]);
    const result = runScript();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('≈');
    expect(result.stdout).not.toContain('Regression detected');
    expect(result.stdout).toContain('45.00%');
  });

  it('marks a negative change under the threshold as a warning, not a failure', () => {
    writeFixtures([{ name: 'minor', hz: 100, rme: 1 }], [{ name: 'minor', hz: 85, rme: 1 }]);
    const result = runScript();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('⚠️');
    expect(result.stdout).toContain('-15.00%');
  });

  it('reports improvements as passing', () => {
    writeFixtures([{ name: 'faster', hz: 100, rme: 1 }], [{ name: 'faster', hz: 120, rme: 1 }]);
    const result = runScript();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('✅');
    expect(result.stdout).toContain('+20.00%');
  });

  it('treats a benchmark missing from the baseline as new, never a regression', () => {
    writeFixtures([], [{ name: 'brand-new', hz: 42, rme: 1 }]);
    const result = runScript();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('🆕');
    expect(result.stdout).toContain('NEW');
  });

  it('never fails on a zero baseline ratio', () => {
    writeFixtures([{ name: 'zero', hz: 0, rme: 0 }], [{ name: 'zero', hz: 5, rme: 1 }]);
    const result = runScript();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('∞%');
  });

  it('honours an explicit threshold argument', () => {
    writeFixtures([{ name: 'minor', hz: 100, rme: 1 }], [{ name: 'minor', hz: 85, rme: 1 }]);
    const strict = runScript(['10']);
    expect(strict.status).toBe(1);
    expect(strict.stdout).toContain('regressed by more than 10%');
  });

  it('fails with a readable comment when a results file cannot be read', () => {
    const result = spawnSync(
      'node',
      [scriptPath, path.join(tempDir, 'missing-baseline.json'), path.join(tempDir, 'head.json')],
      { cwd: rootDir, encoding: 'utf8' },
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Could not read benchmark results');
  });
});

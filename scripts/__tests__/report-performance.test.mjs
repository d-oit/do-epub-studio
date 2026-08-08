import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('report-performance.mjs', () => {
  const scriptPath = path.resolve(__dirname, '../report-performance.mjs');
  const tempMetrics = path.resolve(__dirname, 'temp-metrics');
  const tempBaseline = path.resolve(__dirname, 'temp-baseline');
  const rootDir = path.resolve(__dirname, '../..');

  beforeEach(() => {
    if (!fs.existsSync(tempMetrics)) fs.mkdirSync(tempMetrics, { recursive: true });
    if (!fs.existsSync(tempBaseline)) fs.mkdirSync(tempBaseline, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempMetrics, { recursive: true, force: true });
    fs.rmSync(tempBaseline, { recursive: true, force: true });
    if (fs.existsSync('performance_report.md')) fs.unlinkSync('performance_report.md');
  });

  it('correctly calculates percentage change against baseline', () => {
    const currentBundle = {
      bundleSize: [
        { file: 'assets/index.js', size: 110, limit: 1000, passed: true }
      ]
    };
    const baselineBundle = {
      bundleSize: [
        { file: 'assets/index.js', size: 100, limit: 1000, passed: true }
      ]
    };

    fs.writeFileSync(path.join(tempMetrics, 'bundle-metrics.json'), JSON.stringify(currentBundle));
    fs.writeFileSync(path.join(tempBaseline, 'bundle-metrics.json'), JSON.stringify(baselineBundle));

    const result = spawnSync('node', [scriptPath, tempMetrics, tempBaseline], {
      cwd: rootDir,
      encoding: 'utf8'
    });

    expect(result.stdout).toContain('+10.00%');
    expect(result.stdout).toContain('⚠️'); // Significant increase
  });

  it('handles missing baseline gracefully', () => {
    const currentBundle = {
      bundleSize: [
        { file: 'assets/index.js', size: 100, limit: 1000, passed: true }
      ]
    };
    fs.writeFileSync(path.join(tempMetrics, 'bundle-metrics.json'), JSON.stringify(currentBundle));

    const result = spawnSync('node', [scriptPath, tempMetrics], {
      cwd: rootDir,
      encoding: 'utf8'
    });

    expect(result.stdout).toContain('NEW');
    expect(result.status).toBe(0);
  });

  it('includes Lighthouse scores when available', () => {
    const lighthouse = {
      performance: 0.95,
      accessibility: 0.85
    };
    fs.writeFileSync(path.join(tempMetrics, 'lighthouse-metrics.json'), JSON.stringify(lighthouse));

    const result = spawnSync('node', [scriptPath, tempMetrics], {
      cwd: rootDir,
      encoding: 'utf8'
    });

    expect(result.stdout).toContain('Lighthouse Scores');
    expect(result.stdout).toContain('95');
    expect(result.stdout).toContain('85');
    expect(result.stdout).toContain('⚠️'); // Score < 0.9
  });

  it('includes Turbo metrics with cache-hit ratio', () => {
    const turboMetrics = {
      timestamp: new Date().toISOString(),
      tasks: [
        { taskId: 'web#build', task: 'build', package: 'web', cacheStatus: 'HIT', duration: 1000, local: true, remote: false },
        { taskId: 'shared#build', task: 'build', package: 'shared', cacheStatus: 'MISS', duration: 2000, local: false, remote: false }
      ],
      cacheSummary: {
        hits: 1,
        misses: 1,
        total: 2,
        hitRatio: 50
      }
    };

    fs.writeFileSync(path.join(tempMetrics, 'turbo-metrics.json'), JSON.stringify(turboMetrics));

    const result = spawnSync('node', [scriptPath, tempMetrics], {
      cwd: rootDir,
      encoding: 'utf8'
    });

    expect(result.stdout).toContain('Turbo Task Performance');
    expect(result.stdout).toContain('web#build');
    expect(result.stdout).toContain('HIT');
    expect(result.stdout).toContain('MISS');
    expect(result.stdout).toContain('Cache Hit Ratio');
    expect(result.stdout).toContain('50%');
  });

  it('includes test metrics with flaky test detection', () => {
    const testMetrics = {
      timestamp: new Date().toISOString(),
      totalTests: 100,
      failedTests: 2,
      passedTests: 98,
      flakyTests: [
        { name: 'flaky test 1', suite: 'test-suite', type: 'vitest' },
        { name: 'flaky test 2', suite: 'test-suite', type: 'vitest' }
      ],
      flakyRate: 2.0,
      suites: []
    };

    fs.writeFileSync(path.join(tempMetrics, 'test-metrics.json'), JSON.stringify(testMetrics));

    const result = spawnSync('node', [scriptPath, tempMetrics], {
      cwd: rootDir,
      encoding: 'utf8'
    });

    expect(result.stdout).toContain('Test Stability');
    expect(result.stdout).toContain('Total Tests');
    expect(result.stdout).toContain('100');
    expect(result.stdout).toContain('Failed Tests');
    expect(result.stdout).toContain('2');
    expect(result.stdout).toContain('Flaky Tests Detected');
    expect(result.stdout).toContain('flaky test 1');
    expect(result.stdout).toContain('Flaky Rate');
    expect(result.stdout).toContain('2.00%');
  });

  it('shows trend data for Turbo metrics against baseline', () => {
    const currentTurbo = {
      timestamp: new Date().toISOString(),
      tasks: [
        { taskId: 'web#build', task: 'build', package: 'web', cacheStatus: 'HIT', duration: 1000, local: true, remote: false }
      ],
      cacheSummary: {
        hits: 1,
        misses: 0,
        total: 1,
        hitRatio: 100
      }
    };

    const baselineTurbo = {
      timestamp: new Date().toISOString(),
      tasks: [
        { taskId: 'web#build', task: 'build', package: 'web', cacheStatus: 'MISS', duration: 2000, local: false, remote: false }
      ],
      cacheSummary: {
        hits: 0,
        misses: 1,
        total: 1,
        hitRatio: 0
      }
    };

    fs.writeFileSync(path.join(tempMetrics, 'turbo-metrics.json'), JSON.stringify(currentTurbo));
    fs.writeFileSync(path.join(tempBaseline, 'turbo-metrics.json'), JSON.stringify(baselineTurbo));

    const result = spawnSync('node', [scriptPath, tempMetrics, tempBaseline], {
      cwd: rootDir,
      encoding: 'utf8'
    });

    expect(result.stdout).toContain('Turbo Task Performance');
    expect(result.stdout).toContain('-50.00%'); // Duration improved by 50%
    expect(result.stdout).toContain('✅'); // Cache status improved
  });

  it('shows trend data for test metrics against baseline', () => {
    const currentTest = {
      timestamp: new Date().toISOString(),
      totalTests: 100,
      failedTests: 1,
      passedTests: 99,
      flakyTests: [
        { name: 'flaky test 1', suite: 'test-suite', type: 'vitest' }
      ],
      flakyRate: 1.0,
      suites: []
    };

    const baselineTest = {
      timestamp: new Date().toISOString(),
      totalTests: 90,
      failedTests: 5,
      passedTests: 85,
      flakyTests: [
        { name: 'flaky test 1', suite: 'test-suite', type: 'vitest' },
        { name: 'flaky test 2', suite: 'test-suite', type: 'vitest' },
        { name: 'flaky test 3', suite: 'test-suite', type: 'vitest' },
        { name: 'flaky test 4', suite: 'test-suite', type: 'vitest' },
        { name: 'flaky test 5', suite: 'test-suite', type: 'vitest' }
      ],
      flakyRate: 5.56,
      suites: []
    };

    fs.writeFileSync(path.join(tempMetrics, 'test-metrics.json'), JSON.stringify(currentTest));
    fs.writeFileSync(path.join(tempBaseline, 'test-metrics.json'), JSON.stringify(baselineTest));

    const result = spawnSync('node', [scriptPath, tempMetrics, tempBaseline], {
      cwd: rootDir,
      encoding: 'utf8'
    });

    expect(result.stdout).toContain('Test Stability');
    expect(result.stdout).toContain('+11.11%'); // Total tests increased
    expect(result.stdout).toContain('-80.00%'); // Failed tests decreased
    expect(result.stdout).toContain('-82.01%'); // Flaky rate decreased
  });
});

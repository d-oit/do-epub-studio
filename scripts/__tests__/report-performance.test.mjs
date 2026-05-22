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
});

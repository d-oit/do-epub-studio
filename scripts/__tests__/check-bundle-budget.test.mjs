import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.resolve(__dirname, '../check-bundle-budget.mjs');
const rootDir = path.resolve(__dirname, '../..');
const tempDist = path.resolve(__dirname, 'temp-dist-budget');
const assetsDir = path.join(tempDist, 'assets');

function runScript(args = [], env = {}) {
  return spawnSync('node', [scriptPath, tempDist, ...args], {
    cwd: rootDir,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

describe('check-bundle-budget.mjs (ADR-107 §3)', () => {
  beforeEach(() => {
    fs.rmSync(tempDist, { recursive: true, force: true });
    fs.mkdirSync(assetsDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDist, { recursive: true, force: true });
  });

  it('reports OK when every file is within budget', () => {
    fs.writeFileSync(path.join(assetsDir, 'index-AAAA1111.js'), 'a'.repeat(1024));
    fs.writeFileSync(path.join(assetsDir, 'index-BBBB2222.css'), 'b'.repeat(512));

    const result = runScript();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('mainJs');
    expect(result.stdout).toContain('mainCss');
    expect(result.stdout).toMatch(/✅/);
    expect(result.stdout).toContain('All bundles within gzipped budget');
  });

  it('warns on main-JS budget violation but does not fail by default', () => {
    const random = crypto.randomBytes(500 * 1024);
    fs.writeFileSync(path.join(assetsDir, 'index-RAND0000.js'), random);

    const result = runScript();
    expect(result.status).toBe(0);
    const combined = (result.stdout || '') + (result.stderr || '');
    expect(combined).toContain('❌');
    expect(combined).toContain('not failing');
  });

  it('exits 1 on main-JS budget violation when BUNDLE_BUDGET_FAIL_ON_VIOLATION=1', () => {
    const random = crypto.randomBytes(500 * 1024);
    fs.writeFileSync(path.join(assetsDir, 'index-RAND0000.js'), random);

    const result = runScript([], { BUNDLE_BUDGET_FAIL_ON_VIOLATION: '1' });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('❌');
  });

  it('flags lazy-chunk > 80 KB gz', () => {
    const random = crypto.randomBytes(200 * 1024);
    fs.writeFileSync(path.join(assetsDir, 'admin-route-RAND0000.js'), random);

    const result = runScript([], { BUNDLE_BUDGET_FAIL_ON_VIOLATION: '1' });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('lazyChunkJs');
    expect(result.stdout).toContain('❌');
  });

  it('exits 2 when dist directory is missing', () => {
    fs.rmSync(tempDist, { recursive: true, force: true });
    const result = runScript();
    expect(result.status).toBe(2);
    expect(result.stdout + result.stderr).toMatch(/dist directory not found/);
  });

  // GOAP-224 B7: a baseline-delta violation must surface the growth table in
  // the report body (BUNDLE_BUDGET_REPORT), not just a bare violation count.
  it('folds the baseline delta table into the report on a violation (B7)', () => {
    const manifest = {
      'src/features/reader/ReaderPage.tsx': {
        file: 'assets/reader-route-INFLATED.js',
        isEntry: true,
        imports: [],
        css: [],
      },
    };
    fs.mkdirSync(path.join(tempDist, '.vite'), { recursive: true });
    fs.writeFileSync(path.join(tempDist, '.vite', 'manifest.json'), JSON.stringify(manifest));
    // 60KB of incompressible data => ~59KB gz, ~30KB over the baseline's ~29KB entry.
    fs.writeFileSync(
      path.join(assetsDir, 'reader-route-INFLATED.js'),
      crypto.randomBytes(60 * 1024),
    );

    const baselinePath = path.join(__dirname, 'temp-baseline-budget.json');
    fs.writeFileSync(
      baselinePath,
      JSON.stringify({
        routes: {
          reader: {
            entry: 'assets/reader-route-BASE.js',
            gzip: 29659,
            brotli: 25227,
            totalTransitive: { gzip: 262005, brotli: 227608 },
          },
        },
      }),
    );

    try {
      const reportPath = path.join(__dirname, 'temp-budget-report.md');
      const result = runScript([], {
        BUNDLE_BUDGET_BASELINE: baselinePath,
        BUNDLE_BUDGET_REPORT: reportPath,
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('### Baseline delta comparison');
      expect(result.stdout).toMatch(/reader \| -?[\d.]+ \| -?[\d.]+ \| -?[\d.]+% \| ❌/);

      const report = fs.readFileSync(reportPath, 'utf8');
      expect(report).toContain('### Bundle budget (gzipped + brotli) — ADR-107 §3');
      expect(report).toContain('### Baseline delta comparison');
      expect(report).toMatch(/reader \| -?[\d.]+ \| -?[\d.]+ \| -?[\d.]+% \| ❌/);

      fs.rmSync(reportPath, { force: true });
    } finally {
      fs.rmSync(baselinePath, { force: true });
    }
  });
});

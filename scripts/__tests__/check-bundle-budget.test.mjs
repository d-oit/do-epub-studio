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
});

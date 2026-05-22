import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('check-bundle-size.mjs', () => {
  const scriptPath = path.resolve(__dirname, '../check-bundle-size.mjs');
  const tempDist = path.resolve(__dirname, 'temp-dist');
  const rootDir = path.resolve(__dirname, '../..');

  beforeEach(() => {
    if (!fs.existsSync(tempDist)) fs.mkdirSync(tempDist, { recursive: true });
    const assetsDir = path.join(tempDist, 'assets');
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDist, { recursive: true, force: true });
  });

  it('identifies hashed Vite assets correctly', () => {
    // index.js limit is 500000 bytes (from .performance-budgets.json)
    const indexJs = path.join(tempDist, 'assets/index-ABC12345.js');
    fs.writeFileSync(indexJs, 'a'.repeat(100)); // 100 bytes

    const result = spawnSync('node', [scriptPath, tempDist], {
      cwd: rootDir,
      encoding: 'utf8'
    });

    expect(result.stdout).toContain('assets/index-ABC12345.js');
    expect(result.stdout).toContain('0.10'); // 100 bytes is ~0.10 KB
    expect(result.status).toBe(0);
  });

  it('exits with code 1 when a budget is exceeded', () => {
    const indexCss = path.join(tempDist, 'assets/index-DEF67890.css');
    // index.css limit is 100000 bytes
    fs.writeFileSync(indexCss, 'a'.repeat(100001));

    const result = spawnSync('node', [scriptPath, tempDist], {
      cwd: rootDir,
      encoding: 'utf8'
    });

    expect(result.stdout).toContain('❌');
    expect(result.status).toBe(1);
  });

  it('handles regex sanitization correctly', () => {
    // Test with a base name that has regex special characters if any
    // Our budgets are index.js, react-vendor.js, epubjs.js, index.css
    // None have special regex chars except dot, which is handled
    const vendorJs = path.join(tempDist, 'assets/react-vendor-GHI12345.js');
    fs.writeFileSync(vendorJs, 'a'.repeat(100));

    const result = spawnSync('node', [scriptPath, tempDist], {
      cwd: rootDir,
      encoding: 'utf8'
    });

    expect(result.stdout).toContain('assets/react-vendor-GHI12345.js');
    expect(result.status).toBe(0);
  });
});

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(__dirname, '../check-app-identity.mjs');

function runScript() {
  return spawnSync('node', [scriptPath], { encoding: 'utf8' });
}

describe('check-app-identity.mjs (ADR-104)', () => {
  it('passes on the current working tree', () => {
    const result = runScript();
    if (result.status !== 0) {
      console.error('STDOUT:', result.stdout);
      console.error('STDERR:', result.stderr);
    }
    expect(result.status).toBe(0);
  });

  it('reports canonical name + version on success', () => {
    const result = runScript();
    expect(result.stdout).toMatch(/d\.o\.EPUB Studio/);
    expect(result.stdout).toMatch(/VERSION:\s+0\.1\.1/);
  });
});

describe('VERSION ↔ package.json parity (ADR-104)', () => {
  const repoRoot = resolve(__dirname, '../..');
  const versionFile = readFileSync(resolve(repoRoot, 'VERSION'), 'utf8').trim();

  it('root package.json matches VERSION', () => {
    const rootPkg = JSON.parse(
      readFileSync(resolve(repoRoot, 'package.json'), 'utf8'),
    );
    expect(rootPkg.version).toBe(versionFile);
  });

  it('every per-package package.json matches VERSION', () => {
    const appsPkg = JSON.parse(
      readFileSync(resolve(repoRoot, 'apps/web/package.json'), 'utf8'),
    );
    const workerPkg = JSON.parse(
      readFileSync(resolve(repoRoot, 'apps/worker/package.json'), 'utf8'),
    );
    expect(appsPkg.version).toBe(versionFile);
    expect(workerPkg.version).toBe(versionFile);
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(__dirname, '../check-adr-index.mjs');
const repoRoot = resolve(__dirname, '../..');

/** The script joins `--file` with its own repoRoot, so pass a repo-relative path. */
function runScript(indexPath) {
  return spawnSync('node', [scriptPath, '--file', indexPath], {
    encoding: 'utf8',
    timeout: 30_000,
  });
}

describe('check-adr-index.mjs (ADR-083)', () => {
  const fixtureRel = '.tmp-adr-index-tests';
  const fixtureAbs = resolve(repoRoot, fixtureRel);

  beforeAll(() => {
    mkdirSync(fixtureAbs, { recursive: true });
  });

  afterAll(() => {
    rmSync(fixtureAbs, { recursive: true, force: true });
  });

  function writeIndex(md) {
    const rel = `${fixtureRel}/ADR-INDEX.md`;
    writeFileSync(resolve(fixtureAbs, 'ADR-INDEX.md'), md, 'utf8');
    return rel;
  }

  it(
    'passes on the current working tree',
    () => {
      const result = spawnSync('node', [scriptPath], {
        encoding: 'utf8',
        timeout: 30_000,
      });
      if (result.status !== 0) {
        console.error('STDOUT:', result.stdout);
        console.error('STDERR:', result.stderr);
      }
      expect(result.status).toBe(0);
    },
    30_000,
  );

  // The real index contains both ADR-244 and GOAP-244 sharing a number.
  // ADR-083 §2 says plan numbers and ADR numbers are siblings — this must
  // NOT be reported as a collision.
  it('accepts a matching GOAP plan + ADR sibling pair (ADR-083 §2)', () => {
    const realIndex = readFileSync(
      resolve(repoRoot, 'plans', 'ADR-INDEX.md'),
      'utf8',
    );
    const path = writeIndex(realIndex);

    const result = runScript(path);
    expect(result.stderr).not.toContain('Exact duplicate: ADR 244');
    expect(result.status).toBe(0);
  });

  it('rejects two ADRs that share an exact number', () => {
    const path = writeIndex(`# ADR Index

## Accepted

| Number | Title | File | Status |
| ------ | ----- | ---- | ------ |
| 300    | First ADR | \`plans/300-adr-first.md\` | Accepted |
| 300    | Second ADR | \`plans/300-adr-second.md\` | Accepted |
`);
    const result = runScript(path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Exact duplicate: ADR 300');
  });

  it('rejects three ADRs sharing a base number (collision suffix must differ from base)', () => {
    const path = writeIndex(`# ADR Index

## Accepted

| Number | Title | File | Status |
| ------ | ----- | ---- | ------ |
| 301    | First ADR | \`plans/301-adr-first.md\` | Accepted |
| 301a   | First collision | \`plans/301-adr-collision-a.md\` | Accepted |
| 301b   | Second collision | \`plans/301-adr-collision-b.md\` | Accepted |
`);
    const result = runScript(path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Duplicate ADR 301');
  });
});

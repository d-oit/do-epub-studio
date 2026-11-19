import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(__dirname, '../check-adr-index.mjs');
const repoRoot = resolve(__dirname, '../..');

/** The script joins `--file` with its root, so pass a root-relative path. */
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

  /** Runs against a throwaway fixture tree (`--root`). */
  function runRoot(root) {
    return spawnSync('node', [scriptPath, '--root', root], {
      encoding: 'utf8',
      timeout: 30_000,
    });
  }

  /** Writes a fixture tree; `files` maps fixture-relative paths to contents. */
  function writeTree(files) {
    rmSync(fixtureAbs, { recursive: true, force: true });
    mkdirSync(fixtureAbs, { recursive: true });
    for (const [rel, content] of Object.entries(files)) {
      const full = resolve(fixtureAbs, rel);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content, 'utf8');
    }
    return fixtureAbs;
  }

  it('passes on the current working tree', () => {
    const result = spawnSync('node', [scriptPath], {
      encoding: 'utf8',
      timeout: 30_000,
    });
    if (result.status !== 0) {
      console.error('STDOUT:', result.stdout);
      console.error('STDERR:', result.stderr);
    }
    expect(result.status).toBe(0);
  }, 30_000);

  // The real index contains both ADR-244 and GOAP-244 sharing a number.
  // ADR-083 §2 says plan numbers and ADR numbers are siblings — this must
  // NOT be reported as a collision.
  it('accepts a matching GOAP plan + ADR sibling pair (ADR-083 §2)', () => {
    const realIndex = readFileSync(resolve(repoRoot, 'plans', 'ADR-INDEX.md'), 'utf8');
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

  it('passes when every root numbered record appears in a File cell', () => {
    const root = writeTree({
      'plans/ADR-INDEX.md': `# ADR Index

## Accepted

| Number | Title | File | Status |
| ------ | ----- | ---- | ------ |
| 310    | Grounded | \`plans/310-adr-grounded.md\` | Accepted |
| 310b   | Collision | \`plans/310-adr-collision.md\` | Accepted |
`,
      'plans/310-adr-grounded.md': '# ADR-310: grounded\n\n**Status:** Accepted\n',
      'plans/310-adr-collision.md': '# ADR-310: collision\n\n**Status:** Accepted\n',
      'plans/311-goap-work.md': '# GOAP-311\n\n**Status:** COMPLETE\n',
    });
    // The GOAP record is referenced from its own cross-referenced row.
    writeFileSync(
      resolve(root, 'plans/ADR-INDEX.md'),
      `${readFileSync(resolve(root, 'plans/ADR-INDEX.md'), 'utf8')}
## Cross-referenced (archived GOAP execution records)

| Number | Title | File | Notes |
| ------ | ----- | ---- | ----- |
| 311    | Work | \`plans/311-goap-work.md\` | COMPLETE |
`,
      'utf8',
    );
    const result = runRoot(root);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  it('fails on a root ADR record with no index row', () => {
    const root = writeTree({
      'plans/ADR-INDEX.md': `# ADR Index

## Accepted

| Number | Title | File | Status |
| ------ | ----- | ---- | ------ |
| 310    | Grounded | \`plans/310-adr-grounded.md\` | Accepted |
`,
      'plans/310-adr-grounded.md': '# ADR-310\n\n**Status:** Accepted\n',
      'plans/312-adr-unindexed.md': '# ADR-312\n\n**Status:** Accepted\n',
    });
    const result = runRoot(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Unindexed record: plans/312-adr-unindexed.md');
  });

  it('fails on a root GOAP record with no index row', () => {
    const root = writeTree({
      'plans/ADR-INDEX.md': `# ADR Index

## Accepted

| Number | Title | File | Status |
| ------ | ----- | ---- | ------ |
| 310    | Grounded | \`plans/310-adr-grounded.md\` | Accepted |
`,
      'plans/310-adr-grounded.md': '# ADR-310\n\n**Status:** Accepted\n',
      'plans/313-goap-unindexed.md': '# GOAP-313\n\n**Status:** COMPLETE\n',
    });
    const result = runRoot(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Unindexed record: plans/313-goap-unindexed.md');
  });

  it('fails when a multi-file row names a record that is missing', () => {
    const root = writeTree({
      'plans/ADR-INDEX.md': `# ADR Index

## Accepted

| Number | Title | File | Status |
| ------ | ----- | ---- | ------ |
| 314    | Pair | \`plans/314-adr-a.md\`, \`plans/314-goap-b.md\` | Accepted |
`,
      'plans/314-adr-a.md': '# ADR-314\n\n**Status:** Accepted\n', // plan-refs: ignore
    });
    const result = runRoot(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('File not found: plans/314-goap-b.md');
  });

  it('fails when a finished ADR is parked under Proposed', () => {
    const root = writeTree({
      'plans/ADR-INDEX.md': `# ADR Index

## Proposed

| Number | Title | File | Status |
| ------ | ----- | ---- | ------ |
| 999    | Contract | \`plans/999-adr-contract.md\` | Accepted (2026-09-29) |
`,
      'plans/999-adr-contract.md': '# ADR-999\n\n**Status:** Accepted\n',
    });
    const result = runRoot(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('listed under "Proposed" but its status says finished');
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

  it('keeps cell positions when a column is empty', () => {
    const root = writeTree({
      'plans/ADR-INDEX.md': `# ADR Index

## Accepted

| Number | Title | File | Status |
| ------ | ----- | ---- | ------ |
| 315    | Empty status | \`plans/315-adr-missing.md\` | |
`,
    });
    const result = runRoot(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('File not found: plans/315-adr-missing.md');
    expect(result.stderr).not.toContain('Stale status');
  });

  it('passes with an empty status cell when the referenced file exists', () => {
    const root = writeTree({
      'plans/ADR-INDEX.md': `# ADR Index

## Accepted

| Number | Title | File | Status |
| ------ | ----- | ---- | ------ |
| 316    | Empty status | \`plans/316-adr-ok.md\` | |
`,
      'plans/316-adr-ok.md': '# ADR-316\n\n**Status:** Accepted\n', // plan-refs: ignore
    });
    const result = runRoot(root);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  it('fails on rows with missing or extra cells', () => {
    const root = writeTree({
      'plans/ADR-INDEX.md': `# ADR Index

## Accepted

| Number | Title | File | Status |
| ------ | ----- | ---- | ------ |
| 317    | Too few | |
| 318    | a | b | c | d | e |
`,
    });
    const result = runRoot(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('has 3 column(s), expected 4');
    expect(result.stderr).toContain('has 6 column(s), expected 4');
  });

  it('fails when a table has no separator row', () => {
    const root = writeTree({
      'plans/ADR-INDEX.md': `# ADR Index

## Accepted

| Number | Title | File | Status |
| 319    | No separator | \`plans/319-adr-x.md\` | Accepted |
`,
    });
    const result = runRoot(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Malformed table in "Accepted"');
  });
  it('rejects a separator whose column shape does not match the header', () => {
    const root = writeTree({
      'plans/ADR-INDEX.md': `# ADR Index

## Accepted

| Number | Title | File | Status |
| ------ | ----- |
| 320    | Broken | \`plans/320-adr-broken.md\` | Accepted |
`,
    });
    const result = runRoot(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Malformed table in "Accepted"');
  });

  it('counts escaped and inline-code pipes inside a title as cell content', () => {
    const root = writeTree({
      'plans/ADR-INDEX.md': `# ADR Index

## Accepted

| Number | Title | File | Status |
| ------ | ----- | ---- | ------ |
| 320    | Escaped \\| and \`code|pipe\` | \`plans/320-adr-pipes.md\` | Accepted |
`,
      'plans/320-adr-pipes.md': '# ADR-320: table parsing\n\n**Status:** Accepted\n', // plan-refs: ignore
    });
    const result = runRoot(root);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  it('treats OPEN as an active index status when the record is finished', () => {
    const root = writeTree({
      'plans/ADR-INDEX.md': `# ADR Index

## Cross-referenced (archived GOAP execution records)

| Number | Title | File | Notes |
| ------ | ----- | ---- | ----- |
| 321    | Open plan | \`plans/321-goap-open-plan.md\` | OPEN |
`,
      'plans/321-goap-open-plan.md': '# GOAP-321\n\n**Status:** Completed\n', // plan-refs: ignore
    });
    const result = runRoot(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Stale status for 321');
  });
});

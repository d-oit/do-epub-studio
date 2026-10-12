import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(__dirname, '../check-plan-references.mjs');
const repoRoot = resolve(__dirname, '../..');

function runScript(root) {
  const args = [scriptPath];
  if (root) args.push('--root', root);
  return spawnSync('node', args, { encoding: 'utf8', timeout: 30_000 });
}

describe('check-plan-references.mjs (ADR-083)', () => {
  const fixtureRel = '.tmp-plan-ref-tests';
  const fixtureAbs = resolve(repoRoot, fixtureRel);

  beforeAll(() => {
    rmSync(fixtureAbs, { recursive: true, force: true });
    mkdirSync(fixtureAbs, { recursive: true });
  });

  afterAll(() => {
    rmSync(fixtureAbs, { recursive: true, force: true });
  });

  /**
   * Builds a fixture tree. `files` maps fixture-relative paths to contents; the
   * plans/ ADR-INDEX.md is written from `index` (pass '' to omit it).
   */
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

  const ADR_INDEX = [
    '| Number | Title | File | Status |',
    '| ------ | ----- | ---- | ------ |',
    '| 042    | In-document sample | `plans/042-goap-sample.md` | COMPLETED |',
    '| 201    | WebKit smoke CI | `plans/ADR-201-webkit-smoke-ci.md` | Accepted |',
  ].join('\n');

  it('passes on the current working tree', () => {
    const result = runScript();
    if (result.status !== 0) {
      console.error('STDOUT:', result.stdout);
      console.error('STDERR:', result.stderr);
    }
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Plan references resolve');
  }, 30_000);

  it('accepts a plan-record ADR, a legacy ADR-<n> filename and a matching GOAP plan', () => {
    const root = writeTree({
      'plans/ADR-INDEX.md': ADR_INDEX,
      'plans/300-adr-scoped-config.md': '# ADR-300: scoped config\n',
      'plans/ADR-201-webkit-smoke-ci.md': '# ADR-201: WebKit smoke CI\n',
      'plans/302-goap-annotation-slice.md': '# GOAP-302\n',
      'apps/web/src/some-file.ts': '// ADR-300 governs this; GOAP-302 delivered it.\n',
    });

    const result = runScript(root);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  it('fails on an ADR citation with no record and no index row', () => {
    const root = writeTree({
      'plans/ADR-INDEX.md': ADR_INDEX,
      'docs/offline.md': 'The offline/PWA layer (ADR-005, ADR-124) never activated.\n', // plan-refs: ignore
    });

    const result = runScript(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('ADR-124'); // plan-refs: ignore
    expect(result.stderr).toContain('docs/offline.md:1');
  });

  it('fails on a GOAP citation in code that names no plan file', () => {
    const root = writeTree({
      'plans/ADR-INDEX.md': ADR_INDEX,
      'apps/web/src/lib/ai/registry.ts': '* AI plugin registry (issue #318, GOAP-318).\n', // plan-refs: ignore
    });

    const result = runScript(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('GOAP-318'); // plan-refs: ignore
  });

  it('tolerates an issue-numbered GOAP title inside plans/ (a name, not a citation)', () => {
    const root = writeTree({
      'plans/ADR-INDEX.md': ADR_INDEX,
      'plans/archive/262-goap-issue-318.md': '# GOAP-318 — AI plugin architecture\n', // plan-refs: ignore
    });

    const result = runScript(root);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  it('skips a line marked with the ignore marker', () => {
    const root = writeTree({
      'plans/ADR-INDEX.md': ADR_INDEX,
      'agents-docs/LEARNINGS.md':
        'Two ADRs were cited but never written (ADR-124, ADR-219). <!-- plan-refs: ignore -->\n',
    });

    const result = runScript(root);
    expect(result.status).toBe(0);
  });

  it('does not treat an in-document ADR heading or its anchor link as a citation', () => {
    const root = writeTree({
      'plans/ADR-INDEX.md': ADR_INDEX,
      'plans/archive/042-goap-ci-pnpm-fix.md': [
        '- **ADR**: [ADR-042](#adr-042-fix-pnpm-execution-failure-in-github-actions)',
        '',
        '## ADR-042: Fix pnpm execution failure in GitHub Actions', // plan-refs: ignore
        '',
      ].join('\n'),
    });

    const result = runScript(root);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });
});

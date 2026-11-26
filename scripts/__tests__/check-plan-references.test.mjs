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
      'plans/300-adr-scoped-config.md': '# ADR-300: scoped config\n', // plan-refs: ignore
      'plans/ADR-201-webkit-smoke-ci.md': '# ADR-201: WebKit smoke CI\n',
      'plans/302-goap-annotation-slice.md': '# GOAP-302\n', // plan-refs: ignore
      'apps/web/src/some-file.ts': '// ADR-300 governs this; GOAP-302 delivered it.\n', // plan-refs: ignore
    });

    const result = runScript(root);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  // Rule 4: local record-to-record links inside plans/ must resolve, because a
  // bulk archive pass is exactly what breaks them silently.
  it('accepts same-directory and parent-directory record links', () => {
    const root = writeTree({
      'plans/ADR-INDEX.md': ADR_INDEX,
      'plans/320-goap-linking.md': [
        '# GOAP-320', // plan-refs: ignore
        '',
        'Sibling: [peer](320-adr-peer.md).',
        'Parent: [index](ADR-INDEX.md#accepted).',
        'Nested: [child](archive/002-adr-old.md).',
      ].join('\n'),
      'plans/320-adr-peer.md': '# ADR-320\n', // plan-refs: ignore
      'plans/archive/002-adr-old.md': '# ADR-002\n',
      'plans/sub/325-goap-nested.md': '# GOAP-325\n\nSee [peer](../320-adr-peer.md).\n', // plan-refs: ignore
    });
    const result = runScript(root);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  it('fails on a local record link whose target does not exist', () => {
    const root = writeTree({
      'plans/ADR-INDEX.md': ADR_INDEX,
      'plans/321-goap-linking.md': '# GOAP-321\n\nSee [gone](321-adr-gone.md).\n', // plan-refs: ignore
    });
    const result = runScript(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'plans/321-goap-linking.md:3: linked record not found: 321-adr-gone.md',
    );
  });

  it('resolves angle-bracket targets and ignores remote, absolute and fragment links', () => {
    const root = writeTree({
      'plans/ADR-INDEX.md': ADR_INDEX,
      'plans/322-goap-linking.md': [
        '# GOAP-322', // plan-refs: ignore
        '',
        'Exists: [peer](<322-adr-peer.md>).',
        'Missing but angle-wrapped: [gone](<322-adr-gone.md>).',
      ].join('\n'),
      'plans/322-adr-peer.md': '# ADR-322\n', // plan-refs: ignore
      'plans/323-goap-remote.md': [
        '# GOAP-323', // plan-refs: ignore
        '',
        'Remote: [site](https://example.com/notes.md).',
        'Absolute: [root](/plans/404-adr-absent.md).',
        'Anchor only: [top](#purpose).',
        'Mailto: [mail](mailto:someone@example.com).',
      ].join('\n'),
    });
    const result = runScript(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('linked record not found: 322-adr-gone.md');
    expect(result.stderr).not.toContain('404-adr-absent.md');
    expect(result.stderr).not.toContain('example.com');
    expect(result.stderr).not.toContain('323-goap-remote.md');
  });

  it('ignores link-shaped text inside fences and inline code', () => {
    const root = writeTree({
      'plans/ADR-INDEX.md': ADR_INDEX,
      'plans/324-goap-examples.md': [
        '# GOAP-324', // plan-refs: ignore
        '',
        '```markdown',
        '[example](324-adr-in-fence.md)',
        '```',
        '',
        'Inline: `[example](324-adr-inline.md)` and `plans/324-adr-absent.md`.',
      ].join('\n'),
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
  it('preserves diagnostic line numbers across fenced code blocks', () => {
    const root = writeTree({
      'plans/ADR-INDEX.md': ADR_INDEX,
      'plans/327-goap-fenced-lines.md': [
        '# GOAP-327', // plan-refs: ignore
        '',
        '```markdown',
        '[gone](327-adr-fence.md)',
        '```',
        '',
        'See [missing](327-adr-gone.md).',
      ].join('\n'),
    });
    const result = runScript(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'plans/327-goap-fenced-lines.md:7: linked record not found: 327-adr-gone.md',
    );
    expect(result.stderr).not.toContain('327-adr-fence.md');
  });

  it('honors the ignore marker only on its own line', () => {
    const root = writeTree({
      'plans/ADR-INDEX.md': ADR_INDEX,
      'plans/328-goap-ignore-line.md': [
        '# GOAP-328', // plan-refs: ignore
        '',
        'Broken [link](328-adr-absent.md). <!-- plan-refs: ignore -->',
        'Still broken [link](328-adr-gone.md).',
      ].join('\n'),
    });
    const result = runScript(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'plans/328-goap-ignore-line.md:4: linked record not found: 328-adr-gone.md',
    );
    expect(result.stderr).not.toContain('328-adr-absent.md');
  });

  it('reports malformed URI escapes without crashing', () => {
    const root = writeTree({
      'plans/ADR-INDEX.md': ADR_INDEX,
      'plans/329-goap-bad-escape.md': '# GOAP-329\n\nSee [bad](foo%zz.md).\n', // plan-refs: ignore
    });
    const result = runScript(root);
    expect(result.stderr).toContain('malformed URI escape: foo%zz.md');
    expect(result.stderr).not.toContain('URIError');
  });
});

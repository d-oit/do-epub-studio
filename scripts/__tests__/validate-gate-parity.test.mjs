import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(__dirname, '../validate-gate-parity.mjs');

function runRoot(root) {
  return spawnSync('node', [scriptPath, '--root', root], {
    encoding: 'utf8',
    timeout: 30_000,
  });
}

function manifest({
  prChecks = [],
  external = [],
  releaseChecks = [],
  requiredSteps = [],
  readinessJob = 'release-readiness',
} = {}) {
  return JSON.stringify(
    {
      $schema: 'test fixture',
      version: 1,
      local: { checks: [] },
      pr: { checks: prChecks, ...(external.length ? { external } : {}) },
      release: {
        checks: releaseChecks,
        readinessJob,
        requiredSteps,
      },
    },
    null,
    2,
  );
}

const MINIMAL_RELEASE = `name: Release
jobs:
  release-readiness:
    name: Release Readiness Gate
    steps:
      - name: Verify tag matches VERSION file
        run: echo ok
      - name: Verify tag is on main branch
        run: echo ok
      - name: Verify CI checks passed
        run: echo ok
`;

describe('validate-gate-parity.mjs (parser-backed job/step matching)', () => {
  let fixtureAbs;

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

  beforeAll(() => {
    fixtureAbs = mkdtempSync(join(tmpdir(), 'gate-parity-tests-'));
  });

  afterAll(() => {
    rmSync(fixtureAbs, { recursive: true, force: true });
  });

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

  it('rejects empty required obligation groups', () => {
    const base = JSON.parse(
      manifest({
        prChecks: ['PR Gate'],
        releaseChecks: ['Release Readiness Gate'],
        requiredSteps: ['Verify release step'],
      }),
    );
    base.local.checks = ['quality gate'];

    for (const [section, key] of [
      ['local', 'checks'],
      ['pr', 'checks'],
      ['release', 'checks'],
      ['release', 'requiredSteps'],
    ]) {
      const value = JSON.parse(JSON.stringify(base));
      value[section][key] = [];
      const root = writeTree({
        'scripts/gate-manifest.json': JSON.stringify(value),
      });
      const result = runRoot(root);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        `gate manifest "${section}.${key}" must be a non-empty array of strings`,
      );
    }
  });

  it('does not let a step name satisfy a missing job check', () => {
    const root = writeTree({
      'scripts/gate-manifest.json': manifest({ prChecks: ['Some Required Job'] }),
      '.github/workflows/fake.yml': `name: Fake
jobs:
  other:
    name: Other Job
    steps:
      - name: Some Required Job
        run: echo this is only a step
`,
      '.github/workflows/release.yml': MINIMAL_RELEASE,
    });
    const result = runRoot(root);
    expect(result.status).not.toBe(0);
  });

  it('does not let a comment satisfy a job check', () => {
    const root = writeTree({
      'scripts/gate-manifest.json': manifest({ prChecks: ['Full Quality Gate'] }),
      '.github/workflows/fake.yml': `name: Fake
# Full Quality Gate runs nowhere in this fixture
jobs:
  trivial:
    name: Trivial Job
    steps:
      - run: echo hi
`,
      '.github/workflows/release.yml': MINIMAL_RELEASE,
    });
    const result = runRoot(root);
    expect(result.status).not.toBe(0);
  });

  it('resolves explicitly declared external app checks (Codacy)', () => {
    const root = writeTree({
      'scripts/gate-manifest.json': manifest({
        prChecks: ['Codacy Static Code Analysis'],
        external: ['Codacy Static Code Analysis'],
      }),
      '.github/workflows/fake.yml': `name: Fake
jobs:
  trivial:
    name: Trivial Job
    steps:
      - run: echo hi
`,
      '.github/workflows/release.yml': MINIMAL_RELEASE,
    });
    const result = runRoot(root);
    expect(result.status).toBe(0);
  });

  it('does not let an external-app name satisfy a check when undeclared', () => {
    const root = writeTree({
      'scripts/gate-manifest.json': manifest({
        prChecks: ['Codacy Static Code Analysis'],
        external: [],
      }),
      '.github/workflows/fake.yml': `name: Fake
jobs:
  trivial:
    name: Trivial Job
    steps:
      - run: echo hi
`,
      '.github/workflows/release.yml': MINIMAL_RELEASE,
    });
    const result = runRoot(root);
    expect(result.status).not.toBe(0);
  });

  it('does not let a release readiness step satisfy a job-level release check', () => {
    const root = writeTree({
      'scripts/gate-manifest.json': manifest({ releaseChecks: ['Verify CI checks passed'] }),
      '.github/workflows/fake.yml': `name: Fake
jobs:
  trivial:
    name: Trivial Job
    steps:
      - run: echo hi
`,
      '.github/workflows/release.yml': MINIMAL_RELEASE,
    });
    const result = runRoot(root);
    expect(result.status).not.toBe(0);
  });

  it('does not let a non-release job satisfy a release claim', () => {
    const root = writeTree({
      'scripts/gate-manifest.json': manifest({ releaseChecks: ['Full Quality Gate'] }),
      '.github/workflows/ci.yml': `name: CI
jobs:
  quality-gate:
    name: Full Quality Gate
    steps:
      - run: echo
`,
      '.github/workflows/release.yml': `name: Release
jobs:
  verify:
    name: Verify
    steps:
      - run: echo ok
`,
    });
    const result = runRoot(root);
    expect(result.status).not.toBe(0);
  });
  it('fails when a required release step is removed from release-readiness', () => {
    const root = writeTree({
      'scripts/gate-manifest.json': manifest({
        releaseChecks: [],
        requiredSteps: [
          'Verify tag matches VERSION file',
          'Verify tag is on main branch',
          'Verify CI checks passed',
        ],
      }),
      '.github/workflows/fake.yml': `name: Fake
jobs:
  trivial:
    name: Trivial Job
    steps:
      - run: echo hi
`,
      '.github/workflows/release.yml': `name: Release
jobs:
  release-readiness:
    name: Release Readiness Gate
    steps:
      - name: Verify tag matches VERSION file
        run: echo ok
      - name: Verify tag is on main branch
        run: echo ok
`,
    });
    const result = runRoot(root);
    expect(result.status).not.toBe(0);
  });

  it('does not let another job provide a required release-readiness step', () => {
    const root = writeTree({
      'scripts/gate-manifest.json': manifest({
        releaseChecks: [],
        requiredSteps: ['Verify CI checks passed'],
      }),
      '.github/workflows/release.yml': `name: Release
jobs:
  release-readiness:
    name: Release Readiness Gate
    steps: []
  unrelated:
    name: Unrelated Job
    steps:
      - name: Verify CI checks passed
        run: echo ok
`,
    });
    const result = runRoot(root);
    expect(result.status).not.toBe(0);
  });

  it('fails when the release-readiness job itself is missing', () => {
    const root = writeTree({
      'scripts/gate-manifest.json': manifest({
        releaseChecks: [],
        requiredSteps: ['Verify CI checks passed'],
      }),
      '.github/workflows/fake.yml': `name: Fake
jobs:
  trivial:
    name: Trivial Job
    steps:
      - run: echo hi
`,
      '.github/workflows/release.yml': `name: Release
jobs:
  verify:
    name: Verify (Node \${{ matrix.node-version }})
    strategy:
      matrix:
        node-version: [22, 24]
    steps:
      - run: echo ok
`,
    });
    const result = runRoot(root);
    expect(result.status).not.toBe(0);
  });

  it('expands matrix job names to real per-node check contexts', () => {
    const root = writeTree({
      'scripts/gate-manifest.json': manifest({ prChecks: ['Lint (Node 22)', 'Lint (Node 24)'] }),
      '.github/workflows/ci.yml': `name: CI
jobs:
  lint:
    name: Lint (Node \${{ matrix.node-version }})
    strategy:
      matrix:
        node-version: [22, 24]
    steps:
      - name: Lint
        run: echo
`,
      '.github/workflows/release.yml': MINIMAL_RELEASE,
    });
    const result = runRoot(root);
    expect(result.status).toBe(0);
  });

  it('rejects a matrix claim that expands to no real context', () => {
    const root = writeTree({
      'scripts/gate-manifest.json': manifest({ prChecks: ['Lint (Node 99)'] }),
      '.github/workflows/ci.yml': `name: CI
jobs:
  lint:
    name: Lint (Node \${{ matrix.node-version }})
    strategy:
      matrix:
        node-version: [22, 24]
    steps:
      - name: Lint
        run: echo
`,
      '.github/workflows/release.yml': MINIMAL_RELEASE,
    });
    const result = runRoot(root);
    expect(result.status).not.toBe(0);
  });

  it('requires exact normalized equality, not substring containment', () => {
    const root = writeTree({
      'scripts/gate-manifest.json': manifest({ prChecks: ['Lint'] }),
      '.github/workflows/ci.yml': `name: CI
jobs:
  lint:
    name: Lint (Node 22)
    steps:
      - name: Lint
        run: echo
`,
      '.github/workflows/release.yml': MINIMAL_RELEASE,
    });
    const result = runRoot(root);
    expect(result.status).not.toBe(0);
  });

  it('fails closed on an unparseable workflow', () => {
    const root = writeTree({
      'scripts/gate-manifest.json': manifest(),
      '.github/workflows/broken.yml': 'name: Broken\njobs:\n  bad: [unclosed\n',
      '.github/workflows/release.yml': MINIMAL_RELEASE,
    });
    const result = runRoot(root);
    expect(result.status).not.toBe(0);
  });

  it('fails closed on a malformed manifest', () => {
    const root = writeTree({
      'scripts/gate-manifest.json': '{ this is not json',
      '.github/workflows/fake.yml': `name: Fake
jobs:
  trivial:
    name: Trivial Job
    steps:
      - run: echo hi
`,
      '.github/workflows/release.yml': MINIMAL_RELEASE,
    });
    const result = runRoot(root);
    expect(result.status).not.toBe(0);
  });

  it('fails closed when the workflows directory is missing', () => {
    const root = writeTree({
      'scripts/gate-manifest.json': manifest(),
    });
    const result = runRoot(root);
    expect(result.status).not.toBe(0);
  });
});

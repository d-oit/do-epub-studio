/**
 * Tests for the do-harness selection engine (issue #1492).
 *
 * No network, no real git: changed paths are always supplied explicitly as
 * fixture lists. Drift tests run the consistency validator against temporary
 * copies of the manifest / sensor pack. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, copyFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  loadManifest,
  loadProfiles,
  loadSensorPack,
  matchGlob,
  planFromPaths,
  formatText,
} from '../harness/engine.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const validatorPath = resolve(repoRoot, 'scripts/harness/check-profiles-consistency.mjs');

const profiles = loadProfiles(repoRoot);
const manifest = loadManifest(repoRoot);
const sensorPack = loadSensorPack(repoRoot);

function planFor(paths, options = {}) {
  return planFromPaths({ changedPaths: paths, profiles, manifest, sensorPack, options });
}

function runValidator({ root, manifestRel, sensorsRel, profilesRel }) {
  const args = [validatorPath, '--root', root];
  if (manifestRel) args.push('--manifest', manifestRel);
  if (sensorsRel) args.push('--sensors', sensorsRel);
  if (profilesRel) args.push('--profiles', profilesRel);
  args.push('--skills-dir', resolve(repoRoot, '.agents/skills'));
  return spawnSync('node', args, { encoding: 'utf8', timeout: 30_000 });
}

describe('matchGlob', () => {
  it('matches ** recursing and zero-length', () => {
    expect(matchGlob('packages/reader-core/**', 'packages/reader-core/src/epub-parser.ts')).toBe(
      true,
    );
    expect(matchGlob('packages/reader-core/**', 'packages/reader-core')).toBe(true);
    expect(matchGlob('packages/reader-core/**', 'packages/reader-core/package.json')).toBe(true);
  });
  it('rejects non-matching paths', () => {
    expect(matchGlob('packages/reader-core/**', 'packages/shared/src/epub-validator.ts')).toBe(
      false,
    );
    expect(matchGlob('apps/worker/**', 'apps/web/src/index.ts')).toBe(false);
  });
  it('matches single-segment * wildcards', () => {
    expect(matchGlob('scripts/seed-*.mjs', 'scripts/seed-demo-accounts.mjs')).toBe(true);
    expect(matchGlob('scripts/seed-*.mjs', 'scripts/lib/demo-sample.mjs')).toBe(false);
    expect(matchGlob('apps/web/src/**/*.tsx', 'apps/web/src/components/ReaderFooter.tsx')).toBe(
      true,
    );
  });
});

describe('sensor profile selection', () => {
  it('schema-only change selects worker + web + E2E consumers', () => {
    const plan = planFor(['packages/schema/src/dtos.ts']);
    const ids = plan.selection.profiles.map((p) => p.id);
    expect(ids).toEqual(['worker-api', 'pwa-offline', 'integration-e2e']);
    const sensorIds = plan.selection.sensors.map((s) => s.id);
    expect(sensorIds).toContain('typecheck');
    expect(sensorIds).toContain('lint');
    expect(sensorIds).toContain('test-unit');
    expect(sensorIds).toContain('bundle');
    expect(sensorIds).toContain('web-ui-tests');
    // Schema itself is not a profile; no reader-core or docs sensors.
    expect(sensorIds).not.toContain('skills');
    expect(sensorIds).not.toContain('a11y');
    expect(plan.selection.dependencies.some((d) => d.id === 'schema')).toBe(true);
  });

  it('reader-core change selects its consumers plus the core profile', () => {
    const plan = planFor(['packages/reader-core/src/epub-parser.ts']);
    const ids = plan.selection.profiles.map((p) => p.id);
    expect(ids).toEqual(['reader-core', 'worker-api', 'pwa-offline', 'integration-e2e']);
    const sensorIds = plan.selection.sensors.map((s) => s.id);
    expect(sensorIds).toContain('typecheck');
    // PWA consumer arrives via the reader-core dependency edge (pulls bundle);
    // the accessibility profile needs a web UI path, so a11y stays out.
    expect(sensorIds).toContain('bundle');
    expect(sensorIds).not.toContain('a11y');
  });

  it('docs change selects the docs sensor profile', () => {
    const plan = planFor(['agents-docs/LEARNINGS.md']);
    expect(plan.selection.profiles.map((p) => p.id)).toEqual(['docs-skills']);
    const sensorIds = plan.selection.sensors.map((s) => s.id);
    expect(sensorIds).toContain('skills');
    expect(sensorIds).toContain('agent-sync');
    expect(sensorIds).toContain('llms-drift');
    expect(sensorIds).not.toContain('typecheck');
    expect(sensorIds).not.toContain('a11y');
  });

  it('UI source change selects accessibility profile together with PWA', () => {
    const plan = planFor(['apps/web/src/features/reader/components/ReaderShell.tsx']);
    const ids = plan.selection.profiles.map((p) => p.id);
    expect(ids).toContain('pwa-offline');
    expect(ids).toContain('accessibility');
    const sensorIds = plan.selection.sensors.map((s) => s.id);
    expect(sensorIds).toContain('a11y');
    expect(sensorIds).toContain('viewport-ux');
  });

  it('authoring/export paths select the authoring profile', () => {
    const plan = planFor([
      'scripts/seed-demo-accounts.mjs',
      'packages/reader-core/src/packager/annotation-export-render.ts',
    ]);
    expect(plan.selection.profiles.map((p) => p.id)).toContain('authoring-export');
    expect(plan.selection.skills.some((s) => s.id === 'dogfood')).toBe(true);
  });
});

describe('determinism and skip semantics', () => {
  it('produces identical plans regardless of input order', () => {
    const a = planFor([
      'apps/web/src/index.ts',
      'packages/schema/src/dtos.ts',
      'agents-docs/LEARNINGS.md',
    ]);
    const b = planFor([
      'agents-docs/LEARNINGS.md',
      'apps/web/src/index.ts',
      'packages/schema/src/dtos.ts',
    ]);

    expect(JSON.stringify(a.selection)).toBe(JSON.stringify(b.selection));
    expect(JSON.stringify(a.commands)).toBe(JSON.stringify(b.commands));
    expect(JSON.stringify(a.skipped)).toBe(JSON.stringify(b.skipped));
    expect(a.changedPaths).toEqual(b.changedPaths);
  });

  it('skips unselected sensors with a reason and never lists selected ones', () => {
    const plan = planFor(['agents-docs/LEARNINGS.md']);
    const sel = new Set(plan.selection.sensors.map((s) => s.id));
    expect(plan.skipped.length).toBeGreaterThan(0);
    for (const s of plan.skipped) {
      expect(sel.has(s.id)).toBe(false);
      expect(s.reason).toMatch(/no matching changed path/);
    }
    expect(plan.skipped.some((s) => s.id === 'a11y')).toBe(true);
    expect(plan.skipped.some((s) => s.id === 'console')).toBe(true);
  });

  it('skip list shrinks when the sensor is actually selected', () => {
    const plan = planFor(['apps/web/src/features/reader/components/ReaderShell.tsx']);
    expect(plan.skipped.some((s) => s.id === 'a11y')).toBe(false);
    expect(plan.selection.sensors.some((s) => s.id === 'a11y')).toBe(true);
  });
});

describe('verification level and disclaimer', () => {
  it('docs-only plan is fast feedback with an explicit disclaimer', () => {
    const plan = planFor(['agents-docs/LEARNINGS.md']);
    expect(plan.verificationLevel).toBe('fast');
    expect(plan.disclaimer).toMatch(/NOT full release verification/);
    expect(formatText(plan)).toContain('NOT full release verification');
  });

  it('browser/build sensors mark a plan as integration verification', () => {
    const plan = planFor(['packages/schema/src/dtos.ts']);
    expect(plan.verificationLevel).toBe('integration');
    expect(plan.disclaimer).toBeTruthy();
  });

  it('--release closes the gate gap and removes the disclaimer', () => {
    const plan = planFor(['packages/schema/src/dtos.ts'], { release: true });
    expect(plan.verificationLevel).toBe('release');
    expect(plan.disclaimer).toBeNull();
    expect(plan.selection.releaseGapChecks).toContain('gate-parity');
    const allChecks = new Set(manifest.local.checks);
    expect(plan.selection.releaseGapChecks.length).toBe(
      allChecks.size - plan.selection.gateChecks.length,
    );
  });
});

describe('consistency validator (drift guard)', () => {
  let tmp;
  beforeAll(() => {
    tmp = resolve(repoRoot, '.tmp-harness-consistency');
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp, { recursive: true });
    copyFileSync(resolve(repoRoot, 'scripts/harness/profiles.json'), resolve(tmp, 'profiles.json'));
    copyFileSync(resolve(repoRoot, 'do-harness.toml'), resolve(tmp, 'do-harness.toml'));
    copyFileSync(
      resolve(repoRoot, 'scripts/gate-manifest.json'),
      resolve(tmp, 'gate-manifest.json'),
    );
  });
  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  const run = (manifestRel) =>
    runValidator({
      root: tmp,
      manifestRel,
      sensorsRel: 'do-harness.toml',
      profilesRel: 'profiles.json',
    });

  it('passes on the current repo inputs', () => {
    const r = run('gate-manifest.json');
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('consistent');
  });

  it('fails when a profile-referenced gate check is dropped from the manifest', () => {
    const m = JSON.parse(readFileSync(resolve(tmp, 'gate-manifest.json'), 'utf8'));
    m.local.checks = m.local.checks.filter((c) => c !== 'test:coverage');
    writeFileSync(resolve(tmp, 'manifest-missing-check.json'), JSON.stringify(m, null, 2));
    const r = run('manifest-missing-check.json');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('test:coverage');
    expect(r.stderr).toContain('not in gate-manifest.json');
  });

  it('fails when a profile-referenced sensor is dropped from the sensor pack', () => {
    const toml = readFileSync(resolve(tmp, 'do-harness.toml'), 'utf8').replace(
      /\[\[sensors\]\]\nname = "typecheck"\nargv = \["pnpm", "typecheck"\]\n/,
      '',
    );
    writeFileSync(resolve(tmp, 'sensors-missing-typecheck.toml'), toml);
    const r = runValidator({
      root: tmp,
      manifestRel: 'gate-manifest.json',
      sensorsRel: 'sensors-missing-typecheck.toml',
      profilesRel: 'profiles.json',
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('typecheck');
    expect(r.stderr).toContain('do-harness.toml');
  });

  it('fails when a manifest check has no command resolver entry', () => {
    const m = JSON.parse(readFileSync(resolve(tmp, 'gate-manifest.json'), 'utf8'));
    m.local.checks.push('not-a-real-check');
    writeFileSync(resolve(tmp, 'manifest-orphan.json'), JSON.stringify(m, null, 2));
    const r = run('manifest-orphan.json');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('not-a-real-check');
  });
});

describe('end-to-end example issue task (evidence snapshot)', () => {
  it('plans and evidences a realistic multi-path issue', () => {
    const changed = [
      'packages/schema/src/dtos.ts',
      'packages/reader-core/src/epub-parser.ts',
      'apps/web/src/features/reader/components/ReaderShell.tsx',
    ];
    const plan = planFor(changed);

    // Expected workflow: core + schema consumers + web/accessibility.
    expect(plan.selection.profiles.map((p) => p.id)).toEqual([
      'reader-core',
      'worker-api',
      'pwa-offline',
      'accessibility',
      'integration-e2e',
    ]);
    const skillIds = plan.selection.skills.map((s) => s.id);
    expect(skillIds).toContain('epub-rendering-and-cfi');
    expect(skillIds).toContain('pwa-offline-sync');
    expect(skillIds).toContain('accessibility-auditor');

    const sensorIds = plan.selection.sensors.map((s) => s.id);
    expect(sensorIds).toContain('typecheck');
    expect(sensorIds).toContain('a11y');
    expect(sensorIds).toContain('bundle');

    // Commands derive from the sensor pack, not from profile data.
    expect(plan.commands).toContainEqual(['pnpm', 'typecheck']);
    expect(plan.commands).toContainEqual(['pnpm', 'lint']);
    expect(plan.commands).toContainEqual(['node', 'scripts/a11y-audit.mjs']);

    // Skipped must never include a selected sensor.
    const sel = new Set(sensorIds);
    for (const s of plan.skipped) expect(sel.has(s.id)).toBe(false);
    expect(plan.verificationLevel).toBe('integration');
    expect(plan.disclaimer).toBeTruthy();
    expect(plan.changedPaths).toEqual([...changed].sort());
  });

  it('CLI --json emits well-formed evidence', () => {
    const r = spawnSync(
      'node',
      ['scripts/harness/select.mjs', '--json', '--changed', 'packages/schema/src/dtos.ts'],
      { cwd: repoRoot, encoding: 'utf8', timeout: 30_000 },
    );
    expect(r.status).toBe(0);
    const ev = JSON.parse(r.stdout);
    expect(ev.kind).toBe('do-harness-select');
    expect(ev.version).toBe(1);
    expect(ev.changedPaths).toEqual(['packages/schema/src/dtos.ts']);
    expect(Array.isArray(ev.selection.sensors)).toBe(true);
    expect(Array.isArray(ev.skipped)).toBe(true);
    expect(ev.commands).toContainEqual(['pnpm', 'lint']);
    expect(ev.results).toEqual([]);
    expect(ev.artifacts).toEqual([]);
    expect(ev.env.node).toBe(process.version);
    expect(ev.verificationLevel).toBe('integration');
    expect(ev.disclaimer).toMatch(/NOT full release verification/);
  });

  it('CLI --run executes the planned commands serially and records results', () => {
    const runTmp = resolve(repoRoot, '.tmp-harness-run');
    rmSync(runTmp, { recursive: true, force: true });
    mkdirSync(runTmp, { recursive: true });
    writeFileSync(
      resolve(runTmp, 'profiles.json'),
      JSON.stringify({
        version: 1,
        profiles: [
          {
            id: 'solo',
            label: 'Solo',
            description: 'fixture profile',
            paths: ['a.txt'],
            sensors: ['hello'],
            gateChecks: [],
            skills: [],
          },
        ],
        dependencies: [],
      }),
    );
    writeFileSync(
      resolve(runTmp, 'manifest.json'),
      JSON.stringify({
        version: 1,
        local: { checks: [] },
        pr: { checks: [] },
        release: { checks: [] },
      }),
    );
    writeFileSync(
      resolve(runTmp, 'sensors.toml'),
      '[[sensors]]\nname = "hello"\nargv = ["node", "-e", "process.exit(0)"]\n',
    );
    const r = spawnSync(
      'node',
      [
        'scripts/harness/select.mjs',
        '--json',
        '--run',
        '--root',
        runTmp,
        '--profiles',
        'profiles.json',
        '--manifest',
        'manifest.json',
        '--sensors',
        'sensors.toml',
        '--changed',
        'a.txt',
      ],
      { cwd: repoRoot, encoding: 'utf8', timeout: 30_000 },
    );
    expect(r.status).toBe(0);
    const ev = JSON.parse(r.stdout);
    expect(ev.commands).toEqual([['node', '-e', 'process.exit(0)']]);
    expect(ev.results).toHaveLength(1);
    expect(ev.results[0].ok).toBe(true);
    expect(ev.results[0].exitCode).toBe(0);
    expect(typeof ev.results[0].durationMs).toBe('number');
    expect(ev.verificationLevel).toBe('fast');
    expect(ev.disclaimer).toMatch(/NOT full release verification/);
    rmSync(runTmp, { recursive: true, force: true });
  });
});

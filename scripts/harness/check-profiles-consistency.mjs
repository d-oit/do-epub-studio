#!/usr/bin/env node
/**
 * Harness profiles consistency validator (issue #1492, registered as the
 * `profiles-consistency` gate check in scripts/gate-manifest.json).
 *
 * Proves the sensor profiles never drift from the two canonical command
 * sources:
 *   - every profile `sensors` id exists in do-harness.toml (argv source)
 *   - every profile `gateChecks` id exists in gate-manifest.json local.checks
 *     and has a resolver entry in gate-commands.mjs
 *   - every manifest local.checks id has a resolver entry (no orphan claims)
 *   - every profile `skills` id exists under .agents/skills/<id>
 *   - dependency targets reference existing profile ids
 *
 * Exit 0 = consistent, 1 = drift. Overridable file selectors make the check
 * runnable against fixture trees in tests.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GATE_COMMANDS } from './gate-commands.mjs';
import { MANIFEST_FILE, PROFILES_FILE, SENSORS_FILE, parseSensorPack } from './engine.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (
      a === '--profiles' ||
      a === '--manifest' ||
      a === '--sensors' ||
      a === '--skills-dir' ||
      a === '--root'
    ) {
      i += 1;
      opts[a.slice(2)] = argv[i];
    } else if (a === '--json') {
      opts.json = true;
    } else if (a === '-h' || a === '--help') {
      opts.help = true;
    }
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(
      'check-profiles-consistency.mjs [--profiles <file>] [--manifest <file>] [--sensors <file>] [--skills-dir <dir>] [--root <dir>] [--json]\n',
    );
    process.exit(0);
  }
  const root = resolve(ROOT, opts.root ?? '.');

  const profilesFile = opts.profiles ? resolve(root, opts.profiles) : resolve(root, PROFILES_FILE);
  const manifestFile = opts.manifest ? resolve(root, opts.manifest) : resolve(root, MANIFEST_FILE);
  const sensorsFile = opts.sensors ? resolve(root, opts.sensors) : resolve(root, SENSORS_FILE);
  const skillsDir = opts['skills-dir']
    ? resolve(root, opts['skills-dir'])
    : resolve(root, '.agents/skills');

  const errors = [];

  if (!existsSync(profilesFile)) errors.push(`profiles file not found: ${profilesFile}`);
  if (!existsSync(manifestFile)) errors.push(`manifest file not found: ${manifestFile}`);
  if (!existsSync(sensorsFile)) errors.push(`sensor pack not found: ${sensorsFile}`);
  if (errors.length > 0) return finish(errors, opts.json);

  let profiles;
  let manifest;
  let sensorPack;
  try {
    profiles = JSON.parse(readFileSync(profilesFile, 'utf8'));
    manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
    sensorPack = parseSensorPack(readFileSync(sensorsFile, 'utf8'));
  } catch (err) {
    return finish([`failed to parse inputs: ${err.message}`], opts.json);
  }

  const profileIds = new Set();
  for (const p of profiles.profiles ?? []) {
    if (profileIds.has(p.id)) errors.push(`duplicate profile id "${p.id}"`);
    profileIds.add(p.id);
  }

  const localChecks = new Set(manifest.local?.checks ?? []);
  const unknownLocal = [...localChecks].filter((c) => !(c in GATE_COMMANDS));
  for (const c of unknownLocal)
    errors.push(`gate-manifest local.checks "${c}" has no resolver entry in gate-commands.mjs`);

  for (const p of profiles.profiles ?? []) {
    for (const s of p.sensors ?? []) {
      if (!sensorPack.has(s))
        errors.push(
          `profile "${p.id}" references unknown sensor "${s}" (missing from do-harness.toml)`,
        );
    }
    for (const g of p.gateChecks ?? []) {
      if (!localChecks.has(g))
        errors.push(
          `profile "${p.id}" references gate check "${g}" not in gate-manifest.json local.checks`,
        );
      if (!(g in GATE_COMMANDS))
        errors.push(
          `profile "${p.id}" gate check "${g}" has no resolver entry in gate-commands.mjs`,
        );
    }
    for (const skill of p.skills ?? []) {
      const id = typeof skill === 'string' ? skill : skill.id;
      if (!existsSync(resolve(skillsDir, id)))
        errors.push(
          `profile "${p.id}" references unknown skill "${id}" (missing from ${skillsDir})`,
        );
    }
  }

  for (const dep of profiles.dependencies ?? []) {
    for (const target of dep.to ?? []) {
      if (!profileIds.has(target))
        errors.push(`dependency "${dep.id}" targets unknown profile "${target}"`);
    }
  }

  return finish(errors, opts.json);
}

function finish(errors, asJson) {
  if (asJson) {
    process.stdout.write(`${JSON.stringify({ ok: errors.length === 0, errors }, null, 2)}\n`);
  } else if (errors.length === 0) {
    process.stdout.write(
      '✓ Harness sensor profiles are consistent with gate-manifest.json and do-harness.toml\n',
    );
  } else {
    for (const e of errors) process.stderr.write(`✗ ${e}\n`);
  }
  process.exit(errors.length === 0 ? 0 : 1);
}

main();

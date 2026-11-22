#!/usr/bin/env node
/**
 * do-harness selection CLI (issue #1492). Canonical agent execution path:
 * inspect issue/plan -> select skills (task intent + changed paths) -> run
 * affected sensors -> escalate -> evidence.
 *
 * Usage:
 *   node scripts/harness/select.mjs --changed packages/schema/src/dtos.ts
 *   git diff --name-only origin/main...HEAD | node scripts/harness/select.mjs --changed-file - --json
 *   node scripts/harness/select.mjs --diff origin/main HEAD --explain
 *   node scripts/harness/select.mjs --changed apps/web/src/ReaderFooter.tsx --release --json
 *   node scripts/harness/select.mjs --changed scripts/foo.mjs --run --json
 *
 * Exit codes: 0 ok; 1 verification/plan errors; 2 usage/git errors.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evidenceFromPlan,
  formatText,
  loadManifest,
  loadProfiles,
  loadSensorPack,
  parseSensorPack,
  planFromPaths,
} from './engine.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

function usage() {
  return `do-harness select — plan sensors/skills/commands for changed paths

Usage:
  node scripts/harness/select.mjs [options] [-- path...]

Options:
  --changed <path>      A changed path (repeatable; or pass as positional after --)
  --changed-file <file> Read changed paths from a file (one per line); "-" = stdin
  --diff <base> <head>  Changed paths from \`git diff --name-only base head\`
  --explain | --dry-run  Print the plan as text without running anything (default)
  --json                Emit machine-readable evidence JSON to stdout
  --run                 Execute the planned commands serially and record results
  --release             Close the release gate gap: add any missing manifest local.checks
  --level <fast|integration|release>  Override verification level
  --profiles <file>     Override profiles data file
  --manifest <file>     Override gate manifest file
  --sensors <file>      Override do-harness.toml sensor pack
  --root <dir>          Workspace root override
  -h, --help            Show this help

Default (no paths): \`git diff --name-only origin/main...HEAD\` (falls back to HEAD).`;
}

function fail(msg, code = 2) {
  process.stderr.write(`${msg}\n`);
  process.exit(code);
}

function gitDiff(base, head) {
  const args =
    base === null ? ['diff', '--name-only', 'HEAD'] : ['diff', '--name-only', base, head];
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', timeout: 30_000 });
  if (r.status !== 0) {
    fail(`git ${args.join(' ')} failed: ${(r.stderr || '').trim() || r.status}`);
  }
  return r.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function readChangedFile(file) {
  const text = file === '-' ? readFileSync(0, 'utf8') : readFileSync(resolve(ROOT, file), 'utf8');
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function getGitHead() {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 10_000,
  });
  return r.status === 0 ? r.stdout.trim() : null;
}

function parseArgs(argv) {
  const opts = { changed: [], diff: null, extra: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    switch (a) {
      case '--changed':
        i += 1;
        opts.changed.push(argv[i]);
        break;
      case '--changed-file':
        i += 1;
        opts.changed.push(...readChangedFile(argv[i]));
        break;
      case '--diff':
        opts.diff = [argv[i + 1], argv[i + 2]];
        i += 2;
        break;
      case '--explain':
      case '--dry-run':
        opts.explain = true;
        break;
      case '--json':
        opts.json = true;
        break;
      case '--run':
        opts.run = true;
        break;
      case '--release':
        opts.release = true;
        break;
      case '--level':
        i += 1;
        opts.level = argv[i];
        break;
      case '--profiles':
        i += 1;
        opts.profiles = argv[i];
        break;
      case '--manifest':
        i += 1;
        opts.manifest = argv[i];
        break;
      case '--sensors':
        i += 1;
        opts.sensors = argv[i];
        break;
      case '--root':
        i += 1;
        opts.root = argv[i];
        break;
      case '--':
        opts.extra.push(...argv.slice(i + 1));
        i = argv.length;
        break;
      case '-h':
      case '--help':
        console.log(usage());
        process.exit(0);
        break;
      default:
        if (a.startsWith('-')) fail(`unknown option: ${a}\n\n${usage()}`);
        opts.extra.push(a);
    }
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const root = resolve(ROOT, opts.root ?? '.');
  const profilesFile = opts.profiles ? resolve(root, opts.profiles) : null;
  const manifestFile = opts.manifest ? resolve(root, opts.manifest) : null;
  const sensorsFile = opts.sensors ? resolve(root, opts.sensors) : null;

  const profiles = profilesFile
    ? JSON.parse(readFileSync(profilesFile, 'utf8'))
    : loadProfiles(root);
  const manifest = manifestFile
    ? JSON.parse(readFileSync(manifestFile, 'utf8'))
    : loadManifest(root);
  const sensorPack = sensorsFile
    ? parseSensorPack(readFileSync(sensorsFile, 'utf8'))
    : loadSensorPack(root);

  let changed = opts.changed;
  if (changed.length === 0 && opts.diff) changed = gitDiff(opts.diff[0], opts.diff[1]);
  if (changed.length === 0 && !opts.diff) {
    const base = spawnSync(
      'git',
      ['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main'],
      {
        cwd: root,
        encoding: 'utf8',
        timeout: 10_000,
      },
    );
    const committed = base.status === 0 ? gitDiff('origin/main', 'HEAD') : gitDiff(null, null);
    // Union with working-tree paths (modified + untracked) so a pre-commit
    // dirty tree still selects sensors when HEAD has no commits beyond main.
    const status = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 10_000,
    });
    const tree =
      status.status === 0
        ? status.stdout
            .split('\n')
            .filter((l) => l.length > 3)
            .map((l) => (l.includes(' -> ') ? l.split(' -> ').pop() : l.slice(3)))
        : [];
    changed = [...new Set([...committed, ...tree])];
  }
  if (changed.length === 0)
    fail('no changed paths provided (use --changed, --changed-file, --diff, or a dirty git tree)');

  let plan;
  try {
    plan = planFromPaths({ changedPaths: changed, profiles, manifest, sensorPack, options: opts });
  } catch (err) {
    fail(err.message, 1);
  }

  let results = [];
  if (opts.run) {
    for (const cmd of plan.commands) {
      const t0 = Date.now();
      const r = spawnSync(cmd[0], cmd.slice(1), {
        cwd: root,
        encoding: 'utf8',
        timeout: 30 * 60 * 1000,
      });
      results.push({
        command: cmd,
        exitCode: r.status,
        ok: r.status === 0,
        durationMs: Date.now() - t0,
        stderrTail: (r.stderr || '').split('\n').slice(-5).join('\n'),
      });
    }
    const failed = results.filter((r) => !r.ok).length;
    if (failed > 0) process.exitCode = 1;
  }

  const evidence = evidenceFromPlan(plan, { root, results, gitHead: getGitHead() });

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatText(plan)}\n`);
    if (opts.run) {
      process.stdout.write('\nresults:\n');
      for (const r of results) {
        process.stdout.write(
          `  [${r.ok ? 'PASS' : 'FAIL'}] ${r.command.join(' ')} (${r.exitCode}, ${r.durationMs}ms)\n`,
        );
        if (r.stderrTail)
          process.stdout.write(`      ${r.stderrTail.split('\n').join('\n      ')}\n`);
      }
    }
  }
}

main();

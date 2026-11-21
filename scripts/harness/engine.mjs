/**
 * do-harness selection engine (issue #1492).
 *
 * Inputs: changed paths + sensor profiles (scripts/harness/profiles.json) +
 * the sensor pack (do-harness.toml) + the gate manifest
 * (scripts/gate-manifest.json). Outputs: an ordered, deterministic sensor /
 * skill / command plan with explicit skip reasons, never declaring commands
 * anywhere but the two canonical sources (do-harness.toml argv and
 * gate-commands.mjs).
 *
 * Node 22 ESM, zero dependencies. `matchGlob` is segment-based and never runs
 * a regex over input paths (bounded, linear in path length).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GATE_COMMANDS } from './gate-commands.mjs';

export const PROFILES_FILE = 'scripts/harness/profiles.json';
export const MANIFEST_FILE = 'scripts/gate-manifest.json';
export const SENSORS_FILE = 'do-harness.toml';

/** Sensors that require a browser/dev-server or build, i.e. not "fast". */
const INTEGRATION_SENSORS = new Set([
  'bundle',
  'web-ui-tests',
  'viewport-ux',
  'a11y',
  'console',
  'perf',
  'visual',
  'i18n',
]);

const MAX_PATH_LEN = 4096;

/**
 * Gitignore-style glob matcher (segments, `**` any-depth, `*` within a
 * segment). No regex is ever executed against input paths.
 */
export function matchGlob(pattern, path) {
  if (typeof path !== 'string' || path.length > MAX_PATH_LEN) return false;
  const pp = pattern.split('/');
  const wp = path.replace(/^\.\//, '').split('/');
  const m = pp.length;
  const n = wp.length;
  // dp[j] = does pp[0..i) match wp[0..j) (rolling row over i).
  let dp = new Array(n + 1).fill(false);
  dp[0] = true;
  for (let i = 1; i <= m; i += 1) {
    const seg = pp[i - 1];
    const next = new Array(n + 1).fill(false);
    if (seg === '**') {
      // `**` matches zero or more path segments.
      let any = false;
      for (let j = 0; j <= n; j += 1) {
        if (dp[j] || (j > 0 && next[j - 1])) next[j] = true;
        if (next[j]) any = true;
      }
      void any;
    } else {
      for (let j = 1; j <= n; j += 1) {
        if (dp[j - 1] && segMatches(seg, wp[j - 1])) next[j] = true;
      }
      // A non-** segment cannot match an empty path prefix.
      next[0] = false;
    }
    dp = next;
  }
  return dp[n];
}

/** `*` wildcard within a single path segment (no slash, no regex). */
function segMatches(seg, word) {
  if (seg === word) return true;
  if (!seg.includes('*')) return false;
  const parts = seg.split('*');
  let pos = 0;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (part === '') continue;
    const idx = word.indexOf(part, pos);
    if (idx === -1) return false;
    if (i === 0 && idx !== 0) return false;
    pos = idx + part.length;
  }
  return parts[parts.length - 1] === '' || pos === word.length;
}

/** Minimal TOML scanner: extracts [[sensors]] name + argv arrays. */
export function parseSensorPack(toml) {
  const sensors = new Map();
  let inSen = false;
  let current = null;
  let argvLines = [];
  let inArgv = false;
  const lines = toml.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (line.startsWith('[[sensors]]')) {
      if (inSen && current) flushSensor(sensors, current, argvLines);
      inSen = true;
      current = { name: null, argv: null };
      argvLines = [];
      inArgv = false;
      continue;
    }
    if (!inSen) continue;
    if (line.startsWith('[') && !line.startsWith('[[sensors]]')) {
      flushSensor(sensors, current, argvLines);
      inSen = false;
      current = null;
      continue;
    }
    if (current === null) continue;
    const nameMatch = /^name\s*=\s*"((?:[^"\\]|\\.)*)"$/.exec(line);
    if (nameMatch) {
      current.name = unquote(nameMatch[1]);
      continue;
    }
    if (line.startsWith('argv')) {
      const eq = line.indexOf('=');
      const rest = line.slice(eq + 1).trim();
      inArgv = rest !== '[' && !rest.startsWith('[');
      if (!inArgv) {
        argvLines = [rest];
        if (rest.endsWith(']')) {
          current.argv = parseArgv(argvLines.join(''));
          inArgv = false;
        }
      } else {
        argvLines = [rest.replace(/,\s*$/, '')];
      }
      continue;
    }
    if (inArgv) {
      argvLines.push(line.replace(/,\s*$/, ''));
      if (line.endsWith(']')) {
        current.argv = parseArgv(argvLines.join(''));
        inArgv = false;
      }
    }
  }
  if (inSen && current) flushSensor(sensors, current, argvLines);
  return sensors;
}

function flushSensor(sensors, current, argvLines) {
  if (current === null || current.name === null) return;
  if (current.argv === null && argvLines.length > 0) {
    current.argv = parseArgv(argvLines.join(''));
  }
  sensors.set(current.name, current.argv ?? []);
}

function unquote(s) {
  return s.replace(/\\(["\\])/g, '$1');
}

function parseArgv(text) {
  const out = [];
  const re = /"((?:[^"\\]|\\.)*)"/g;
  let match;
  while ((match = re.exec(text)) !== null) out.push(unquote(match[1]));
  return out;
}

export function loadJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function loadProfiles(root) {
  return loadJson(resolve(root, PROFILES_FILE));
}

export function loadManifest(root) {
  return loadJson(resolve(root, MANIFEST_FILE));
}

export function loadSensorPack(root) {
  return parseSensorPack(readFileSync(resolve(root, SENSORS_FILE), 'utf8'));
}

export function planFromPaths({ changedPaths, profiles, manifest, sensorPack, options = {} }) {
  const paths = [
    ...new Set((changedPaths ?? []).map((p) => String(p).trim()).filter(Boolean)),
  ].sort();
  const manifestDeps = profiles.dependencies ?? [];

  // Direct path matches.
  const selected = new Map();
  for (const path of paths) {
    for (const profile of profiles.profiles) {
      if (profile.paths.some((p) => matchGlob(p, path))) {
        const entry = getSel(selected, profile);
        entry.reasons.add('path-match');
        entry.triggeredBy.add(path);
      }
    }
  }

  // Explicit dependency edges (schema / reader-core / shared -> consumers).
  const depsApplied = [];
  for (const dep of manifestDeps) {
    const matchedBy = paths.filter((p) => dep.from.some((g) => matchGlob(g, p)));
    if (matchedBy.length === 0) continue;
    depsApplied.push({ id: dep.id, matchedBy, targets: [...dep.to] });
    for (const target of dep.to) {
      const profile = profiles.profiles.find((p) => p.id === target);
      if (!profile)
        throw new Error(`profiles.json: dependency ${dep.id} targets unknown profile "${target}"`);
      const entry = getSel(selected, profile);
      entry.reasons.add(`dependency: ${dep.id}`);
      for (const m of matchedBy) entry.triggeredBy.add(m);
    }
  }

  // Plan order = profile declaration order (deterministic regardless of input order).
  const order = new Map(profiles.profiles.map((p, i) => [p.id, i]));
  const selProfiles = [...selected.entries()]
    .sort((a, b) => order.get(a[0]) - order.get(b[0]))
    .map(([id, entry]) => ({ id, ...entry }));

  const sensors = [];
  const sensorSeen = new Set();
  const gateChecks = [];
  const gateSeen = new Set();
  for (const sel of selProfiles) {
    for (const s of sel.profile.sensors) {
      if (sensorSeen.has(s)) continue;
      sensorSeen.add(s);
      const argv = sensorPack.get(s);
      if (!argv) throw new Error(`sensor "${s}" (profile ${sel.id}) not found in do-harness.toml`);
      sensors.push({ id: s, profile: sel.id, command: argv, triggeredBy: [...sel.triggeredBy] });
    }
    for (const c of sel.profile.gateChecks ?? []) {
      if (gateSeen.has(c)) continue;
      gateSeen.add(c);
      const argv = GATE_COMMANDS[c];
      if (!argv)
        throw new Error(
          `gate check "${c}" (profile ${sel.id}) has no resolver entry in gate-commands.mjs`,
        );
      gateChecks.push({ id: c, profile: sel.id, command: argv });
    }
  }

  // Unique commands, plan order.
  const commands = [];
  const cmdSeen = new Set();
  const pushCmd = (argv) => {
    const key = JSON.stringify(argv);
    if (!cmdSeen.has(key)) {
      cmdSeen.add(key);
      commands.push(argv);
    }
  };
  for (const s of sensors) pushCmd(s.command);
  for (const g of gateChecks) pushCmd(g.command);

  // Release gap closure: `--release` adds any missing manifest local.checks so
  // the plan covers the full release gate.
  const releaseGapChecks = [];
  if (options.release) {
    const allChecks = new Set(manifest.local?.checks ?? []);
    for (const c of allChecks) {
      if (gateSeen.has(c)) continue;
      gateSeen.add(c);
      const argv = GATE_COMMANDS[c];
      if (!argv) throw new Error(`gate check "${c}" (release gap) has no resolver entry`);
      releaseGapChecks.push(c);
      pushCmd(argv);
    }
  }

  const level = computeLevel({ options, gateSeen, manifest, sensors, selProfiles });

  const universe = new Set();
  for (const p of profiles.profiles) for (const s of p.sensors) universe.add(s);
  const skipped = [];
  for (const s of [...universe].sort()) {
    if (!sensorSeen.has(s))
      skipped.push({ id: s, reason: 'no matching changed path in a selected profile' });
  }

  const disclaimer = level === 'release' ? null : DISCLAIMER;

  return {
    changedPaths: paths,
    selection: {
      profiles: selProfiles.map((sel) => ({
        id: sel.id,
        label: sel.profile.label,
        triggeredBy: [...sel.triggeredBy].sort(),
        reasons: [...sel.reasons].sort(),
      })),
      skills: collectSkills(selProfiles),
      sensors,
      gateChecks,
      dependencies: depsApplied,
      releaseGapChecks,
    },
    skipped,
    commands,
    verificationLevel: level,
    disclaimer,
  };
}

function getSel(selected, profile) {
  let entry = selected.get(profile.id);
  if (!entry) {
    entry = { profile, reasons: new Set(), triggeredBy: new Set() };
    selected.set(profile.id, entry);
  }
  return entry;
}

function collectSkills(selProfiles) {
  const skills = [];
  const seen = new Set();
  for (const sel of selProfiles) {
    for (const skill of sel.profile.skills ?? []) {
      if (seen.has(skill.id)) continue;
      seen.add(skill.id);
      skills.push({ id: skill.id, profile: sel.id, why: skill.why ?? '' });
    }
  }
  return skills;
}

function computeLevel({ options, gateSeen, manifest, sensors, selProfiles }) {
  if (options.level) {
    if (!['fast', 'integration', 'release'].includes(options.level)) {
      throw new Error(`--level must be fast|integration|release (got "${options.level}")`);
    }
    return options.level;
  }
  if (options.release) return 'release';
  const allChecks = new Set(manifest.local?.checks ?? []);
  if (allChecks.size > 0) {
    let covered = true;
    for (const c of allChecks) if (!gateSeen.has(c)) covered = false;
    if (covered) return 'release';
  }
  if (
    sensors.some((s) => INTEGRATION_SENSORS.has(s.id)) ||
    selProfiles.some((s) => s.id === 'integration-e2e')
  ) {
    return 'integration';
  }
  return 'fast';
}

export const DISCLAIMER =
  'FAST/SUBSET FEEDBACK — NOT full release verification. Only the listed commands ran or are planned. ' +
  'Run ./scripts/quality_gate.sh and let the CI Full Quality Gate pass before claiming release verification.';

export function formatText(plan) {
  const lines = [];
  const bar = '-'.repeat(72);
  lines.push(bar);
  lines.push('do-harness selection plan');
  lines.push(bar);
  lines.push(`changed paths (${plan.changedPaths.length}):`);
  for (const p of plan.changedPaths) lines.push(`  ${p}`);
  lines.push('');
  lines.push(`selected profiles (${plan.selection.profiles.length}):`);
  for (const p of plan.selection.profiles) {
    lines.push(`  ${p.id} — ${p.label}`);
    lines.push(`      reasons: ${p.reasons.join(', ')}`);
  }
  lines.push('');
  lines.push(`selected skills (${plan.selection.skills.length}):`);
  for (const s of plan.selection.skills)
    lines.push(`  ${s.id} [${s.profile}]${s.why ? ` — ${s.why}` : ''}`);
  lines.push('');
  lines.push(`selected sensors (${plan.selection.sensors.length}):`);
  for (const s of plan.selection.sensors) {
    lines.push(`  ${s.id} [${s.profile}] ${s.command.join(' ')}`);
  }
  lines.push('');
  lines.push(`gate checks (${plan.selection.gateChecks.length}):`);
  for (const g of plan.selection.gateChecks)
    lines.push(`  ${g.id} [${g.profile}] ${g.command.join(' ')}`);
  if (plan.selection.dependencies.length) {
    lines.push('');
    lines.push(`dependencies applied (${plan.selection.dependencies.length}):`);
    for (const d of plan.selection.dependencies) {
      lines.push(`  ${d.id} -> ${d.targets.join(', ')} (matched by: ${d.matchedBy.join(', ')})`);
    }
  }
  if (plan.selection.releaseGapChecks.length) {
    lines.push('');
    lines.push(`release gap checks added: ${plan.selection.releaseGapChecks.join(', ')}`);
  }
  lines.push('');
  lines.push(`skipped sensors (${plan.skipped.length}):`);
  for (const s of plan.skipped) lines.push(`  ${s.id} — ${s.reason}`);
  lines.push('');
  lines.push(`commands (${plan.commands.length}):`);
  for (const c of plan.commands) lines.push(`  ${c.join(' ')}`);
  lines.push('');
  lines.push(`verification level: ${plan.verificationLevel}`);
  if (plan.disclaimer) lines.push(`disclaimer: ${plan.disclaimer}`);
  return lines.join('\n');
}

export function evidenceFromPlan(plan, { root, results = [], artifacts = [], gitHead } = {}) {
  return {
    kind: 'do-harness-select',
    version: 1,
    changedPaths: plan.changedPaths,
    selection: plan.selection,
    skipped: plan.skipped,
    commands: plan.commands,
    results,
    artifacts,
    verificationLevel: plan.verificationLevel,
    disclaimer: plan.disclaimer,
    env: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      repoRoot: root,
      timestamp: new Date().toISOString(),
      ...(gitHead ? { gitHead } : {}),
    },
  };
}

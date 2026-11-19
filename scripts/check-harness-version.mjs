#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = process.cwd();
const pinPath = resolve(root, '.do-harness-version');
let pin;

try {
  pin = readFileSync(pinPath, 'utf8').trim();
} catch {
  console.error(
    'do-harness version check failed: expected pin from .do-harness-version; actual unavailable',
  );
  process.exit(1);
}

if (!/^v\d+\.\d+\.\d+$/.test(pin)) {
  console.error(
    `do-harness version check failed: expected valid pin in .do-harness-version; actual ${JSON.stringify(pin)}`,
  );
  process.exit(1);
}

const expected = pin.slice(1);
const result = spawnSync('do-harness', ['version', '--format', 'json'], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, DO_HARNESS_AUTO_REPORT: 'off' },
});

if (result.error) {
  console.error(
    `do-harness version check failed: expected ${expected}; actual unavailable (${result.error.message})`,
  );
  process.exit(1);
}

if (result.status !== 0) {
  const actual = `command failed (exit ${result.status ?? 'unknown'})`;
  console.error(`do-harness version check failed: expected ${expected}; actual ${actual}`);
  process.exit(1);
}

let identity;
try {
  identity = JSON.parse(result.stdout);
} catch {
  identity = null;
}

const actualName = typeof identity?.name === 'string' ? identity.name : undefined;
const actualVersion = typeof identity?.version === 'string' ? identity.version : undefined;

if (!actualName || !actualVersion) {
  console.error(
    `do-harness version check failed: expected do-harness ${expected}; actual invalid JSON or missing name/version`,
  );
  process.exit(1);
}

if (actualName !== 'do-harness') {
  console.error(
    `do-harness version check failed: expected do-harness ${expected}; actual ${actualName} ${actualVersion}`,
  );
  process.exit(1);
}

if (actualVersion !== expected) {
  console.error(`do-harness version check failed: expected ${expected}; actual ${actualVersion}`);
  process.exit(1);
}

console.log(`do-harness ${actualVersion} matches .do-harness-version`);

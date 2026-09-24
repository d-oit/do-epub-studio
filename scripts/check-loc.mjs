#!/usr/bin/env node
// scripts/check-loc.mjs — enforce the 500-line source cap via a ratchet
// baseline (ADR-278, GOAP-276 P0 #4).
//
// Fails when:
//   1. an in-scope file exceeds 500 lines with no baseline entry (new violation)
//   2. a baselined file's count differs from its entry — growth past the
//      ratchet, or a stale entry that must be tightened (delete it if the
//      file dropped to <=500)
//   3. a baseline entry no longer maps to an in-scope tracked file
// Warns (non-blocking) on in-scope files in the 450-500 extract-now zone.
//
// Scope: tracked .ts/.tsx/.js/.jsx/.mjs/.cjs/.py/.sh, minus *.d.ts,
// apps/web/src/i18n/** (locale tables), tests (__tests__/, tests/,
// *.test.*, *.spec.*), and .agents/** (skills are documents, not sources).
//
// Usage: node scripts/check-loc.mjs
// Exit:  0 = within cap (warnings allowed), 1 = violation.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const CAP = 500;
const WARN_AT = 450;
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.sh'];
const BASELINE_PATH = join(REPO_ROOT, 'scripts', 'loc-baseline.json');

function isTestPath(path) {
  const base = path.slice(path.lastIndexOf('/') + 1);
  return base.includes('.test.') || base.includes('.spec.');
}

function inScope(path) {
  if (!EXTENSIONS.some((ext) => path.endsWith(ext))) return false;
  if (path.endsWith('.d.ts')) return false;
  if (path.startsWith('apps/web/src/i18n/')) return false;
  if (path.startsWith('.agents/')) return false;
  const segments = path.split('/');
  if (segments.includes('__tests__') || segments.includes('tests')) return false;
  if (isTestPath(path)) return false;
  return true;
}

// Line count matches `wc -l` (newline characters), which is how the
// baseline numbers were generated.
function countLines(text) {
  return text.length === 0 ? 0 : text.split('\n').length - 1;
}

let tracked;
try {
  tracked = execFileSync('git', ['ls-files'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
    .split('\n')
    .filter((p) => p.length > 0);
} catch (error) {
  console.error(`✗ git ls-files failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
} catch (error) {
  console.error(
    `✗ cannot read baseline ${BASELINE_PATH}: ${error instanceof Error ? error.message : error}`,
  );
  process.exit(1);
}

const errors = [];
const warnings = [];
const actual = new Map();

for (const path of tracked) {
  if (!inScope(path)) continue;
  try {
    const lines = countLines(readFileSync(join(REPO_ROOT, path), 'utf8'));
    actual.set(path, lines);
  } catch (error) {
    errors.push(`${path}: unreadable (${error instanceof Error ? error.message : error})`);
  }
}

for (const [path, lines] of actual) {
  if (Object.hasOwn(baseline, path)) {
    const recorded = baseline[path];
    if (lines !== recorded) {
      errors.push(
        `${path}: ${lines} lines but baseline says ${recorded} — ` +
          (lines > recorded
            ? 'growth past the ratchet; extract instead of re-baselining up'
            : 'stale baseline; tighten the entry (remove it if <=500)'),
      );
    }
    continue;
  }
  if (lines > CAP) {
    errors.push(`${path}: ${lines} lines exceeds the ${CAP}-line cap — no new violations`);
  } else if (lines >= WARN_AT) {
    warnings.push(`${path}: ${lines} lines (extract before it crosses ${CAP})`);
  }
}

for (const path of Object.keys(baseline)) {
  if (!actual.has(path)) {
    errors.push(`stale baseline entry: ${path} is gone or out of scope — delete the entry`);
  }
}

for (const line of warnings) console.warn(`⚠ ${line}`);

if (errors.length > 0) {
  console.error(
    `✗ ${errors.length} LOC violation(s) (cap ${CAP}, baseline scripts/loc-baseline.json):`,
  );
  for (const line of errors) console.error(`  ${line}`);
  process.exit(1);
}

console.log(`✓ All ${actual.size} in-scope source files within the ${CAP}-line cap`);
console.log(`  Grandfathered by ratchet baseline: ${Object.keys(baseline).length} (only shrinks)`);
console.log(`  Warn zone ${WARN_AT}-${CAP}: ${warnings.length} file(s)`);

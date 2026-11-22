#!/usr/bin/env node
/**
 * Validate docs/standards/epub-conformance-matrix.json.
 *
 * Policy (mirrors the matrix `policy` block and issue #1488 acceptance):
 *   - every `implemented` row MUST reference at least one real test file
 *     repository's Vitest/Playwright test runs);
 *   - `partial` / `not-implemented` / `not-applicable` rows MUST carry a
 *     documented exception note; and
 *   - `epub-34` / `epub-rs-34` rows are experimental and non-certifying.
 *
 * Usage: node scripts/validate-standards-matrix.mjs [--root <repo-root>]
 * Exit 0 = valid; exit 1 = violations found.
 */
import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SPECS = new Set(['epub-33', 'epub-34', 'epub-rs-34']);
const STATUSES = new Set(['implemented', 'partial', 'not-implemented', 'not-applicable']);
const TEST_EXTENSIONS = new Set(['.test.ts', '.spec.ts', '.test.mjs', '.spec.mjs']);
const TEST_DECLARATION = /\b(describe|it|test)\(/;

/** Parse CLI args into an options object. */
export function parseArgs(argv = process.argv.slice(2)) {
  const options = { root: ROOT };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--root' && argv[i + 1]) {
      options.root = resolve(argv[i + 1]);
      i += 1;
    }
  }
  return options;
}

/** Load and parse the matrix JSON; throws on invalid JSON. */
export function loadMatrix(root = ROOT) {
  const file = resolve(root, 'docs/standards/epub-conformance-matrix.json');
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.rows)) {
    throw new Error('matrix must be an object with a rows array');
  }
  return raw;
}

/** True when `file` exists and looks like a test file that will actually run. */
export function isRealTestFile(root, file) {
  const full = resolve(root, file);
  let stats;
  try {
    stats = statSync(full);
  } catch {
    return false;
  }
  if (!stats.isFile()) return false;
  const lower = full.toLowerCase();
  if (![...TEST_EXTENSIONS].some((ext) => lower.endsWith(ext))) return false;
  let source;
  try {
    source = readFileSync(full, 'utf8');
  } catch {
    return false;
  }
  return TEST_DECLARATION.test(source);
}

/** Validate a single row; returns an array of violation messages. */
export function validateRow(row, root) {
  const errors = [];
  const where = `${row.spec} §${row.clauseId} (${row.clauseTitle ?? '?'})`;

  if (typeof row !== 'object' || row === null) {
    return [`row is not an object`];
  }
  if (!SPECS.has(row.spec)) {
    errors.push(`${where}: spec must be one of ${[...SPECS].join(', ')}`);
  }
  if (typeof row.clauseId !== 'string' || row.clauseId.trim() === '') {
    errors.push(`${where}: clauseId must be a non-empty string`);
  }
  if (typeof row.clauseTitle !== 'string' || row.clauseTitle.trim() === '') {
    errors.push(`${where}: clauseTitle must be a non-empty string`);
  }
  if (typeof row.requirement !== 'string' || row.requirement.trim() === '') {
    errors.push(`${where}: requirement must be a non-empty string`);
  }
  for (const key of ['implementationModule', 'tests', 'evidence']) {
    if (!Array.isArray(row[key]) || row[key].some((entry) => typeof entry !== 'string')) {
      errors.push(`${where}: ${key} must be an array of strings`);
    }
  }
  if (!STATUSES.has(row.status)) {
    errors.push(`${where}: status must be one of ${[...STATUSES].join(', ')}`);
  }

  if (row.status === 'implemented') {
    const tests = Array.isArray(row.tests) ? row.tests : [];
    if (tests.length === 0) {
      errors.push(`${where}: implemented rows MUST reference at least one test file`);
    }
    for (const test of tests) {
      if (!isRealTestFile(root, test)) {
        errors.push(
          `${where}: referenced test file does not exist or is not a real test file: ${test}`,
        );
      }
    }
  } else if (
    row.status === 'partial' ||
    row.status === 'not-implemented' ||
    row.status === 'not-applicable'
  ) {
    if (typeof row.notes !== 'string' || row.notes.trim() === '') {
      errors.push(`${where}: ${row.status} rows MUST carry a documented exception note (notes)`);
    }
  }

  return errors;
}

/** Validate the whole matrix; returns an array of violation messages. */
export function validateMatrix(root = ROOT, matrix = loadMatrix(root)) {
  const errors = [];

  if (!Number.isInteger(matrix.matrixVersion) || matrix.matrixVersion < 1) {
    errors.push('matrixVersion must be a positive integer');
  }
  if (typeof matrix.updatedAt !== 'string' || matrix.updatedAt.trim() === '') {
    errors.push('updatedAt must be a non-empty string');
  }
  if (typeof matrix.policy !== 'object' || matrix.policy === null) {
    errors.push('policy must be an object');
  }
  if (matrix.policy?.stableBaseline !== 'epub-33') {
    errors.push('policy.stableBaseline must be "epub-33"');
  }
  if (
    !Array.isArray(matrix.policy?.experimentalSpecs) ||
    !matrix.policy.experimentalSpecs.includes('epub-34') ||
    !matrix.policy.experimentalSpecs.includes('epub-rs-34')
  ) {
    errors.push('policy.experimentalSpecs must include epub-34 and epub-rs-34');
  }

  const seen = new Set();
  for (const row of matrix.rows) {
    errors.push(...validateRow(row, root));
    const key = `${row.spec}§${row.clauseId}`;
    if (seen.has(key)) {
      errors.push(`duplicate (spec, clauseId) pair: ${key}`);
    }
    seen.add(key);
  }

  return errors;
}

/** Standalone entry point. */
export function main(argv = process.argv.slice(2)) {
  const { root } = parseArgs(argv);
  let errors;
  try {
    errors = validateMatrix(root);
  } catch (error) {
    console.error(`✗ Failed to read/validate matrix: ${error.message}`);
    process.exit(1);
  }
  if (errors.length > 0) {
    console.error('✗ Standards conformance matrix validation failed:');
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }
  console.log(
    '✓ Standards conformance matrix valid: every implemented row has a real test reference and every non-implemented row has a documented exception note.',
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

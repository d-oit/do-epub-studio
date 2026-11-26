#!/usr/bin/env node
// Validate gate parity — compare the gate manifest against ACTUAL GitHub check
// contexts, not arbitrary workflow text.
//
// This script is the PR/release half of scripts/validate-gate-parity.sh.
// It parses every workflow under .github/workflows with js-yaml and extracts
// job-level check contexts (the job `name:` if present, otherwise the job id,
// with `${{ matrix.* }}` tokens expanded per the job's strategy.matrix). A
// manifest claim is satisfied only by an exact normalized match against a real
// job context (or, for PRs, an explicitly declared external-app check like
// Codacy). Step names, comments, and other workflow text can never satisfy a
// job claim.
//
// Release claims resolve only against .github/workflows/release.yml job
// contexts. The three readiness obligations that are implemented as STEPS of
// the `release-readiness` job (`Verify tag matches VERSION file`,
// `Verify tag is on main branch`, `Verify CI checks passed`) are validated
// separately against that job's step list, so removing a required step or the
// job itself fails the validator.
//
// Fail-closed: a missing/malformed manifest, an unparseable workflow, a job
// that is not a mapping, or an unresolved obligation exits nonzero.
//
// Usage: node scripts/validate-gate-parity.mjs [--root REPO_ROOT]

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as loadYaml } from 'js-yaml';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

/** Collapse a check name to a comparison key: lowercase, punctuation → space. */
export function normalize(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const MATRIX_TOKEN_RE = /\$\{\{\s*matrix\.([A-Za-z0-9_-]+)\s*\}\}/g;

/**
 * Expand a job name template into the check contexts GitHub actually reports.
 * For a matrix job, each `${{ matrix.<key> }}` token is replaced with each
 * value of that key (e.g. `Lint (Node ${{ matrix.node-version }})` with
 * `node-version: [22, 24]` yields `Lint (Node 22)` and `Lint (Node 24)`).
 * A token whose key is absent from the matrix is left literal, so it can
 * never equal a real context — that is fail-closed by construction.
 */
export function expandMatrixName(name, matrix) {
  if (!matrix || typeof matrix !== 'object' || Array.isArray(matrix)) {
    return [name];
  }
  const keys = [...new Set([...name.matchAll(MATRIX_TOKEN_RE)].map((m) => m[1]))];
  if (keys.length === 0) {
    return [name];
  }
  let contexts = [name];
  for (const key of keys) {
    const values = matrix[key];
    if (!Array.isArray(values) || values.length === 0) {
      continue; // keep the literal token; matches no real context
    }
    const tokenRe = new RegExp(`\\$\\{\\{\\s*matrix\\.${escapeRegExp(key)}\\s*\\}\\}`, 'g');
    const next = [];
    for (const ctx of contexts) {
      for (const value of values) {
        next.push(ctx.replace(tokenRe, String(value)));
      }
    }
    contexts = next;
  }
  return [...new Set(contexts)];
}

/**
 * Extract the check contexts GitHub would report for a `jobs:` mapping:
 * one context per job — its `name:` when present, else its id — with any
 * matrix tokens expanded. Throws on a malformed job definition.
 */
export function extractJobContexts(jobs) {
  if (jobs === null || typeof jobs !== 'object' || Array.isArray(jobs)) {
    throw new Error('workflow `jobs:` is not a mapping');
  }
  const contexts = [];
  for (const [id, job] of Object.entries(jobs)) {
    if (job === null || typeof job !== 'object' || Array.isArray(job)) {
      throw new Error(`job "${id}" is not a mapping`);
    }
    const rawName = typeof job.name === 'string' && job.name.trim() ? job.name.trim() : id;
    const matrix =
      job.strategy && typeof job.strategy === 'object' ? job.strategy.matrix : undefined;
    contexts.push(...expandMatrixName(rawName, matrix));
  }
  return contexts;
}

/** Step display names of a job definition (bare `uses:` steps have none). */
export function extractStepNames(job) {
  if (!job || typeof job !== 'object' || !Array.isArray(job.steps)) {
    return [];
  }
  const names = [];
  for (const [i, step] of job.steps.entries()) {
    if (step === null || typeof step !== 'object' || Array.isArray(step)) {
      throw new Error(`step ${i} is not a mapping`);
    }
    if (typeof step.name === 'string' && step.name.trim()) {
      names.push(step.name.trim());
    }
  }
  return names;
}

/** Load and validate the gate manifest; throws on any malformed shape. */
export function loadManifest(repoRoot) {
  const path = join(repoRoot, 'scripts', 'gate-manifest.json');
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    throw new Error(`gate manifest not found: ${path}`);
  }
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch (e) {
    throw new Error(`gate manifest is malformed JSON (${path}): ${e.message}`);
  }
  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error(`gate manifest is not a JSON object: ${path}`);
  }
  for (const section of ['local', 'pr', 'release']) {
    if (typeof manifest[section] !== 'object' || manifest[section] === null) {
      throw new Error(`gate manifest section "${section}" is missing`);
    }
  }
  const checkList = (section, key) => {
    const list = manifest[section][key];
    if (!Array.isArray(list) || list.length === 0 || list.some((c) => typeof c !== 'string')) {
      throw new Error(`gate manifest "${section}.${key}" must be a non-empty array of strings`);
    }
    return list;
  };
  checkList('local', 'checks');
  checkList('pr', 'checks');
  checkList('release', 'checks');
  const external = manifest.pr.external;
  if (
    external !== undefined &&
    (!Array.isArray(external) || external.some((c) => typeof c !== 'string'))
  ) {
    throw new Error('gate manifest "pr.external" must be an array of strings');
  }
  if (typeof manifest.release.readinessJob !== 'string' || !manifest.release.readinessJob.trim()) {
    throw new Error('gate manifest "release.readinessJob" must name the readiness job id');
  }
  checkList('release', 'requiredSteps');
  return manifest;
}

function parseWorkflowFile(filePath) {
  let doc;
  try {
    doc = loadYaml(readFileSync(filePath, 'utf8'));
  } catch (e) {
    throw new Error(`workflow ${filePath} is not parseable YAML: ${e.message}`);
  }
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new Error(`workflow ${filePath} is not a YAML mapping`);
  }
  return doc;
}

/** All job contexts across every workflow under `<root>/.github/workflows`. */
export function collectWorkflowJobContexts(repoRoot) {
  const workflowsDir = join(repoRoot, '.github', 'workflows');
  if (!existsSync(workflowsDir)) {
    throw new Error(`workflows directory not found: ${workflowsDir}`);
  }
  const files = readdirSync(workflowsDir)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .sort();
  if (files.length === 0) {
    throw new Error(`no workflow files found in ${workflowsDir}`);
  }
  const contexts = [];
  for (const file of files) {
    const doc = parseWorkflowFile(join(workflowsDir, file));
    contexts.push(...extractJobContexts(doc.jobs));
  }
  return contexts;
}

function formatCheckLine(ok, label, reason) {
  return ok ? `  ✓ ${label}\n` : `  ✗ ${label} — ${reason}\n`;
}

function run(repoRoot) {
  const manifest = loadManifest(repoRoot);
  const external = manifest.pr.external ?? [];

  const allJobContexts = collectWorkflowJobContexts(repoRoot);

  const releaseWorkflowPath = join(repoRoot, '.github', 'workflows', 'release.yml');
  if (!existsSync(releaseWorkflowPath)) {
    throw new Error(`release workflow not found: ${releaseWorkflowPath}`);
  }
  const releaseDoc = parseWorkflowFile(releaseWorkflowPath);
  const releaseJobContexts = extractJobContexts(releaseDoc.jobs);

  let failed = 0;
  let out = '';

  out += `▸ PR CI checks (${manifest.pr.checks.length} required)\n`;
  for (const claim of manifest.pr.checks) {
    const key = normalize(claim);
    const isJob = allJobContexts.some((c) => normalize(c) === key);
    const isExternal = external.some((c) => normalize(c) === key);
    if (isJob || isExternal) {
      out += formatCheckLine(true, claim);
    } else {
      out += formatCheckLine(
        false,
        claim,
        'no workflow job or external check reports this exact name',
      );
      failed += 1;
    }
  }

  out += `\n▸ Release gate checks (${manifest.release.checks.length} required)\n`;
  for (const claim of manifest.release.checks) {
    const key = normalize(claim);
    if (releaseJobContexts.some((c) => normalize(c) === key)) {
      out += formatCheckLine(true, claim);
    } else {
      out += formatCheckLine(false, claim, `no job in release.yml reports this exact name`);
      failed += 1;
    }
  }

  const readinessJob = manifest.release.readinessJob;
  const readiness = releaseDoc.jobs ? releaseDoc.jobs[readinessJob] : undefined;
  out += `\n▸ Release readiness required steps (job \`${readinessJob}\`)\n`;
  if (!readiness || typeof readiness !== 'object') {
    out += `  ✗ readiness job \`${readinessJob}\` is missing from release.yml\n`;
    failed += 1;
  } else {
    let stepNames;
    try {
      stepNames = extractStepNames(readiness);
    } catch (e) {
      out += `  ✗ readiness job \`${readinessJob}\` steps are malformed: ${e.message}\n`;
      failed += 1;
      stepNames = [];
    }
    for (const required of manifest.release.requiredSteps) {
      const key = normalize(required);
      if (stepNames.some((n) => normalize(n) === key)) {
        out += formatCheckLine(true, required);
      } else {
        out += formatCheckLine(false, required, `missing as a step of the \`${readinessJob}\` job`);
        failed += 1;
      }
    }
  }

  return { failed, out };
}

function main(argv) {
  let repoRoot = join(SCRIPT_DIR, '..');
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--root') {
      repoRoot = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      process.stdout.write('Usage: node scripts/validate-gate-parity.mjs [--root REPO_ROOT]\n');
      process.exit(0);
    } else {
      process.stderr.write(`unknown argument: ${argv[i]}\n`);
      process.exit(1);
    }
  }

  let result;
  try {
    result = run(repoRoot);
  } catch (e) {
    process.stderr.write(`✗ ${e.message}\n`);
    process.exit(1);
  }

  process.stdout.write(result.out);
  if (result.failed > 0) {
    process.stdout.write(`\n✗ Gate parity check failed — ${result.failed} obligation(s) unmet\n`);
    process.exit(1);
  }
  process.stdout.write('\n✓ Gate parity manifest validated\n');
  process.exit(0);
}

main(process.argv.slice(2));
